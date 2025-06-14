# app/services/simulation_service.py

import os
import tempfile
import shutil
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.mask import mask
from rasterio.io import MemoryFile
from shapely.geometry import shape
import geopandas as gpd
from firebase_admin import storage
from app.core.firebase import db
from typing import Dict, List
from app.services.llm_transformers import llama_instruct_generate
from firebase_admin import firestore
import requests
import re
from pathlib import Path
from typing import Tuple, Dict
from shapely.geometry import Polygon
from app.utils.cog import to_cog
from scipy.signal import convolve2d
from utils.run_simulation import build_suitability_and_barrier, run_dynamic_simulation

import logging
logger = logging.getLogger(__name__)
from scipy.signal import convolve2d
# -------------------------------------------------------------------
# 1) Configuración de rutas / bucket
# -------------------------------------------------------------------
bucket = storage.bucket()
TMP_ROOT = tempfile.gettempdir()

# ———————————————————————————————————————————————————————————
# Helpers LLM + GBIF
# ———————————————————————————————————————————————————————————
def fetch_gbif_occurrences(bbox: List[float], limit: int = 1000) -> List[Dict]:
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
    resp = requests.get('https://api.gbif.org/v1/occurrence/search', params=params, timeout=20)
    resp.raise_for_status()
    return resp.json().get('results', [])

async def resolve_scientific_name(common_name: str) -> str:
    """
    Usa un LLM para traducir un nombre común proporcionado por el usuario
    al nombre científico estándar (género y especie). Sólo devuelve esas dos palabras.
    """
    logger.debug(f"Resolviendo nombre científico para nombre común: '{common_name}'")

    # Prompt reforzado con instrucciones y ejemplos
    system = (
        "Eres un taxónomo experto. Cuando te dé un **nombre común** de una especie, "
        "debes responder **únicamente** con su nombre científico en forma de binomio "
        "(Género especie), sin paréntesis, comillas, puntos ni texto extra. "
        "Si no conoces la respuesta, escribe exactamente: Desconocido\n\n"
        "Ejemplos:\n"
        "  Nombre común: panda  →  Ailuropoda melanoleuca\n"
        "  Nombre común: león   →  Panthera leo\n"
        "  Nombre común: puma   →  Puma concolor\n"
    )

    user = f"Nombre común: {common_name}\nNombre científico:"

    llm_output = llama_instruct_generate(
        system_prompt=system,
        user_prompt=user,
        max_new_tokens=20,
        do_sample=False
    )

    logger.debug(f"LLM raw output para '{common_name}': {llm_output!r}")

    # Extraer binomio "Género especie" usando regex
    # Género: palabra que empieza con mayúscula seguido de minúsculas
    # especie: palabra en minúsculas
    match = re.search(r"\b([A-Z][a-z]+ [a-z]+)\b", llm_output)
    if match:
        sci_name = match.group(1)
        logger.debug(f"Nombre científico extraído por regex: '{sci_name}'")
    else:
        # Fallback: tomar las dos primeras "palabras" de la salida limpia
        parts = llm_output.strip().split()
        sci_name = " ".join(parts[:2])
        logger.warning(f"No se encontró binomio con regex; usando fallback: '{sci_name}'")

    return sci_name


async def get_species_info_by_common_name(common_name: str) -> Dict:
    """
    Resuelve el nombre científico desde un nombre común y obtiene información global de GBIF:
    - scientificName: nombre científico obtenido
    - occurrenceCount: número total de ocurrencias globales
    - examples: hasta 5 registros con establishmentMeans, degreeOfEstablishment y countryCode
    """
    logger.debug(f"Obteniendo info de especie para nombre común: '{common_name}'")
    sci_name = await resolve_scientific_name(common_name)
    logger.debug(f"Usando nombre científico para consulta GBIF: '{sci_name}'")

    resp = requests.get(
        'https://api.gbif.org/v1/occurrence/search',
        params={'scientificName': sci_name, 'limit': 100, 'hasCoordinate': 'true'},
        timeout=20
    )
    resp.raise_for_status()
    occs = resp.json().get('results', [])
    logger.debug(f"GBIF devolvió {len(occs)} ocurrencias para '{sci_name}'")

    info = {
        'commonName': common_name,
        'scientificName': sci_name,
        'occurrenceCount': len(occs),
        'examples': []
    }
    for occ in occs[:5]:
        example = {
            'establishmentMeans': occ.get('establishmentMeans'),
            'degreeOfEstablishment': occ.get('degreeOfEstablishment'),
            'countryCode': occ.get('countryCode')
        }
        info['examples'].append(example)
    logger.debug(f"Ejemplos para '{sci_name}': {info['examples']}")
    return info

