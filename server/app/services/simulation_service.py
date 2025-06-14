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
import json
import logging
logger = logging.getLogger(__name__)
from scipy.signal import convolve2d

# -------------------------------------------------------------------
# 0) VARIABLES NEECSARIAS
# -------------------------------------------------------------------
# Pesos genéricos por clase de cobertura (diccionario original)
BASE_CLASS_WEIGHTS = {
    111:0.9, 113:0.8, 112:0.85, 114:0.75, 115:0.8, 116:0.5,
    121:0.7, 123:0.65,122:0.7,124:0.6,125:0.6,126:0.5,
    20:0.4, 30:0.4, 40:0.3, 50:0.0, 60:0.2, 70:0.1, 80:0.0, 90:0.3, 100:0.2
}

# Mapeo de código Copernicus → categoría de hábitat
CODE_TO_CAT = {
    **{c:'forest_closed'  for c in [111,113,112,114,115,116]},
    **{c:'forest_open'    for c in [121,123,122,124,125,126]},
     20:'shrubs',    30:'herbaceous',  40:'cropland',
     50:'urban',     70:'snow_ice',     80:'water',
     90:'wetland',  100:'moss_lichen'
}

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

import json

async def infer_species_traits(
    scientific_name: str,
    gbif_examples: List[Dict],
    common_name: str
) -> Dict:
    """
    Pide al LLM un JSON con:
      • mobility: 'terrestrial'|'aerial'|'aquatic', solo puedes elegir uno de los valores exactos
      • max_dispersal_km: float
      • jump_prob: float
      • altitude_tolerance: [min_m, max_m]
      • habitat_pref: pesos para forest_closed, forest_open, shrubs, herbaceous,
                      cropland, urban, snow_ice, water, wetland, moss_lichen
      • climate_pref: pesos para bio1…bio15
      • climate_tolerance: [min,max] para bio1…bio15
    """
    system = f"""
Eres un biólogo modelador de poblaciones invasoras. Cuando te dé un nombre común de especie,
devuélveme **solo** un JSON con estas claves EXACTAS y sin texto extra de la probabilidad de invasión de la especie en la condicion.

{{
  "mobility": (terrestrial, aerial o aquatic),  # tipo de movilidad de la especie
  "max_dispersal_km": número,            # distancia máxima típica de dispersión anual en km
  "jump_prob": número entre 0 y 1,        # probabilidad anual de colonizar un foco lejano
  "altitude_tolerance": [min_m, max_m],  # tolerancia altitudinal en metros
  "habitat_pref": {{
    "forest_closed": float,
    "forest_open":   float,
    "shrubs":        float,
    "herbaceous":    float,
    "cropland":      float,
    "urban":         float,
    "snow_ice":      float,
    "water":         float,
    "wetland":       float,
    "moss_lichen":   float
  }},
  "climate_pref": {{
    "bio1":  float,   # Annual Mean Temperature (°C)
    "bio5":  float,   # Max Temperature of Warmest Month (°C)
    "bio6":  float,   # Min Temperature of Coldest Month (°C)
    "bio12": float,   # Annual Precipitation (mm)
    "bio15": float    # Precipitation Seasonality (%)
  }},
  "climate_tolerance": {{
    "bio1":  [min, max],
    "bio5":  [min, max],
    "bio6":  [min, max],
    "bio12": [min, max],
    "bio15": [min, max]
  }}
}}

Si no estás seguro de algún valor, pon rangos amplios o pesos neutros (1.0). recuerda que los valores que pongas tienen que ser coherentes a la especie que te doy.
"""
    user =f"""
Nombre comun: {common_name}
Nombre científico: {scientific_name}
Ejemplos GBIF con informacion relevante:
{json.dumps(gbif_examples, indent=2)}
Devuélveme solo el JSON solicitado.
"""
    raw = llama_instruct_generate(
        system_prompt=system,
        user_prompt=user,
        max_new_tokens=400,
        do_sample=False
    )
    logger.debug(f"[SIM] LLM raw traits for '{common_name}' o '{scientific_name}': {raw!r}")
    traits = json.loads(raw)
    logger.debug(f"[SIM] Parsed traits for '{common_name}'o '{scientific_name}': {traits}")
    return traits


