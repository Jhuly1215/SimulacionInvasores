#server/app/models/simulate.py
from pydantic import BaseModel
from typing import Dict

class SimulationRequest(BaseModel):
    region_id: str
    species_name: str
    parameters: Dict[str, float]
