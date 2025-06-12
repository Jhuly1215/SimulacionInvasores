# server/app/api/layers.py

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict

from app.services.layer_service import create_layer_urls, get_layer_urls
from app.core.firebase import db
from app.services.srtm_service import generate_srtm_for_region
from app.services.copernicus_service import generate_copernicus_for_region
from app.services.worldclim_service import generate_worldclim_layers_for_region
router = APIRouter(
    
    tags=["layers"]
)

# -----------------------------
# Schemas de petición (Pydantic)
# -----------------------------

class RegionRequest(BaseModel):
    region_id: str


# --------------------------------------
# 1) ENDPOINT: pipeline completo de capas
# --------------------------------------

@router.post(
    "/",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Dispara el pipeline completo (SRTM, Copernicus, WorldClim) para una región"
)
async def create_layers(request: RegionRequest):
    """
    Inicia el proceso de recorte de rásteres SRTM, Copernicus y WorldClim
    para el polígono almacenado en Firestore con el ID `region_id`.
    Devuelve un diccionario con las URLs de cada capa, por ejemplo:
      {
        "srtm_url": "...",
        "copernicus_url": "...",
        "worldclim_bio1_url": "...",
        "worldclim_bio5_url": "...",
        "worldclim_bio6_url": "...",
        "worldclim_bio12_url": "...",
        "worldclim_bio15_url": "..."
      }
    """
    region_id = request.region_id

    try:
        urls = await create_layer_urls(region_id)
        return urls

    except ValueError as ve:
        # Por ejemplo, si la región no existe en Firestore
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        # Cualquier otro fallo en el pipeline
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando capas: {e}"
        )


@router.get(
    "/{region_id}",
    response_model=Dict[str, str],
    summary="Obtiene las URLs de todas las capas ya generadas para una región"
)
async def read_layers(region_id: str):
    """
    Lee desde Firestore el documento `layers/{region_id}` y devuelve el diccionario
    con las URLs de cada capa (campos que terminen en "_url").
    Si aún no se ha ejecutado el pipeline para esa región, devuelve 404.
    """
    try:
        data = await get_layer_urls(region_id)
        # Filtrar para devolver solo las claves *_url
        urls = {k: data[k] for k in data if k.endswith("_url")}
        return urls

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo capas: {e}"
        )


# -------------------------------------------
# 2) ENDPOINTS: solo SRTM
# -------------------------------------------

class SRTMRequest(BaseModel):
    region_id: str

@router.post(
    "/srtm",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera únicamente la capa SRTM recortada para una región"
)
async def create_srtm_layer(request: SRTMRequest):
    """
    Recorta el ráster SRTM v4 para la región y lo sube a Firebase Storage.
    Devuelve: { "srtm_url": "https://…" }  
    Lanza 404 si no existe la región; 500 si falla el recorte o la subida.
    """
    region_id = request.region_id

    try:
        srtm_url = await generate_srtm_for_region(region_id)
        return {"srtm_url": srtm_url}

    except ValueError as ve:
        # Por ejemplo, si la región  no existe o el campo points está vacío
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except RuntimeError as re:
        # Error en la descarga o creación del mosaico SRTM
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(re)
        )
    except Exception as e:
        # Cualquier otro fallo inesperado
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al generar SRTM: {e}"
        )


@router.get(
    "/srtm/{region_id}",
    response_model=Dict[str, str],
    summary="Obtiene la URL de la capa SRTM ya generada para una región"
)
async def read_srtm_layer(region_id: str):
    """
    Devuelve el campo 'srtm_url' almacenado en Firestore bajo 'layers/{region_id}'.  
    Si no existe, devuelve 404.
    """
    try:
        layers_doc = db.collection("layers").document(region_id).get()
        if not layers_doc.exists:
            raise ValueError("La capa SRTM aún no se ha generado para esta región.")

        data = layers_doc.to_dict()
        if "srtm_url" not in data:
            raise ValueError("El campo 'srtm_url' no existe en Firestore para esta región.")

        return {"srtm_url": data["srtm_url"]}

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo SRTM: {e}"
        )


