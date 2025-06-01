from pydantic import BaseModel
from typing import Any, Dict

class RegionInput(BaseModel):
    geojson: Dict[str, Any]
# server/app/api/regions.py (o en app/models/region.py si prefieres separar esquemas)
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

# Definimos un tipo genérico para que Pydantic acepte cualquier estructura válida de GeoJSON.
# Podrías reforzar más validación (por ejemplo, con jsonschema), pero con esto basta para
# asegurarnos de recibir al menos un dict con fields type y features.

class GeoJSONFeature(BaseModel):
    type: str = Field(..., description="Debe ser 'Feature'")
    properties: Optional[Dict[str, Any]]
    geometry: Dict[str, Any] = Field(
        ..., 
        description="Debe contener 'type' (Polygon, MultiPolygon, etc.) y 'coordinates'"
    )

class GeoJSONFeatureCollection(BaseModel):
    type: str = Field(..., description="Debe ser 'FeatureCollection'")
    features: List[GeoJSONFeature]

class RegionCreateRequest(BaseModel):
    """
    Request para crear una región: 
      - un nombre opcional (para tu comodidad),
      - y el GeoJSON completo (FeatureCollection con 1 Feature mínimo).
    """
    nombre: Optional[str]
    geojson: GeoJSONFeatureCollection

class RegionResponse(BaseModel):
    """
    Response al leer/actualizar: incluye el ID asignado por Firestore,
    el nombre (si existe), y el geojson.
    """
    id: str
    nombre: Optional[str]
    geojson: GeoJSONFeatureCollection