async def assess_impact_with_llm(sci_info: Dict, region_id: str) -> float:
    prompt = (
        f"Basado en que '{sci_info['scientificName']}' tiene {sci_info['occurrenceCount']} registros "
        f"y ejemplos {sci_info['examples']}, describe con un valor de 0 a 1 su potencial invasor en la región {region_id}."
    )
    out = llama_instruct_generate(
        system_prompt="Eres un ecólogo cuantitativo. Devuélveme solo un número entre 0 y 1.",
        user_prompt=prompt,
        max_new_tokens=4,
        do_sample=False
    )
    try:
        return float(out.strip())
    except:
        return 0.5 


# -------------------------------------------------------------------
# 2) Lectura de capas (descarga desde Firebase Storage)
# -------------------------------------------------------------------
def download_raster_from_url(url: str, dest_path: str) -> None:
    """
    Dado un URL HTTPS directo a un GeoTIFF en Firebase Storage,
    lo descarga localmente en dest_path.
    """
    import requests
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

def read_raster_as_array(tif_path: str) -> (np.ndarray, dict):
    """
    Abre un GeoTIFF con rasterio y devuelve (array, meta).
    array: shape (bands, rows, cols).
    meta: diccionario con transform, crs, etc.
    """
    with rasterio.open(tif_path) as src:
        data = src.read(
            out_shape=(
                src.count,
                src.height,
                src.width
            )
        )
        meta = src.meta.copy()
    return data, meta

# -------------------------------------------------------------------
# 3) Construcción de suitability y barriers
# -------------------------------------------------------------------
def build_suitability_and_barrier(
    copernicus_tif: str,
    srtm_tif: str,
    worldclim_tifs: Dict[str, str],
    polygon_gdf: gpd.GeoDataFrame,
    tmp_folder: str
) -> Tuple[np.ndarray, np.ndarray, dict]:
    # — Abrir referencia para metadatos y dimensiones —
    with rasterio.open(copernicus_tif) as ref:
        meta     = ref.meta.copy()
        H, W     = ref.height, ref.width
        transform= ref.transform
        crs      = ref.crs

    def _mask_and_resample(path: str) -> np.ndarray:
        with rasterio.open(path) as src:
            geoms = [g for g in polygon_gdf.to_crs(src.crs).geometry]
            _, _ = mask(src, geoms, crop=True)
            arr = src.read(
                1,
                out_shape=(H, W),
                resampling=Resampling.bilinear
            )
        return arr.astype(np.float32)

    # — Leer capas —
    class_arr = _mask_and_resample(copernicus_tif).astype(int)
    elev_arr  = _mask_and_resample(srtm_tif)
    clim = {var: _mask_and_resample(path) for var, path in worldclim_tifs.items()}

    # — Parámetros y rangos —
    class_weights = {
        111: 0.9, 113: 0.8, 112: 0.85, 114: 0.75, 115: 0.8,
        116: 0.5, 121: 0.7, 123: 0.65,122: 0.7,124: 0.6,
        125: 0.6,126: 0.5, 20: 0.4, 30: 0.4, 40: 0.3,
         50: 0.0, 60: 0.2, 70: 0.1, 80: 0.0, 90: 0.3, 100: 0.2
    }
    # defaults
    s_class = np.full((H, W), 0.1, dtype=np.float32)
    for code, w in class_weights.items():
        s_class[class_arr == code] = w

    # s_el: pico en altitud media
    elev_min, elev_max = 0.0, 3000.0
    mid = 0.5 * (elev_min + elev_max)
    half_range = 0.5 * (elev_max - elev_min)
    s_el = 1.0 - np.abs((elev_arr - mid) / half_range)
    s_el = np.clip(s_el, 0.0, 1.0)

    # s_bioclim: normalizar cada biovar y combinar
    clim_ranges = {
        'bio1':  (-10.0, 45.0),
        'bio5':  (  0.0, 55.0),
        'bio6':  (-20.0, 30.0),
        'bio12': (  0.0,3000.0),
        'bio15': (  0.0, 100.0),
    }
    # Normalización vectorizada:
    s_b = {}
    for var, arr in clim.items():
        vmin, vmax = clim_ranges[var]
        s = (arr - vmin) / (vmax - vmin)
        s_b[var] = np.clip(s, 0.0, 1.0)
    # rango entre bio5 y bio6
    max_range = clim_ranges['bio5'][1] - clim_ranges['bio6'][0]
    s_range = np.clip((clim['bio5'] - clim['bio6']) / max_range, 0.0, 1.0)

    s_bioclim = (
        0.25 * s_b['bio1'] +
        0.20 * s_b['bio5'] +
        0.20 * s_b['bio6'] +
        0.25 * s_b['bio12']+
        0.05 * s_b['bio15']+
        0.05 * s_range
    )

    # combinación final
    suitability = 0.3 * s_class + 0.3 * s_el + 0.4 * s_bioclim
    suitability = np.clip(suitability, 0.0, 1.0)

    # barrier: 1.0 donde clase==80, 0.7 donde clase==60, else 0
    barrier = np.zeros((H, W), dtype=np.float32)
    barrier[class_arr == 80] = 1.0
    barrier[class_arr == 60] = 0.7

    # actualizar meta y devolver
    meta.update({
        "height":    H,
        "width":     W,
        "transform": transform,
        "crs":       crs,
        "dtype":     "float32",
    })
    return suitability, barrier, meta

