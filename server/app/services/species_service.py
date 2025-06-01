# app/services/species_service.py

import os
import json
import requests
from typing import List, Dict

import geopandas as gpd
from shapely.geometry import shape

from app.core.firebase import db

# Importamos nuestro pipeline de Transformers
from app.services.llm_transformers import pipe

# -------------------------------------------------------------------
# 1) Funciones para GBIF
# -------------------------------------------------------------------
def fetch_gbif_occurrences(bbox: List[float], limit: int = 1000) -> List[Dict]:
    """
    Consulta a la API de GBIF para ocurrencias dentro de un bbox WGS84.
    Devuelve la lista cruda de ocurrencias (cada diccionario).
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    polygon_wkt = (
        f"POLYGON(({min_lon} {min_lat}, {min_lon} {max_lat}, "
        f"{max_lon} {max_lat}, {max_lon} {min_lat}, {min_lon} {min_lat}))"
    )
    url = "https://api.gbif.org/v1/occurrence/search"
    params = {
        "geometry": polygon_wkt,
        "limit": limit,
        "hasCoordinate": "true",
        # Opcional: filtrar establishmentMeans para “INTRODUCED”
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results", [])

def extract_unique_scientific_names(raw_occurrences: List[Dict]) -> List[str]:
    """
    Extrae el campo 'scientificName' de cada ocurrencia y devuelvela sin duplicados.
    """
    names = set()
    for occ in raw_occurrences:
        sci_name = occ.get("scientificName")
        if sci_name:
            names.add(sci_name.strip())
    return sorted(names)

# -------------------------------------------------------------------
# 2) Prompt en texto puro
# -------------------------------------------------------------------
PROMPT_PREFIX = """
Actúa como un experto en ecología y control de especies invasoras.
Se te proporciona una lista de nombres científicos de especies que han sido registradas dentro de una región geográfica. Para cada especie, realiza los siguientes pasos:

1. Verifica si la especie es considerada invasora o introducida (consulta virtualmente fuentes como CABI, EASIN, o literatura ecológica).
2. Si es invasora, genera un breve resumen (1-2 oraciones) de su impacto ecológico general en otro entorno similar (p. ej., desplazamiento de nativas, alteración de suelo, vectores de enfermedad).
3. Identifica el(los) hábitat(es) principal(es) en los que prospera (p. ej., “bosque ribario”, “praderas”, “bordes de caminos”, “áreas urbanas”).
4. Sugiere qué capas ambientales serían más relevantes para simular su invasión (p. ej., “landcover”, “hydrology”, “climate_bio1”, “elevation”).
5. Si no es invasora, ignora la especie (no la incluyas en el resultado final).

Produce tu respuesta **solo** como un JSON válido con el siguiente formato (lista de objetos). Ejemplo:

[
  {
    "scientificName": "Ailanthus altissima",
    "commonName": "Tree of Heaven",
    "status": "invasive",
    "impactSummary": "Especie de rápido crecimiento que desplaza plantas nativas y endurece el suelo.",
    "primaryHabitat": ["bosque ribario", "bordes de caminos"],
    "recommendedLayers": ["landcover", "climate_bio1", "elevation"]
  },
  {
    "scientificName": "Fallopia japonica",
    "commonName": "Knotweed japonés",
    "status": "invasive",
    "impactSummary": "Desplaza la vegetación ribereña y provoca erosión en las riberas de ríos.",
    "primaryHabitat": ["riberas", "áreas perturbadas"],
    "recommendedLayers": ["hydrology", "landcover", "slope"]
  }
]

**Si no hay especies invasoras, responde con `[]` exactamente.**
"""

# -------------------------------------------------------------------
# 3) Función principal: LLaMA + Transformers
# -------------------------------------------------------------------
async def generate_invasive_species_summary(region_id: str) -> List[Dict]:
    """
    1) Leer el GeoJSON de Firestore en 'regions/{region_id}'.
    2) Calcular bounding box WGS84 y consultar GBIF.
    3) Extraer nombres científicos únicos (hasta 50).
    4) Armar prompt completo y enviarlo a LLaMA vía pipeline de Transformers.
    5) Parsear la cadena JSON devuelta por LLaMA.
    6) Guardar en Firestore en 'species/{region_id}' y retornar la lista.
    """
    # 3.1) Leer región
    region_doc = db.collection("regions").document(region_id).get()
    if not region_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada en Firestore.")

    geojson = region_doc.to_dict().get("geojson")
    if not geojson or "features" not in geojson or len(geojson["features"]) == 0:
        raise ValueError(f"GeoJSON inválido para la región {region_id}.")

    # 3.2) Calcular bounding box
    feature = geojson["features"][0]
    geom = shape(feature["geometry"])
    gdf = gpd.GeoDataFrame([{"geometry": geom}], crs="EPSG:4326")
    min_lon, min_lat, max_lon, max_lat = gdf.total_bounds

    # 3.3) Llamar a GBIF
    bbox = [min_lon, min_lat, max_lon, max_lat]
    raw_occurs = fetch_gbif_occurrences(bbox=bbox, limit=1000)

    # 3.4) Extraer nombres únicos
    sci_names = extract_unique_scientific_names(raw_occurs)

    # Si no hay nombres, guardamos doc vacío y retornamos lista vacía
    if not sci_names:
        db.collection("species").document(region_id).set({
            "status": "completed",
            "species_list": [],
            "generated_at": db.SERVER_TIMESTAMP
        })
        return []

    # Solo tomamos los primeros 50 para no saturar el contexto
    sci_names = sci_names[:50]
    species_list_str = "\n".join(sci_names)

    # 3.5) Armar el prompt completo
    prompt = PROMPT_PREFIX + "\n\nLista de especies:\n" + species_list_str + "\n\nRespuesta JSON:"

    # 3.6) Enviar a LLaMA vía Transformers pipeline
    # Aquí pipe(prompt) retorna una lista de diccionarios:
    #    [ { "generated_text": "…texto con el JSON…" } ]
    response = pipe(prompt)
    if not response or "generated_text" not in response[0]:
        raise RuntimeError("El pipeline de Transformers no devolvió generated_text.")

    llm_output_text = response[0]["generated_text"].strip()

    # 3.7) A veces el modelo agrega texto antes o después del JSON. Extraemos solo el bloque JSON:
    import re
    match = re.search(r"(\[.*\])", llm_output_text, re.DOTALL)
    if match:
        json_text = match.group(1)
    else:
        # Si no encontramos corchetes, intentamos parsear todo el texto
        json_text = llm_output_text

    try:
        invasive_species = json.loads(json_text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Error parseando JSON de LLaMA: {e}\nTexto crudo del LLM:\n{llm_output_text}")

    # 3.8) Guardar en Firestore
    db.collection("species").document(region_id).set({
        "status": "completed",
        "species_list": invasive_species,
        "generated_at": db.SERVER_TIMESTAMP
    })

    return invasive_species