async def describe_setup(species_params: Dict) -> str:
    sys = "Eres un ecólogo. Explícame en 2–3 frases por qué se tienen estos valores de parámetros para la simulación."
    usr = json.dumps(species_params, indent=2)
    out = llama_instruct_generate(
        system_prompt=sys,
        user_prompt=usr,
        max_new_tokens=500,
        do_sample=False
    )
    logger.debug(f"[SIM] description: {out!r}")
    return out



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
    tmp_folder: str,
    species_params: Dict
) -> Tuple[np.ndarray, np.ndarray, dict]:
    # — Abrir referencia para metadatos y dimensiones —
    with rasterio.open(copernicus_tif) as ref:
        meta      = ref.meta.copy()
        H, W      = ref.height, ref.width
        transform = ref.transform
        crs       = ref.crs

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
    clim      = {var: _mask_and_resample(path) for var, path in worldclim_tifs.items()}

    # — 1) Pesos dinámicos de cobertura según especie —
    species_pref = species_params.get('habitat_pref', {})
    dynamic_class_weights = {
        code: BASE_CLASS_WEIGHTS[code] * species_pref.get(CODE_TO_CAT.get(code), 1.0)
        for code in BASE_CLASS_WEIGHTS
    }
    s_class = np.full((H, W), 0.1, dtype=np.float32)
    for code, w in dynamic_class_weights.items():
        s_class[class_arr == code] = w

    # — 2) Idoneidad por altitud con tolerancia —
    alt_min, alt_max = species_params.get('altitude_tolerance', (0.0, 3000.0))
    s_el = 1.0 - np.abs((elev_arr - 0.5*(alt_min+alt_max)) / (0.5*(alt_max-alt_min) + 1e-6))
    s_el = np.clip(s_el, 0.0, 1.0)
    mask_alt = (elev_arr >= alt_min) & (elev_arr <= alt_max)
    s_el[~mask_alt] = 0.0

    # — 3) Idoneidad climática (solo BIO1,5,6,12,15) con tolerancias —
    clim_ranges = {
        'bio1':  (-10.0,  45.0),
        'bio5':  (  0.0,  55.0),
        'bio6':  (-20.0,  30.0),
        'bio12': (  0.0,3800.0),
        'bio15': (  0.0, 100.0),
    }
    tol = species_params.get('climate_tolerance', {})
    s_b = {}
    for var, arr in clim.items():
        vmin, vmax = clim_ranges[var]
        s = (arr - vmin) / (vmax - vmin)
        s = np.clip(s, 0.0, 1.0)
        # aplicar tolerancia climática
        tmin, tmax = tol.get(var, (vmin, vmax))
        mask_clim = (arr >= tmin) & (arr <= tmax)
        s *= mask_clim.astype(np.float32)
        s_b[var] = s

    # combinar variables climáticas con pesos estáticos
    s_bioclim = (
        0.25 * s_b['bio1'] +
        0.20 * s_b['bio5'] +
        0.20 * s_b['bio6'] +
        0.25 * s_b['bio12'] +
        0.05 * s_b['bio15']
    )
    s_bioclim = np.clip(s_bioclim, 0.0, 1.0)

    # — 4) Suitability final —
    suitability = 0.3 * s_class + 0.3 * s_el + 0.4 * s_bioclim
    suitability = np.clip(suitability, 0.0, 1.0)

    # — 5) Barrier fija —
    barrier = np.zeros((H, W), dtype=np.float32)
    barrier[class_arr == 80] = 1.0
    barrier[class_arr == 60] = 0.7

    # — 6) Devolver —
    meta.update({
        "height":    H,
        "width":     W,
        "transform": transform,
        "crs":       crs,
        "dtype":     "float32",
    })
    return suitability, barrier, meta


