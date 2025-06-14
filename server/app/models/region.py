# server/app/models/region.py

from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

class Point(BaseModel):
    """
    Define un punto geográfico con latitud y longitud.
    """
    latitude: float = Field(..., description="Latitud del punto")
    longitude: float = Field(..., description="Longitud del punto")

class SpeciesItem(BaseModel):
  """
  Información de una especie invasora generada:
  - scientificName: nombre científico
  - status: estado ('invasive' | 'non-invasive')
  - recommendedLayers: lista de capas recomendadas para análisis
  - primaryHabitat: hábitat principal
  - impactSummary: resumen del impacto
  """
  scientificName: str = Field(..., description="Nombre científico de la especie")
  status: str = Field(..., description="Estado de invasividad")
  recommendedLayers: List[str] = Field(..., description="Capas recomendadas para esta especie")
  primaryHabitat: str = Field(..., description="Hábitat principal de la especie")
  impactSummary: str = Field(..., description="Resumen del impacto basado en LLM+GBIF")

class RegionCreateRequest(BaseModel):
    """
    Para crear o actualizar una región, el cliente envía:
      - name: str
      - points: List[Point]  (un array de objetos { latitude, longitude })
    """
    name: str
    points: List[Point] = Field(
        ..., 
        description="Array de puntos que definen el polígono; cada punto contiene latitude y longitude"
    )
class RegionCreateResponse(BaseModel):
    id: str = Field(..., description="ID de la región en Firestore")
    name: str = Field(..., description="Nombre del área")
    points: List[Point] = Field(
        ..., description="Array de puntos que definen el polígono"
    )
class RegionResponse(BaseModel):
  """
  Esquema de respuesta para GET /region/{region_id}:
  - id: ID del documento en Firestore
  - latitude, longitude: coordenadas representativas (centroid o primer punto)
  - species_generated_at: timestamp de generación de especies
  - species_list: lista de SpeciesItem con datos enriquecidos
  """
  id: str = Field(..., description="ID de la región en Firestore")
  name: str = Field(..., description="Nombre del área")
  points: List[Point] = Field(
        ..., description="Array de puntos que definen el polígono"
  )
  species_generated_at: datetime = Field(...,description="Fecha y hora en que se generó la lista de especies")
  species_list: List[SpeciesItem] = Field(...,description="Lista de especies invasoras con detalle enriquecido")

class RegionListResponse(BaseModel):
  """
  Esquema de respuesta para GET /region:
  - regions: lista de regiones con id, nombre y puntos
  """
  regions: List[RegionCreateResponse] = Field(
    ..., description="Lista de regiones registradas"
  )