# -------------------------------------------
# 3) ENDPOINTS: solo Copernicus
# -------------------------------------------

class CopernicusRequest(BaseModel):
    region_id: str

@router.post(
    "/copernicus",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera únicamente la capa Copernicus recortada para una región"
)
async def create_copernicus_layer(request: CopernicusRequest):
    """
    Recorta el ráster global de Copernicus al polígono de la región y lo sube a Storage.
    Devuelve: { "copernicus_url": "https://…" }  
    Lanza 404 si no existe la región; 500 si falla el recorte/subida.
    """
    region_id = request.region_id

    try:
        copernicus_url = await generate_copernicus_for_region(region_id)
        return {"copernicus_url": copernicus_url}

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except FileNotFoundError as fe:
        # Por ejemplo, si el GeoTIFF global de Copernicus no se encuentra en disco
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(fe)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando Copernicus: {e}"
        )


@router.get(
    "/copernicus/{region_id}",
    response_model=Dict[str, str],
    summary="Obtiene la URL de la capa Copernicus ya generada para una región"
)
async def read_copernicus_layer(region_id: str):
    """
    Devuelve el campo 'copernicus_url' almacenado en Firestore bajo 'layers/{region_id}'.  
    Si no existe, devuelve 404.
    """
    try:
        layers_doc = db.collection("layers").document(region_id).get()
        if not layers_doc.exists:
            raise ValueError("La capa Copernicus aún no se ha generado para esta región.")

        data = layers_doc.to_dict()
        if "copernicus_url" not in data:
            raise ValueError("El campo 'copernicus_url' no existe en Firestore para esta región.")

        return {"copernicus_url": data["copernicus_url"]}

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo Copernicus: {e}"
        )


# -------------------------------------------
# 4) ENDPOINTS: solo WorldClim
# -------------------------------------------

class WorldClimRequest(BaseModel):
    region_id: str

@router.post(
    "/worldclim",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera las 5 variables bioclimáticas (WorldClim) para una región"
)
async def create_worldclim_layers(request: WorldClimRequest):
    """
    Recorta y sube a Storage las 5 capas bioclimáticas (bio1, bio5, bio6, bio12, bio15) 
    para el polígono de la región.  
    Devuelve un diccionario así:
      {
        "worldclim_bio1_url": "...",
        "worldclim_bio5_url": "...",
        "worldclim_bio6_url": "...",
        "worldclim_bio12_url": "...",
        "worldclim_bio15_url": "..."
      }
    Lanza 404 si no existe la región; 500 si falta algún GeoTIFF global.
    """
    region_id = request.region_id

    try:
        wc_urls = await generate_worldclim_layers_for_region(region_id)
        return wc_urls

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except FileNotFoundError as fe:
        # Por ejemplo, si falta algún GeoTIFF global de WorldClim en disco
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(fe)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando WorldClim: {e}"
        )


@router.get(
    "/worldclim/{region_id}",
    response_model=Dict[str, str],
    summary="Obtiene las URLs de las 5 variables de WorldClim ya generadas para una región"
)
async def read_worldclim_layers(region_id: str):
    """
    Devuelve los campos 'worldclim_bio1_url', 'worldclim_bio5_url', ... etc.
    almacenados en Firestore bajo 'layers/{region_id}'.  
    Si no existe, devuelve 404.
    """
    try:
        layers_doc = db.collection("layers").document(region_id).get()
        if not layers_doc.exists:
            raise ValueError("Las capas WorldClim aún no se han generado para esta región.")

        data = layers_doc.to_dict()
        required_keys = [
            "worldclim_bio1_url",
            "worldclim_bio5_url",
            "worldclim_bio6_url",
            "worldclim_bio12_url",
            "worldclim_bio15_url"
        ]

        missing = [k for k in required_keys if k not in data]
        if missing:
            raise ValueError(f"Faltan campos en Firestore para WorldClim: {missing}")

        return {k: data[k] for k in required_keys}

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo WorldClim: {e}"
        )