# 4) Loop temporal de simulación
# -------------------------------------------------------------------
def run_dynamic_simulation(
    region_id: str,
    species_params: Dict,
    suitability: np.ndarray,
    barrier: np.ndarray,
    meta: dict,
    polygon_gdf: gpd.GeoDataFrame,
    tmp_folder: str
) -> List[str]:
    """
    Simulación vectorizada:
      - initial_population inicia D
      - crecimiento logístico con escala temporal dt_years
      - dispersión con convolución
      - umbral dinámico basado en initial_population

    Cada timestep representa dt_years años, así que con T timesteps
    simulamos un total de T * dt_years años.
    """
    height, width = meta["height"], meta["width"]
    
    # Parámetros
    r         = species_params.get("maxGrowthRate", 0.1)    # tasa anual
    sigma_m   = species_params.get("dispersalKernel", 500)
    init_pop  = species_params.get("initial_population", 0.01)
    T         = species_params.get("timesteps", 20)
    dt        = species_params.get("dt_years", 1.0)         # años por paso
    threshold = init_pop * 0.5

    # Coordenadas del centro
    centroid = polygon_gdf.geometry[0].centroid
    x_cent, y_cent = centroid.x, centroid.y
    tf = meta["transform"]
    col0 = int((x_cent - tf.c) / tf.a)
    row0 = int((tf.f - y_cent) / abs(tf.e))
    
    # Inicialización
    D       = np.zeros((height, width), dtype=np.float32)
    Infested= np.zeros_like(D, dtype=np.uint8)
    if 0 <= row0 < height and 0 <= col0 < width:
        D[row0, col0] = init_pop
        Infested[row0, col0] = 1

    # Kernel de dispersión
    pix_size_m = 100
    sigma_px   = sigma_m / pix_size_m
    rad        = int(3 * sigma_px)
    yv, xv     = np.ogrid[-rad:rad+1, -rad:rad+1]
    kernel     = np.exp(-(xv**2 + yv**2)/(2*sigma_px**2))
    kernel    /= kernel.sum()

    # Carpeta de salida
    sim_folder = os.path.join(tmp_folder, "simulation", region_id)
    os.makedirs(sim_folder, exist_ok=True)
    output_paths = []

    for t in range(T):
        # --- Crecimiento logístico escalado por dt_years ---
        # D[t+1] = D + r * D * (1 - D/K) * dt
        K      = suitability
        growth = r * D * (1 - D/(K + 1e-6)) * dt
        D2     = D + growth

        # --- Dispersión via convolución 2D ---
        dispersed = convolve2d(D2, kernel, mode="same", boundary="fill", fillvalue=0)
        D_next    = D2 + dispersed * suitability * (1 - barrier)

        # --- Infested (umbral dinámico) ---
        Infested = (D_next > threshold).astype(np.uint8)
        D = D_next  # preparar siguiente paso

        # --- Guardar GeoTIFF ---
        out_meta = {
            "driver":    "GTiff",
            "height":    height,
            "width":     width,
            "count":     1,
            "dtype":     rasterio.uint8,
            "crs":       meta["crs"],
            "transform": meta["transform"]
        }
        tif = os.path.join(sim_folder, f"infested_t{t:03d}.tif")
        with rasterio.open(tif, "w", **out_meta) as dst:
            dst.write(Infested, 1)

        # → convertir a COG
        try:
            cog = to_cog(Path(tif))
            os.remove(tif)
            output_paths.append(str(cog))
        except Exception:
            output_paths.append(tif)

    logger.debug(f"Simulación: {T} pasos × {dt} años = {T*dt} años totales")
    return output_paths