def run_dynamic_simulation(
    region_id: str,
    species_params: Dict,
    suitability: np.ndarray,
    barrier: np.ndarray,
    meta: dict,
    polygon_gdf: gpd.GeoDataFrame,
    tmp_folder: str
) -> List[str]:
    height, width = meta["height"], meta["width"]

    # Parámetros
    r_base     = species_params.get("maxGrowthRate", 0.1)
    sigma_m    = species_params.get("dispersalKernel", 500)
    mobility   = species_params.get("mobility", "terrestrial")
    jump_prob  = species_params.get("jump_prob", 0.0)
    init_pop   = species_params.get("initial_population", 0.01)
    T          = species_params.get("timesteps", 20)
    dt         = species_params.get("dt_years", 1.0)
    threshold  = init_pop * 0.5

    # --- Pre‐cálculo: origen central (siempre el mismo) ---
    centroid = polygon_gdf.geometry[0].centroid
    col0 = int((centroid.x - meta["transform"].c) / meta["transform"].a)
    row0 = int((meta["transform"].f - centroid.y) / abs(meta["transform"].e))

    # ajustar sigma para aves
    if mobility == "aerial":
        sigma_m *= 2.0

    # construir kernel de dispersión
    pix_size_m = 100.0
    sigma_px   = sigma_m / pix_size_m
    rad        = max(int(3 * sigma_px), 1)
    yv, xv     = np.ogrid[-rad:rad+1, -rad:rad+1]
    kernel     = np.exp(-(xv**2 + yv**2) / (2 * sigma_px**2))
    kernel    /= kernel.sum()

    # inicializar D e Infested
    D        = np.zeros((height, width), dtype=np.float32)
    Infested = np.zeros_like(D, dtype=np.uint8)
    if 0 <= row0 < height and 0 <= col0 < width:
        D[row0, col0] = init_pop
        Infested[row0, col0] = 1

    sim_folder = os.path.join(tmp_folder, "simulation", region_id)
    os.makedirs(sim_folder, exist_ok=True)
    output_paths = []
    
    results = []
    prev_infested = np.zeros_like(D, dtype=np.uint8)
    total_pixels = height * width

    for t in range(T):
        # --- crecimiento logístico escalado por suitability y dt ---
        growth = r_base * suitability * D * (1 - D / (suitability + 1e-6)) * dt
        D2     = D + growth

        # --- dispersión local ---
        dispersed = convolve2d(D2, kernel, mode="same", boundary="fill", fillvalue=0)
        D_next    = D2 + dispersed * suitability * (1 - barrier)

        # --- dispersión por salto aéreo (solo para aves) ---
        if mobility == "aerial" and np.random.rand() < jump_prob:
            # tomo siempre la célula central como origen
            max_disp_m  = species_params.get("max_dispersal_km", 10.0) * 1000.0
            max_disp_px = max(int(max_disp_m / pix_size_m), 1)
            # muestreo polar
            r_px   = np.random.rand() * max_disp_px
            theta  = np.random.rand() * 2 * np.pi
            di     = int(r_px * np.sin(theta))
            dj     = int(r_px * np.cos(theta))
            ni, nj = row0 + di, col0 + dj
            if 0 <= ni < height and 0 <= nj < width:
                D_next[ni, nj] += init_pop
                logger.debug(f"[SIM][t={t}] aerial jump to ({ni},{nj})")

        # --- actualizar Infested y D ---
        Infested = (D_next > threshold).astype(np.uint8)
        D        = D_next

        # --- guardar GeoTIFF / COG ---
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
        try:
            cog = to_cog(Path(tif))
            os.remove(tif)
            output_paths.append(str(cog))
        except:
            output_paths.append(tif)

        logger.debug(f"[SIM][t={t}] occupied pixels = {Infested.sum()}, mean growth = {growth.mean():.4f}")
        occupied = int(Infested.sum())
        mean_g   = float(growth.mean())
        total_ab = float(D.sum())
        new_inf  = int(((Infested == 1) & (prev_infested == 0)).sum())
        pct_occ  = occupied / total_pixels * 100.0

        results.append({
            "timestep":       t,
            "occupied_pixels": occupied,
            "percent_occupied": pct_occ,
            "newly_infested": new_inf,
            "mean_growth":     mean_g,
            "total_abundance": total_ab,
        })

        prev_infested = Infested.copy()


    return output_paths, results


