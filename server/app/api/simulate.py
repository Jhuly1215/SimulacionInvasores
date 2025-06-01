from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.simulate import SimulationRequest
from app.services.simulation import run_simulation_job
from app.core.firebase import db

router = APIRouter()

@router.post("/")
async def simulate(req: SimulationRequest, bg: BackgroundTasks):
    # Crea un documento de job en Firestore
    job_ref = db.collection("simulations").document()
    job_ref.set({"status": "pending", **req.dict()})
    # Ejecuta en background
    bg.add_task(run_simulation_job, job_ref.id, req.dict())
    return {"job_id": job_ref.id, "status": "pending"}
