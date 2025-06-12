# server/app/services/layer_service.py

import asyncio
from app.services.srtm_service import generate_srtm_for_region
from app.services.copernicus_service import generate_copernicus_for_region
from app.services.worldclim_service import generate_worldclim_layers_for_region
from app.core.firebase import db
from firebase_admin import firestore


async def create_layer_urls(region_id: str) -> dict:
    """
    1) Marca el documento layers/{region_id} como "running".
    2) Llama a cada servicio para generar SRTM, Copernicus y WorldClim.
       Cada servicio devuelve la URL pública de su capa.
    3) Al terminar, guarda todas las URLs en Firestore y marca "completed".
    4) Devuelve un dict con todas las URLs (srtm_url, copernicus_url, worldclim_bioX_url...).
    """
    # 1) Marcamos “running”
    db.collection("layers").document(region_id).set({
        "status": "running",
        "started_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

    try:
        # 2.1) Generar SRTM y obtener su URL
        srtm_url = await generate_srtm_for_region(region_id)

        # 2.2) Generar Copernicus y obtener su URL
        copernicus_url = await generate_copernicus_for_region(region_id)

        # 2.3) Generar las 5 capas de WorldClim y obtener sus URLs como dict
        worldclim_urls = await generate_worldclim_layers_for_region(region_id)
        # worldclim_urls tendrá:
        # {
        #   "worldclim_bio1_url": "...",
        #   "worldclim_bio5_url": "...",
        #   "worldclim_bio6_url": "...",
        #   "worldclim_bio12_url": "...",
        #   "worldclim_bio15_url": "..."
        # }

        # 3) Guardar todas las URLs en Firestore
        combined = {
            "srtm_url": srtm_url,
            "copernicus_url": copernicus_url,
            **worldclim_urls
        }

        # Actualizamos el documento layers/{region_id} con las URLs
        db.collection("layers").document(region_id).update(combined)

        # 3.1) Marcamos “completed” y guardamos generated_at
        db.collection("layers").document(region_id).update({
            "status": "completed",
            "generated_at": firestore.SERVER_TIMESTAMP
        })

        # 4) Devolvemos el dict con todas las URLs
        return combined

    except Exception as e:
        # En caso de error, marcamos "failed" con mensaje y timestamp
        db.collection("layers").document(region_id).update({
            "status": "failed",
            "error": str(e),
            "failed_at": firestore.SERVER_TIMESTAMP 
        })
        # Volvemos a propagar la excepción para que FastAPI lo convierta en un 500
        raise


async def get_layer_urls(region_id: str) -> dict:
    """
    Lee el documento layers/{region_id} en Firestore.
    Si no existe o su status != "completed", lanza ValueError.
    Si está “completed”, devuelve el dict completo (incluye URLs y metadatos).
    """
    layers_doc = db.collection("layers").document(region_id).get()
    if not layers_doc.exists:
        raise ValueError(f"No se encontró layers/{region_id} en Firestore.")

    data = layers_doc.to_dict()
    if data.get("status") != "completed":
        raise ValueError(f"Las capas para la región {region_id} aún no están listas. Estado actual: {data.get('status')}")

    return data

