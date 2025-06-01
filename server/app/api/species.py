# server/app/api/species.py

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List

from app.services.species_service import generate_invasive_species_summary
from app.core.firebase import db

router = APIRouter()

class SpeciesRequest(BaseModel):
    region_id: str

@router.post(
    "/",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera la lista de especies invasoras para la región (LLaMA + Transformers)"
)
async def create_species_list(req: SpeciesRequest, bg: BackgroundTasks):
    region_id = req.region_id
    species_ref = db.collection("species").document(region_id)
    species_ref.set({"status": "pending", "requested_at": db.SERVER_TIMESTAMP})
    bg.add_task(_background_generate, region_id)
    return {"region_id": region_id, "status": "pending"}

async def _background_generate(region_id: str):
    try:
        invasive_list = await generate_invasive_species_summary(region_id)
        db.collection("species").document(region_id).update({
            "status": "completed"
        })
    except Exception as e:
        db.collection("species").document(region_id).update({
            "status": "failed",
            "error": str(e)
        })

@router.get(
    "/",
    response_model=Dict[str, List[Dict]],
    summary="Obtiene la lista de especies invasoras para la región"
)
async def read_species_list(region_id: str):
    doc_ref = db.collection("species").document(region_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe registro de especies para esa región.")
    return doc.to_dict()
