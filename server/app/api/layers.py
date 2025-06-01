# server/app/api/layers.py

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict

from app.services.layer_service import create_layer_urls, get_layer_urls
from firebase_admin import storage
from app.core.firebase import db

router = APIRouter()

# --- Schemas ---
class LayerRequest(BaseModel):
    region_id: str


# --- Endpoints ---

@router.post(
    "/",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Dispara el pipeline de recorte de rásteres para una región"
)
async def create_layers(request: LayerRequest):
    """
    Inicia el proceso de recorte de rásteres (SRTM, WorldClim, Copernicus, etc.) para el polígono
    almacenado en Firestore con el ID `region_id`.  
    Devuelve un diccionario con las URLs de cada capa (`{"srtm": "...", "wc_bio1": "...", "copernicus_lc": "..."}`).
    """
    try:
        # Llama a la función asíncrona que hace el clip y sube a Storage
        urls = await create_layer_urls(request.region_id)
        return urls

    except ValueError as ve:
        # Por ejemplo, si no existe la región en Firestore
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        # Cualquier otro error en el pipeline
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando capas: {e}"
        )


@router.get(
    "/",
    response_model=Dict[str, str],
    summary="Obtiene las URLs de las capas ya generadas para una región"
)
async def read_layers(region_id: str):
    """
    Lee desde Firestore el documento `layers/{region_id}` y devuelve el diccionario
    con las URLs de cada capa.  
    Si aún no se ha ejecutado el recorte para esa región, devuelve 404.
    """
    try:
        urls = await get_layer_urls(region_id)
        return urls

    except ValueError as ve:
        # Si en Firestore no existe el documento layers/{region_id}
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo capas: {e}"
        )

from app.services.srtm_service import generate_srtm_for_region, load_user_polygon_from_firestore
class SRTMRequest(BaseModel):
    region_id: str


@router.post(
    "/srtm",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera la capa SRTM recortada para una región"
)
async def create_srtm_layer(request: SRTMRequest):
    try:
        url = await generate_srtm_for_region(request.region_id)
        return {"srtm_url": url}

    except ValueError as ve:
        # Error levantado si la región no existe o GeoJSON inválido
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

    except RuntimeError as re:
        # Error en descarga o mosaico
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))

    except Exception as e:
        # Cualquier otro fallo inesperado
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error interno: {e}")


@router.get(
    "/srtm",
    response_model=Dict[str, str],
    summary="Obtiene la URL de la capa SRTM ya generada para una región"
)
async def read_srtm_layer(region_id: str):
    """
    Devuelve el documento Firestore en 'layers/{region_id}' que contiene {"srtm_url": "..."}.
    """
    try:
        layers_doc = db.collection("layers").document(region_id).get()
        if not layers_doc.exists:
            raise ValueError("La capa SRTM aún no se ha generado para esta región.")

        data = layers_doc.to_dict()
        # Si quieres incluir únicamente "srtm_url":
        if "srtm_url" not in data:
            raise ValueError("El campo 'srtm_url' no está en Firestore para esta región.")
        return {"srtm_url": data["srtm_url"]}

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error obteniendo SRTM: {e}")


   
from app.services.copernicus_service import generate_copernicus_for_region

class CopernicusRequest(BaseModel):
    region_id: str

@router.post(
    "/copernicus",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera la capa Copernicus recortada para una región"
)
async def create_copernicus_layer(request: CopernicusRequest):
    try:
        url = await generate_copernicus_for_region(request.region_id)
        return {"copernicus_url": url}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except FileNotFoundError as fe:
        # Si el GeoTIFF global no se encuentra
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(fe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error generando Copernicus: {e}")


@router.get(
    "/copernicus",
    response_model=Dict[str, str],
    summary="Obtiene la URL de la capa Copernicus ya generada para una región"
)
async def read_copernicus_layer(region_id: str):
    """
    Devuelve el campo 'copernicus_url' almacenado en Firestore bajo 'layers/{region_id}'.
    """
    try:
        layers_doc = db.collection("layers").document(region_id).get()
        if not layers_doc.exists:
            raise ValueError("La capa Copernicus aún no se ha generado para esta región.")

        data = layers_doc.to_dict()
        if "copernicus_url" not in data:
            raise ValueError("El campo 'copernicus_url' no está en Firestore para esta región.")
        return {"copernicus_url": data["copernicus_url"]}

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error obteniendo Copernicus: {e}")