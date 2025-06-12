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
    """
    1) Recorta y remuestrea:
       - Discrete-Classification-map (Copernicus LC100, banda única)
       - Elevación (SRTM)
       - Variables WorldClim
    2) Calcula suitability como combinación:
       - s_class  (peso 0.3)
       - s_el     (peso 0.3)
       - s_bioclim(peso 0.4)
    3) barrier = 1.0 si agua (código 80), 0.7 si urbano (código 60), else 0.0
    4) Devuelve (suitability, barrier, meta) para la simulación.
    """

    # --- 1a) Abrir referencia Copernicus para meta y dims ---
    with rasterio.open(copernicus_tif) as ref:
        meta          = ref.meta.copy()
        ref_h, ref_w  = ref.height, ref.width
        ref_tf        = ref.transform
        ref_crs       = ref.crs

    def _mask_and_resample(path: str, band_index: int=1) -> np.ndarray:
        """Recorta al polígono y remuestrea a la grilla de referencia."""
        with rasterio.open(path) as src:
            geoms = [geom for geom in polygon_gdf.to_crs(src.crs).geometry]
            # recorte (no usamos el resultado clippeado aquí)
            _ , _ = mask(src, geoms, crop=True)
            arr = src.read(
                band_index,
                out_shape=(ref_h, ref_w),
                resampling=Resampling.bilinear
            )
        return arr.astype(np.float32)

    # --- 1b) Leer capas esenciales ---
    # 1) Clasificación discreta (códigos 0–200)
    class_arr = _mask_and_resample(copernicus_tif, band_index=1).astype(int)

    # 2) Elevación SRTM
    elev_arr = _mask_and_resample(srtm_tif, band_index=1)

    # 3) WorldClim
    clim_arrays = {
        var: _mask_and_resample(path, band_index=1)
        for var, path in worldclim_tifs.items()
    }

    # --- 2) Definir LUTs y rangos ---
    # Pesos para discrete class (ajusta a tu criterio)
    class_weights = {
        111: 0.9, 113: 0.8, 112: 0.85, 114: 0.75, 115: 0.8,
        116: 0.5, 121: 0.7, 123: 0.65, 122: 0.7, 124: 0.6,
        125: 0.6, 126: 0.5, 20: 0.4, 30: 0.4, 40: 0.3,
        50: 0.0, 60: 0.2, 70: 0.1, 80: 0.0, 90: 0.3, 100: 0.2
    }

    elev_min, elev_max = 0, 3000
    clim_ranges = {
        'bio1':  (-10.0, 45.0),
        'bio5':  ( 0.0, 55.0),
        'bio6':  (-20.0, 30.0),
        'bio12': ( 0.0, 3000.0),
        'bio15': ( 0.0, 100.0),
    }

    def normalize(val, vmin, vmax):
        return max(0.0, min(1.0, (val - vmin) / (vmax - vmin)))

    # --- 3) Inicializar matrices ---
    suitability = np.zeros((ref_h, ref_w), dtype=np.float32)
    barrier     = np.zeros((ref_h, ref_w), dtype=np.float32)

    # --- 4) Bucle píxel a píxel ---
    for i in range(ref_h):
        for j in range(ref_w):
            # 4.1) s_class
            code     = class_arr[i, j]
            s_class  = class_weights.get(code, 0.1)

            # 4.2) s_el (elevación normalizada con pico en altitud media)
            e = elev_arr[i, j]
            if e < elev_min or e > elev_max:
                s_el = 0.0
            else:
                mid = (elev_min + elev_max) / 2
                s_el = 1.0 - abs((e - mid) / ((elev_max - elev_min) / 2))

            # 4.3) s_bioclim
            b1  = clim_arrays['bio1'][i, j]
            b5  = clim_arrays['bio5'][i, j]
            b6  = clim_arrays['bio6'][i, j]
            b12 = clim_arrays['bio12'][i, j]
            b15 = clim_arrays['bio15'][i, j]

            s_b1  = normalize(b1,  *clim_ranges['bio1'])
            s_b5  = normalize(b5,  *clim_ranges['bio5'])
            s_b6  = normalize(b6,  *clim_ranges['bio6'])
            s_b12 = normalize(b12, *clim_ranges['bio12'])
            s_b15 = normalize(b15, *clim_ranges['bio15'])

            temp_range = b5 - b6
            max_range  = clim_ranges['bio5'][1] - clim_ranges['bio6'][0]
            s_range    = max(0.0, min(1.0, temp_range / max_range))

            # Ponderación interna de bioclima
            s_bioclim = (
                0.25 * s_b1 +
                0.20 * s_b5 +
                0.20 * s_b6 +
                0.25 * s_b12 +
                0.05 * s_b15 +
                0.05 * s_range
            )

            # 4.4) combinar sub-scores (pesos suman 1.0)
            s_tot = 0.3 * s_class + 0.3 * s_el + 0.4 * s_bioclim
            suitability[i, j] = min(1.0, max(0.0, s_tot))

            # 4.5) barrier según clase: agua=80 →1.0, urbano=60 →0.7
            if code == 80:
                barrier[i, j] = 1.0
            elif code == 60:
                barrier[i, j] = 0.7
            else:
                barrier[i, j] = 0.0

    # --- 5) Construir meta para re-escritura GeoTIFF ---
    meta.update({
        "height":    ref_h,
        "width":     ref_w,
        "transform": ref_tf,
        "crs":       ref_crs,
        "dtype":     "float32"
    })

    return suitability, barrier, meta
