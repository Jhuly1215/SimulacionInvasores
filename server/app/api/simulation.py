# server/app/api/simulation.py

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel
from typing import Dict, List
from app.services.simulation_service import generate_simulation_for_region
from app.core.firebase import db
import firebase_admin
from firebase_admin import firestore
import logging
logger = logging.getLogger(__name__)
router = APIRouter()

class SimulationRequest(BaseModel):
    region_id: str
    species_name: str          # nombre común o científico
    initial_population: float  # 0.0 – 1.0
    growth_rate: float         # r
    dispersal_kernel: float    # sigma (m)
    timesteps: int

class SimulationResponse(BaseModel):
    status: str
    timesteps: List[str] = []
    error: str = None

@router.post(
    "/",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Dispara la simulación de invasión para región y especie"
)
async def create_simulation(req: SimulationRequest, bg: BackgroundTasks):
    db.collection("simulation").document(req.region_id).set({
        "status": "pending",
        "requested_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

    species_params = {
        "commonName": req.species_name,
        "initial_population": req.initial_population,
        "maxGrowthRate": req.growth_rate,
        "dispersalKernel": req.dispersal_kernel,
        "timesteps": req.timesteps
    }

    urls = await generate_simulation_for_region(req.region_id, species_params)
    return {"region_id": req.region_id, "status": "completed", "timesteps": urls}

async def _background_simulation(region_id: str, species_params: Dict):
    try:
        await generate_simulation_for_region(region_id, species_params)
    except Exception as e:
        logger.exception(f"Simulación {region_id} falló")
        db.collection("simulation").document(region_id).update({
            "status": "failed",
            "error": str(e)
        })

@router.get(
    "/",
    response_model=SimulationResponse,
    summary="Obtiene estado y resultados de la simulación"
)
async def read_simulation(region_id: str):
    doc = db.collection("simulation").document(region_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No existe simulación para esa región")
    data = doc.to_dict()
    return SimulationResponse(
        status=data.get("status"),
        timesteps=data.get("timesteps", []),
        error=data.get("error")
    )
