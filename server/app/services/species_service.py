import requests
from typing import List, Dict, Optional

import geopandas as gpd
from shapely.geometry import Polygon
from app.services.llm_transformers import llama_instruct_generate
from app.core.firebase import db
from firebase_admin import firestore
import logging
logger = logging.getLogger(__name__)

# -------------------------------------------------------
# Funciones de apoyo para GBIF
# -------------------------------------------------------
def fetch_gbif_occurrences(bbox: List[float], limit: int = 1000) -> List[Dict]:
    """
    Consulta GBIF /occurrence/search con bbox WGS84 y devuelve 'results'.
    Incluye establishmentMeans y degreeOfEstablishment en la respuesta.
    """
    polygon_wkt = (
        f"POLYGON(({bbox[0]} {bbox[1]}, {bbox[0]} {bbox[3]}, "
        f"{bbox[2]} {bbox[3]}, {bbox[2]} {bbox[1]}, {bbox[0]} {bbox[1]}))"
    )
    params = {
        'geometry': polygon_wkt,
        'limit': limit,
        'hasCoordinate': 'true',
        'fields': 'scientificName,acceptedScientificName,establishmentMeans,degreeOfEstablishment,countryCode,habitat,higherGeography'
    }
    resp = requests.get(
        'https://api.gbif.org/v1/occurrence/search',
        params=params,
        timeout=20
    )
    resp.raise_for_status()
    return resp.json().get('results', [])
# -------------------------------------------------------
#  Función para resolver nombre común → nombre científico
# -------------------------------------------------------
async def resolve_scientific_name(common_name: str) -> str:
    """
    Usa un LLM para traducir un nombre común proporcionado por el usuario
    al nombre científico estándar.
    """
    system = (
        "Eres un taxónomo experto. Cuando te proporcione un nombre común de una especie, "
        "devuélveme únicamente su nombre científico (género y especie), sin texto adicional."
    )
    user = f"Nombre común: {common_name}\nNombre científico:"  
    llm_output = llama_instruct_generate(
        system_prompt=system,
        user_prompt=user,
        max_new_tokens=20,
        do_sample=False
    )
    # Se asume que el LLM responde algo como "Passer domesticus"
    sci = llm_output.strip().split()[0:2]
    return " ".join(sci)

# -------------------------------------------------------
# Función principal: obtiene info de especie por nombre científico
# -------------------------------------------------------
async def get_species_info_by_common_name(common_name: str) -> Dict:
    """
    Resuelve el nombre científico desde un nombre común y obtiene información global de GBIF:
    - scientificName: nombre científico obtenido
    - occurrenceCount: número total de ocurrencias globales
    - examples: hasta 5 registros con establishmentMeans, degreeOfEstablishment y countryCode
    """
    sci_name = await resolve_scientific_name(common_name)

    # Búsqueda global con nombre científico
    resp = requests.get(
        'https://api.gbif.org/v1/occurrence/search',
        params={'scientificName': sci_name, 'limit': 100, 'hasCoordinate': 'true'},
        timeout=20
    )
    resp.raise_for_status()
    occs = resp.json().get('results', [])

    # Construir respuesta
    info = {
        'commonName': common_name,
        'scientificName': sci_name,
        'occurrenceCount': len(occs),
        'examples': []
    }
    for occ in occs[:5]:
        info['examples'].append({
            'establishmentMeans': occ.get('establishmentMeans'),
            'degreeOfEstablishment': occ.get('degreeOfEstablishment'),
            'countryCode': occ.get('countryCode')
        })

    return info
# -------------------------------------------------------
# Función principal
# -------------------------------------------------------
async def generate_invasive_species_summary(region_id: str) -> List[Dict]:
    """
    Extrae ocurrencias de GBIF para la región y clasifica cada especie como 'invasive' o 'non-invasive'.
    Usa establishmentMeans y degreeOfEstablishment (vocabulary completo) sin LLM.
    """
    logger.info(f"🔍 Extracción de especies para región {region_id}")

    # Leer región y coordenadas
    region_doc = db.collection('regions').document(region_id).get()
    if not region_doc.exists:
        raise ValueError(f"Región '{region_id}' no encontrada.")
    data = region_doc.to_dict()
    points = data.get('points', [])
    coords = [(p['longitude'], p['latitude']) for p in points]
    if not coords:
        raise ValueError(f"No hay puntos en la región '{region_id}'.")
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    # Country code de la región
    region_country = data.get('country', '').upper()

    # Construir bounding box
    poly = Polygon(coords)
    gdf = gpd.GeoDataFrame([{'geometry': poly}], crs='EPSG:4326')
    bbox = list(gdf.total_bounds)

    # Obtener ocurrencias
    occurrences = fetch_gbif_occurrences(bbox)
    for occ in occurrences:
        raw_name = occ.get('scientificName') or occ.get('acceptedScientificName')
        logger.debug(f"RAW_DATA -> {raw_name}: establishmentMeans={occ.get('establishmentMeans')}, "
                     f"degreeOfEstablishment={occ.get('degreeOfEstablishment')}, "
                     f"countryCode={occ.get('countryCode')}")
        
    if not occurrences:
        db.collection('regions').document(region_id).update({
            'species_list': [],
            'species_generated_at': firestore.SERVER_TIMESTAMP
        })
        return []

    # Clasificar especies
    species_dict: Dict[str, Dict] = {}
    # grados que indican establecimiento
    invasive_degrees = {
        'RELEASED', 'ESTABLISHED', 'SPREADING', 'WIDESPREADINVASIVE', 'COLONISING', 'INVASIVE'
    }
    for occ in occurrences:
        name = occ.get('scientificName') or occ.get('acceptedScientificName')
        if not name:
            continue
        if name not in species_dict:
            species_dict[name] = {
                'scientificName': name,
                'status': 'non-invasive',
                'impactSummary': '',
                'primaryHabitat': [],
                'recommendedLayers': []
            }
        obj = species_dict[name]
        est_means = (occ.get('establishmentMeans') or '').upper()
        deg_est = (occ.get('degreeOfEstablishment') or '').replace(' ', '').upper()
        occ_country = (occ.get('countryCode') or '').upper()
        # Determinar invasiva
        if est_means == 'INTRODUCED' or deg_est in invasive_degrees or \
           (region_country and occ_country and occ_country != region_country):
            obj['status'] = 'invasive'
            obj['impactSummary'] = (
                f"Introducción detectada: establishmentMeans={est_means}, degreeOfEstablishment={deg_est}, país={occ_country}"  
            )
            obj['recommendedLayers'] = ['introduced_range', 'habitat_suitability']
        # Reconocer hábitat
        habitat = occ.get('habitat') or occ.get('higherGeography')
        if habitat and not obj['primaryHabitat']:
            obj['primaryHabitat'] = [habitat]

    species_list = list(species_dict.values())

    # Guardar en Firestore
    db.collection('regions').document(region_id).update({
        'species_list': species_list,
        'species_generated_at': firestore.SERVER_TIMESTAMP
    })
    logger.info(f"✅ Procesadas {len(species_list)} especies en {region_id}")
    return species_list

# Alias para compatibilidad
generate_species_summary = generate_invasive_species_summary