# -------------------------------------------------------------------
# 5) Lógica Orquestadora: pipeline para toda la simulación
# -------------------------------------------------------------------
async def generate_simulation_for_region(
    region_id: str,
    species_params: Dict
) -> List[str]:
    logger.debug(f"[SIM] Iniciando simulación para región={region_id} con params={species_params}")
    # 1) Enriquecer parámetros con LLM + GBIF
    common = species_params.get("commonName") or species_params.get("scientificName")
    info = await get_species_info_by_common_name(common)
    species_params.update({
        "scientificName": info["scientificName"],
        "occurrenceCount": info["occurrenceCount"],
    })
    logger.debug(f"[SIM] Nombre científico final: {species_params['scientificName']}, occurrences={info['occurrenceCount']}")
    impact = await assess_impact_with_llm(info, region_id)
    species_params["impactFactor"] = impact
    logger.debug(f"[SIM] Impact factor LLM: {impact}")
    
    # 2) Leer polígono de Firestore
    region_doc = db.collection("regions").document(region_id).get()
    if not region_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada.")
    data = region_doc.to_dict()
    points = data.get("points", [])
    if not points:
        raise ValueError(f"La región {region_id} no tiene puntos definidos.")
    coords = [(pt["longitude"], pt["latitude"]) for pt in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    polygon = Polygon(coords)
    poly_gdf = gpd.GeoDataFrame([{"geometry": polygon}], crs="EPSG:4326")

    # 3) Descargar capas de Firestore /layers/{region_id}
    layers = db.collection("layers").document(region_id).get().to_dict()
    tmp = os.path.join(TMP_ROOT, "sim", region_id)
    os.makedirs(tmp, exist_ok=True)
    def dl(url,key): 
        path = os.path.join(tmp, key + ".tif"); download_raster_from_url(url, path); return path

    local_cop = dl(layers["copernicus_url"], "copernicus")
    local_srtm = dl(layers["srtm_url"], "srtm")
    wc_tifs = {}
    for var in ("bio1","bio5","bio6","bio12","bio15"):
        wc_tifs[var] = dl(layers[f"worldclim_{var}_url"], var)

    # 4) Build suitability & barrier
    suitability, barrier, meta = build_suitability_and_barrier(
        copernicus_tif=local_cop,
        srtm_tif=local_srtm,
        worldclim_tifs=wc_tifs,
        polygon_gdf=poly_gdf,
        tmp_folder=tmp
    )

    # 5) Simulación dinámica con parámetros dinámicos
    timesteps_files = run_dynamic_simulation(
        region_id=region_id,
        species_params=species_params,
        suitability=suitability,
        barrier=barrier,
        meta=meta,
        polygon_gdf=poly_gdf,
        tmp_folder=tmp
    )

    # 6) Subir resultados
    sim_urls = []
    for fpath in timesteps_files:
        blob = bucket.blob(f"simulation/{region_id}/{os.path.basename(fpath)}")
        blob.upload_from_filename(fpath)
        blob.make_public()
        sim_urls.append(blob.public_url)

    # 7) Guardar en Firestore
    db.collection("simulation").document(region_id).set({
        "status": "completed",
        "parameters": species_params,
        "timesteps": sim_urls,
        "completed_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

    logger.debug(f"[SIM] Simulación completa para {region_id}, generados {len(sim_urls)} GeoTIFFs")
    # 8) Cleanup
    shutil.rmtree(tmp, ignore_errors=True)
    return sim_urls