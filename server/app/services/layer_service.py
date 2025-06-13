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
    2) Llama a cada servicio independientemente y captura errores por separado.
    3) Al terminar, guarda todas las URLs y posibles errores en Firestore.
    4) Marca "completed" o "completed_with_errors" y devuelve el resultado.
    """
    # 1) Marco “running”
    db.collection("layers").document(region_id).set({
        "status": "running",
        "started_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

    urls: dict = {}
    errors: dict = {}

    # 2.1) SRTM
    try:
        urls["srtm_url"] = await generate_srtm_for_region(region_id)
    except Exception as e:
        errors["srtm_error"] = str(e)

    # 2.2) Copernicus
    try:
        urls["copernicus_url"] = await generate_copernicus_for_region(region_id)
    except Exception as e:
        errors["copernicus_error"] = str(e)

    # 2.3) WorldClim (varias capas)
    try:
        worldclim_urls = await generate_worldclim_layers_for_region(region_id)
        # worldclim_urls es un dict con las 5 URLs:
        # { "worldclim_bio1_url": "...", ..., "worldclim_bio15_url": "..." }
        urls.update(worldclim_urls)
    except Exception as e:
        errors["worldclim_error"] = str(e)

    # 3) Guardar en Firestore (URLs + errores si los hay)
    update_data = {**urls}
    if errors:
        update_data["errors"] = errors

    db.collection("layers").document(region_id).update(update_data)

    # 3.1) Marcar estado final
    final_status = "completed" if not errors else "completed_with_errors"
    db.collection("layers").document(region_id).update({
        "status": final_status,
        "generated_at": firestore.SERVER_TIMESTAMP
    })

    # 4) Devolver tanto URLs como errores (si hubo)
    return update_data


async def get_layer_urls(region_id: str) -> dict:
    """
    Lee layers/{region_id}. Si está en estado "completed" o
    "completed_with_errors" devuelve el documento completo.
    En otro caso lanza ValueError.
    """
    layers_ref = db.collection("layers").document(region_id)
    layers_doc = layers_ref.get()
    if not layers_doc.exists:
        raise ValueError(f"No se encontró layers/{region_id} en Firestore.")

    data = layers_doc.to_dict()
    status = data.get("status")
    if status not in ("completed", "completed_with_errors"):
        raise ValueError(
            f"Las capas para la región {region_id} aún no están listas. "
            f"Estado actual: {status}"
        )

    return data
