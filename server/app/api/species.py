# server/app/api/species.py

from typing import Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel

from app.services.species_service import generate_invasive_species_summary
from app.core.firebase import db

router = APIRouter()


# -------------------------------------------------------
# 1) Modelos Pydantic para la respuesta de especies
# -------------------------------------------------------

class SpeciesItem(BaseModel):
    """
    Representa un objeto con información sobre una especie invasora.
    Debe coincidir con el formato que envía tu LLM en JSON.
    """
    scientificName: str
    commonName: Optional[str]         # Puede que el LLM no siempre lo devuelva
    status: str                       # ej. "invasive" o "introduced"
    impactSummary: Optional[str]      # Resumen breve del impacto
    primaryHabitat: List[str]         # Lista de hábitats principales
    recommendedLayers: List[str]      # Capas recomendadas para simulación


class SpeciesResponse(BaseModel):
    """
    Esquema de respuesta completo para GET /species/.
    - status: "pending", "completed" o "failed"
    - species_list: lista de SpeciesItem (vacío si status != "completed")
    - generated_at: timestamp en que se completó (solo si status=="completed")
    - error: mensaje de error (solo si status=="failed")
    """
    status: str
    species_list: Optional[List[SpeciesItem]] = []
    generated_at: Optional[datetime] = None
    error: Optional[str] = None


# -------------------------------------------------------
# 2) Esquema de request para POST /species/
# -------------------------------------------------------

class SpeciesRequest(BaseModel):
    region_id: str


# -------------------------------------------------------
# 3) Endpoint: POST /species/
#    Dispara la generación en background
# -------------------------------------------------------

@router.post(
    "/",
    response_model=Dict[str, str],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Genera la lista de especies invasoras para la región"
)
async def create_species_list(req: SpeciesRequest, bg: BackgroundTasks):
    region_id = req.region_id

    # Marcamos en Firestore que estamos pendientes de generar la lista
    db.collection("species").document(region_id).set({
        "status": "pending",
        "requested_at": db.SERVER_TIMESTAMP
    })

    # Disparar la tarea en background para procesar la lista
    bg.add_task(_background_generate, region_id)
    return {"region_id": region_id, "status": "pending"}


async def _background_generate(region_id: str):
    try:
        # 1) Llamamos al servicio que recopila datos y consulta al LLM
        invasive_list = await generate_invasive_species_summary(region_id)

        # 2) Si no arroja excepción, actualizamos solo el campo "status"
        db.collection("species").document(region_id).update({
            "status": "completed"
        })
    except Exception as e:
        # Si falla en cualquier punto, lo marcamos como "failed" y almacenamos el error
        db.collection("species").document(region_id).update({
            "status": "failed",
            "error": str(e)
        })


# -------------------------------------------------------
# 4) Endpoint: GET /species/?region_id=...
#    Recupera el documento completo para ese region_id
# -------------------------------------------------------

@router.get(
    "/",
    response_model=SpeciesResponse,
    summary="Obtiene la lista de especies invasoras generada"
)
async def read_species_list(region_id: str):
    # Obtenemos el documento de Firestore
    doc_snapshot = db.collection("species").document(region_id).get()
    if not doc_snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe registro de especies para esa región."
        )

    data = doc_snapshot.to_dict()

    # Construimos el diccionario que encaje con SpeciesResponse
    response_data: Dict[str, Optional[object]] = {
        "status": data.get("status"),
        # species_list solo si status == "completed"; de lo contrario, dejamos lista vacía
        "species_list": data.get("species_list", []) if data.get("status") == "completed" else [],
        # generated_at solo existe si status == "completed"
        "generated_at": data.get("generated_at") if data.get("status") == "completed" else None,
        # error solo existe si status == "failed"
        "error": data.get("error") if data.get("status") == "failed" else None
    }

    # Pydantic validará automáticamente que los tipos coincidan con SpeciesResponse
    return response_data