# -------------------------------------------------------------------
# 5) Lógica Orquestadora: pipeline para toda la simulación
# -------------------------------------------------------------------
async def generate_simulation_for_region(
    region_id: str,
    species_params: Dict
) -> List[str]:
    logger.debug(f"[SIM] Iniciando simulación para región={region_id} con params={species_params}")

    # 1) Nombre científico + GBIF
    #common = species_params.get("commonName") or species_params.get("scientificName")
    #info = await get_species_info_by_common_name(common)
    #species_params.update({
    #    "scientificName": info["scientificName"],
    #    "occurrenceCount": info["occurrenceCount"],
    #    "gbif_examples": info["examples"],
    #})
    #logger.debug(f"[SIM] GBIF examples: {species_params['gbif_examples']}")

    # 1.5) Traits LLM (mobilidad, tolerancias, prefs…)
   # traits = await infer_species_traits(
    #    species_params["scientificName"],
    #    species_params["gbif_examples"],
    #    species_params["commonName"]
    #)
    #species_params.update(traits)
    #logger.debug(f"[SIM] Traits inferidos: {traits}")

    # 1.6) Impacto LLM
    #impact = await assess_impact_with_llm(info, region_id)
    #species_params["impactFactor"] = impact
    #logger.debug(f"[SIM] Impact factor LLM: {impact}")

    # 2) Leer polígono de Firestore
    region_doc = db.collection("regions").document(region_id).get()
    if not region_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada.")
    data = region_doc.to_dict()
    coords = [(p["longitude"], p["latitude"]) for p in data["points"]]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    poly = Polygon(coords)
    poly_gdf = gpd.GeoDataFrame([{"geometry": poly}], crs="EPSG:4326")

    # 3) Descargar capas
    layers = db.collection("layers").document(region_id).get().to_dict()
    tmp = os.path.join(TMP_ROOT, "sim", region_id)
    os.makedirs(tmp, exist_ok=True)
    def dl(url, name):
        p = os.path.join(tmp, f"{name}.tif")
        download_raster_from_url(url, p)
        return p

    local_cop  = dl(layers["copernicus_url"], "copernicus")
    local_srtm = dl(layers["srtm_url"],      "srtm")
    wc_tifs    = {v: dl(layers[f"worldclim_{v}_url"], v)
                  for v in ("bio1","bio5","bio6","bio12","bio15")}

    # 4) Construir suitability & barrier
    suitability, barrier, meta = build_suitability_and_barrier(
        copernicus_tif=local_cop,
        srtm_tif=local_srtm,
        worldclim_tifs=wc_tifs,
        polygon_gdf=poly_gdf,
        tmp_folder=tmp,
        species_params=species_params
    )

    # 5) Simulación dinámica
    timesteps_files, results = run_dynamic_simulation(
        region_id=region_id,
        species_params=species_params,
        suitability=suitability,
        barrier=barrier,
        meta=meta,
        polygon_gdf=poly_gdf,
        tmp_folder=tmp
    )

    # 6) Describir setup
    #description = await describe_setup(species_params)

    # 7) Subir resultados + guardar en Firestore
    sim_urls = []
    db.collection("simulation").document(region_id).set({
        "status":      "completed",
        "parameters":  species_params,
        "results":     results,
        "completed_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

    for f in timesteps_files:
        blob = bucket.blob(f"simulation/{region_id}/{os.path.basename(f)}")
        blob.upload_from_filename(f)
        blob.make_public()
        sim_urls.append(blob.public_url)

    db.collection("simulation").document(region_id).update({
        "timesteps": sim_urls
    })

    logger.debug(f"[SIM] Simulación completa para {region_id}, {len(sim_urls)} pasos")
    shutil.rmtree(tmp, ignore_errors=True)
    return sim_urls
