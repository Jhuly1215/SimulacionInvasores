# server/app/api/regions.py

from fastapi import APIRouter, HTTPException, status
from typing import List

from app.models.region import RegionCreateRequest, RegionResponse
from app.core.firebase import db  # ya configurado en app/core/firebase.py

router = APIRouter()

# POST /regions/           → Crear nueva región (almacena GeoJSON).
# GET  /regions/{region_id} → Obtener región por ID.
# PUT  /regions/{region_id} → Actualizar nombre y/o geojson.
# DELETE /regions/{region_id} → Eliminar región.

@router.post(
    "/",
    response_model=RegionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una nueva región con GeoJSON"
)
async def create_region(request: RegionCreateRequest):
    """
    Crea un documento en Firestore bajo 'regions' con los campos:
        - nombre (opcional)
        - geojson (FeatureCollection)
        - created_at (Timestamp automático)

    Retorna:
        {
          "id": "<ID generado por Firestore>",
          "nombre": "...",
          "geojson": { ... }
        }
    """
    # Armar el payload que vamos a guardar en Firestore
    doc_data = {
        "geojson": request.geojson.dict()
    }
    if request.nombre:
        doc_data["nombre"] = request.nombre
    # Podríamos agregar created_at con firestore.SERVER_TIMESTAMP si lo quisiéramos

    # Insertar en Firestore
    doc_ref = db.collection("regions").document()  # ID autogenerado
    doc_ref.set(doc_data)

    return RegionResponse(id=doc_ref.id, nombre=request.nombre, geojson=request.geojson)


@router.get(
    "/{region_id}",
    response_model=RegionResponse,
    summary="Obtener una región existente por su ID"
)
async def read_region(region_id: str):
    """
    Busca el documento en 'regions/{region_id}'. Si no existe, retorna 404.
    """
    doc_ref = db.collection("regions").document(region_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Región no encontrada")
    data = doc.to_dict()
    # data tendrá al menos 'geojson'; puede tener 'nombre' y otros metadatos
    return RegionResponse(
        id=region_id,
        nombre=data.get("nombre"),
        geojson=data["geojson"]
    )


@router.put(
    "/{region_id}",
    response_model=RegionResponse,
    summary="Actualizar el nombre y/o GeoJSON de una región"
)
async def update_region(region_id: str, request: RegionCreateRequest):
    """
    Permite actualizar:
      - el campo 'nombre' (si se envía),
      - el campo 'geojson' (FeatureCollection).  
    Si alguno de estos no se incluye en la petición, se respetan los valores previos.
    """
    doc_ref = db.collection("regions").document(region_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Región no encontrada")

    update_data: dict = {}
    if request.nombre is not None:
        update_data["nombre"] = request.nombre
    if request.geojson is not None:
        update_data["geojson"] = request.geojson.dict()

    if not update_data:
        # No se envió ningún campo modificado
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se proporcionaron campos para actualizar")

    doc_ref.update(update_data)
    # Obtener de nuevo para retornar el estado actualizado
    updated = doc_ref.get().to_dict()
    return RegionResponse(
        id=region_id,
        nombre=updated.get("nombre"),
        geojson=updated["geojson"]
    )


@router.delete(
    "/{region_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar una región y sus datos asociados"
)
async def delete_region(region_id: str):
    """
    Elimina el documento 'regions/{region_id}' de Firestore.
    Si no existe, devuelve 404. 
    No retorna contenido (204 No Content).
    """
    doc_ref = db.collection("regions").document(region_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Región no encontrada")
    doc_ref.delete()
    return  # 204 No Content