# -------------------------------------------------------------------
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
    Ejecuta la simulación paso a paso y escribe un GeoTIFF por cada t.  
    Parámetros:
      - region_id: identifica la simulación / carpeta destino.
      - species_params: {"scientificName": ..., "maxGrowthRate": r, "dispersalKernel": σ, ...}
      - suitability[i,j]: matriz [0,1].
      - barrier[i,j]: matriz [0,1].
      - meta: meta común de rasterización (transform, crs, height, width).
    Retorna la lista de paths a los GeoTIFF generados (uno por t).
    """
    # 1) Inicializamos estado: D[i,j] y Infested[i,j]
    height = meta["height"]
    width = meta["width"]
    D = np.zeros((height, width), dtype=np.float32)
    Infested = np.zeros((height, width), dtype=np.uint8)

    # 1a) Estado inicial: colocamos infestación en el centroid del polígono
    centroid = polygon_gdf.geometry[0].centroid
    x_cent, y_cent = centroid.x, centroid.y

    # Convertir coordenadas a índices de fila/columna:
    #   row = int((origin_y - y) / pixel_height)
    #   col = int((x - origin_x) / pixel_width)
    transform = meta["transform"]
    origin_x = transform.c
    pixel_x  = transform.a
    origin_y = transform.f
    pixel_y  = transform.e

    col0 = int((x_cent - origin_x) / pixel_x)
    row0 = int((origin_y - y_cent) / abs(pixel_y))
    # Validamos que esté dentro del rango
    if 0 <= row0 < height and 0 <= col0 < width:
        Infested[row0, col0] = 1
        D[row0, col0] = 0.01  # densidad inicial pequeña

    # 2) Parámetros de la especie
    r = species_params.get("maxGrowthRate", 0.1)        # tasa de crecimiento
    sigma = species_params.get("dispersalKernel", 500)  # metros (se usa en kernel)

    # 2a) Construir un “kernel” gaussiano normalizado basado en sigma
    # Supongamos pix_size en metros (aprox) → si tu pixel es 100m, sigma en pixeles = sigma / 100
    pix_size_m = 100  # asumir 100 m/píxel si Copernicus lo define así
    sigma_pix = sigma / pix_size_m

    # Creamos un kernel cuadrado de tamaño p. ej. 5*sigma_pix de lado
    kernel_radius = int(3 * sigma_pix)  # 3σ
    size = 2 * kernel_radius + 1
    yv, xv = np.meshgrid(np.arange(size), np.arange(size))
    y0 = x0 = kernel_radius
    dist2 = (xv - x0)**2 + (yv - y0)**2
    kernel = np.exp(-dist2 / (2 * sigma_pix**2))
    kernel = kernel / np.sum(kernel)  # normalizamos a suma 1

    # 3) Carpeta donde guardaremos cada GeoTIFF del paso t
    sim_folder = os.path.join(tmp_folder, "simulation", region_id)
    os.makedirs(sim_folder, exist_ok=True)

    timestemps_files = []

    # 4) Correr la simulación T pasos
    T = species_params.get("timesteps", 20)  # número de iteraciones
    for t in range(T):
        new_D = D.copy()

        # 4a) Crecimiento local (modelo logístico)
        # D[t+1] = D[t] + r * D[t] * (1 - D[t]/K), con K = suitability[i,j] * C_max
        C_max = 1.0  # densidad de saturación; puedes permitirlo como parámetro
        K = suitability * C_max
        growth = r * D * (1 - (D / (K + 1e-6)))  # +1e-6 para evitar div0
        new_D = np.clip(new_D + growth, 0.0, None)

        # 4b) Dispersión: convolucionamos new_D con el kernel y aplicamos barriers
        from scipy.signal import convolve2d
        dispersed = convolve2d(new_D, kernel, mode="same", boundary="fill", fillvalue=0)
        # Restamos densidad que salió (asumimos proporcional), esto es solo un ejemplo
        immigracion = dispersed * suitability * (1 - barrier)  # reduce donde hay barreras
        new_D = np.clip(new_D + immigracion, 0.0, None)

        # 4c) Actualizamos Infested: si D[i,j] > umbral, marcamos 1
        threshold = 0.01
        Infested = (new_D > threshold).astype(np.uint8)

        # 4d) Preparamos D para el siguiente paso
        D = new_D

        # 4e) Guardar el mapa de Infested como GeoTIFF
        out_meta = {
            "driver": "GTiff",
            "height": height,
            "width": width,
            "count": 1,
            "dtype": rasterio.uint8,
            "crs": meta["crs"],
            "transform": meta["transform"]
        }
        tif_path = os.path.join(sim_folder, f"infested_t{t:03d}.tif")
        with rasterio.open(tif_path, "w", **out_meta) as dst:
            dst.write(Infested, 1)
        # ───── Convertir a Cloud-Optimized GeoTIFF ─────
        try:
            cog_path = to_cog(Path(tif_path))
            os.remove(tif_path)                 # opcional: borrar TIFF clásico
            timestemps_files.append(str(cog_path))
        except Exception as e:
            logger.warning(f"[COG] paso {t}: conversión fallida ({e}); usando TIFF normal.")
            timestemps_files.append(tif_path)

    # 5) Devolver la lista de paths generados
    return timestemps_files

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