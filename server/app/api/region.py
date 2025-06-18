# server/app/api/region.py

import logging
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.encoders import jsonable_encoder

from app.models.region import RegionCreateRequest, RegionResponse, RegionCreateResponse
from app.core.firebase import db
from app.services.species_service import generate_invasive_species_summary
from typing import List
from app.models.region import RegionListResponse

router = APIRouter()


@router.post(
    "/",
    response_model=RegionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una nueva región (name + lista de puntos)"
)
async def create_region(
    request: RegionCreateRequest,
    bg: BackgroundTasks
):
    data_in = jsonable_encoder(request)
    name = data_in["name"]
    points = data_in["points"]

    # 2) Preparar y guardar el documento en Firestore,
    #    incluyendo campos iniciales para el GET
    doc_data = {
        "name": name,
        "points": points,
    }

    try:
        doc_ref = db.collection("regions").document()
        doc_ref.set(doc_data)
    except Exception as e:
        logging.getLogger("uvicorn.error").error(f"Error al guardar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    # 3) Disparar en background la generación de especies
    bg.add_task(generate_invasive_species_summary, doc_ref.id)

    # 4) Devolver sólo id, name y points
    return RegionCreateResponse(
        id=doc_ref.id,
        name=name,
        points=points
    )

@router.get(
    "/{region_id}",
    response_model=RegionResponse,
    summary="Obtener una región existente (por ID)"
)
async def read_region(region_id: str):
    doc_ref = db.collection("regions").document(region_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Región no encontrada")

    data = doc.to_dict()
    return RegionResponse(
        id=doc.id,
        name=data["name"],
        points=data["points"],
        species_generated_at=data["species_generated_at"],
        species_list=data["species_list"]
    )

@router.get(
        "/",
        response_model=RegionListResponse,
        summary="Listar todas las regiones"
)
async def list_regions():
    regions_ref = db.collection("regions")
    docs = regions_ref.stream()
    regions = []
    for doc in docs:
        data = doc.to_dict()
        regions.append({
            "id": doc.id,
            "name": data.get("name"),
            "points": data.get("points"),
            "species_generated_at": data.get("species_generated_at"),
            "species_list": data.get("species_list"),
        })
    return RegionListResponse(regions=regions)