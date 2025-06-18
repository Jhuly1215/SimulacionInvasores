# server/app/api/simulation.py

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field
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
    # mapear species_name → commonName (camelCase interno)
    species_name: str           = Field(..., alias="species_name")
    initial_population: float
    # mapear growth_rate → maxGrowthRate
    growth_rate: float      = Field(..., alias="growth_rate")
    # mapear dispersal_kernel → dispersalKernel
    dispersal_kernel: float    = Field(..., alias="dispersal_kernel")
    timesteps: int
    dt_years: float            = Field(1.0, alias="dt_years")
    mobility: str
    jump_prob: float
    max_dispersal_km: float
    altitude_tolerance: List[float]
    habitat_pref: Dict[str, float]
    climate_pref: Dict[str, float]
    climate_tolerance: Dict[str, List[float]]

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
    "/region/{region_id}",
    response_model=List[SimulationResponse],
    summary="Obtiene todas las simulaciones asociadas a una región"
)
async def get_simulations_by_region(region_id: str):
    try:
        sims = db.collection("simulation").where("region_id", "==", region_id).stream()
        simulations = []
        for doc in sims:
            data = doc.to_dict()
            simulations.append(SimulationResponse(
                status=data.get("status"),
                timesteps=data.get("timesteps", []),
                error=data.get("error")
            ))
        return simulations
    except Exception as e:
        logger.exception(f"Error obteniendo simulaciones para región {region_id}")
        raise HTTPException(status_code=500, detail="Error al recuperar las simulaciones")
