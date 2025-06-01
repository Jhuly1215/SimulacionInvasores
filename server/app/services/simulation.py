# app/services/simulation.py

import os
import tempfile
import shutil
import math
from typing import Dict, List
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from firebase_admin import storage
from app.core.firebase import db

# -------------------------------------------------------------------
# CONFIGURACIÓN GENERAL
# -------------------------------------------------------------------

# Bucket de Firebase Storage
bucket = storage.bucket()

# Carpeta temporal raíz para descargar GeoTIFFs y generar resultados
TMP_DIR = tempfile.gettempdir()

# Constantes de simulación (puedes exponerlas como parámetros externos)
DEFAULT_TIMESTEPS = 20            # Cantidad de pasos temporales
DISPERSAL_RADIUS = 1              # Vecindad 4 o 8 (1 píxel a la redonda)
# Ejemplo: kernel de dispersión binomial simple (1 píxel vecino):
DISPERSAL_KERNEL = np.array([
    [0.0, 0.25, 0.0],
    [0.25, 0.0, 0.25],
    [0.0,  0.25,  0.0]
])
# Puedes ajustar el kernel a comportamiento isotrópico:
# DISPERSAL_RADIUS = 1 (vecinos 4), kernel con 0.2 en cruz y 0.05 en diagonales, etc.
# -------------------------------------------------------------------
# 1) Función auxiliar: descargar un GeoTIFF desde una URL de Firebase Storage
# -------------------------------------------------------------------
def download_geotiff_from_url(url: str, local_path: str) -> None:
    """
    Descarga un GeoTIFF o cualquier blob accesible públicamente en Storage
    y lo guarda en local_path.  
    NOTA: Esto asume que la URL es pública o tiene signed_url válido.
    """
    import requests
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
# -------------------------------------------------------------------
# 2) Función auxiliar: abrir un GeoTIFF en disco y regresar (array, metadata)
# -------------------------------------------------------------------
def open_raster_as_array(path: str) -> (np.ndarray, Dict):
    """
    Abre un GeoTIFF con rasterio y regresa un array NumPy de 1 banda
    (si tiene más de 1, toma la primera). También retorna el metadata dict,
    que incluye transform, crs, width, height, dtype, etc.
    """
    with rasterio.open(path) as src:
        # Si tiene varias bandas, solo usamos la primera (banda 1)
        array = src.read(1)    # shape: (height, width)
        meta = src.meta.copy()
    return array, meta
# -------------------------------------------------------------------
# 3) Función auxiliar: re‐resamplear/alinear dos rasters a la misma resolución
# -------------------------------------------------------------------
def resample_rasters_to_match(
    src_array: np.ndarray, src_meta: Dict,
    ref_meta: Dict, resampling_method=Resampling.nearest
) -> np.ndarray:
    """
    Re‐muestra src_array (con metadatos src_meta) para que coincida con
    la grilla (resolution, bounds, width, height y crs) definida en ref_meta.
    Retorna un nuevo array del mismo tamaño que ref_meta['height'] x ref_meta['width'].
    """
    # Creamos un MemoryFile con el array de src para permitir reproyección/resample:
    src_meta_copy = src_meta.copy()
    src_meta_copy.update({
        "count": 1
    })
    memfile = MemoryFile()
    with memfile.open(**src_meta_copy) as dataset:
        dataset.write(src_array, 1)
        # Definimos las características destino
        dst_height = ref_meta["height"]
        dst_width = ref_meta["width"]
        dst_transform = ref_meta["transform"]
        dst_crs = ref_meta["crs"]

        # Creamos un array vacío para el destino
        dst_array = np.zeros((dst_height, dst_width), dtype=src_array.dtype)

        # Hacemos reproyección/resample
        rasterio.warp.reproject(
            source=rasterio.band(dataset, 1),
            destination=dst_array,
            src_transform=src_meta_copy["transform"],
            src_crs=src_meta_copy["crs"],
            dst_transform=dst_transform,
            dst_crs=dst_crs,
            resampling=resampling_method
        )
    return dst_array
# -------------------------------------------------------------------
# 4) Función auxiliar: construir matriz de idoneidad combinando varias capas
# -------------------------------------------------------------------
def build_suitability_matrix(layers_arrays: Dict[str, np.ndarray]) -> np.ndarray:
    """
    Dado un diccionario de arrays NumPy con variables climáticas y ambientales
    (p.ej. {"bio1": array1, "bio5": array5, ...}), regresa una matriz de idoneidad
    (float entre 0 y 1).  
    Estrategia simple: normalizar cada capa (min-max) en [0,1], luego
    tomar promedio ponderado. Puedes ajustar según tu modelo ecológico.
    """
    # 1. Normalizar cada capa
    normalized_layers = []
    for var, arr in layers_arrays.items():
        # Asumimos que los valores faltantes (np.nan) ya están en arr
        valid_mask = ~np.isnan(arr)
        if valid_mask.sum() == 0:
            # Si el arreglo está todo NaN, creamos un arreglo de cero
            norm = np.zeros_like(arr, dtype=float)
        else:
            min_val = np.nanmin(arr)
            max_val = np.nanmax(arr)
            denom = (max_val - min_val) if (max_val != min_val) else 1.0
            norm = (arr - min_val) / denom
            norm[~valid_mask] = 0.0
        normalized_layers.append(norm)

    # 2. Promedio simple de todas las capas normalizadas
    #    (Puedes cambiar a promedio ponderado si deseas dar más peso a ciertas variables)
    if len(normalized_layers) == 0:
        raise ValueError("No se proporcionaron capas para idoneidad.")
    stacked = np.stack(normalized_layers, axis=0)   # shape: (n_layers, H, W)
    suitability = np.nanmean(stacked, axis=0)       # promedio en el eje de capas
    return suitability
# -------------------------------------------------------------------
# 5) Función principal del pipeline de simulación
# -------------------------------------------------------------------
def run_simulation_job(job_id: str, payload: dict):
    """
    Orquesta:
      1) Leer región (geometry + layers URLs) de Firestore.
      2) Descargar y abrir raster por raster; re‐samplear para coincidir.
      3) Construir matriz de idoneidad.
      4) Inicializar matriz de ocupación (ocupados=1, no-ocupados=0).
      5) Bucle temporal de simulación:
         a) Dispersión desde píxeles ocupados a vecinos (usando kernel).
         b) Filtrar por idoneidad: solo píxeles con suitability > threshold pueden colonizarse.
         c) Actualizar matriz ocupación.
         d) Almacenar snapshot: conteo de píxeles ocupados, generar GeoTIFF y subirlo.
      6) Al finalizar, guardar metadata en Firestore (“status”: “completed”, etc.).
    """
    # --- 1) Leer región y capas asociadas desde Firestore ---
    region_id = payload["region_id"]
    # Obtener doc de región (solo si necesitas geometría espacial en la simulación)
    region_doc = db.collection("regions").document(region_id).get()
    if not region_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada")

    # Leer URLs de las capas desde Firestore en 'layers/{region_id}'
    layers_doc = db.collection("layers").document(region_id).get()
    if not layers_doc.exists:
        raise ValueError(f"Las capas para la región {region_id} aún no están generadas")
    layers_data = layers_doc.to_dict()
    # Esperamos que layers_data contenga:
    #   - "srtm_url"
    #   - "copernicus_url"
    #   - "worldclim_bio1_url", "worldclim_bio5_url", "worldclim_bio6_url", "worldclim_bio12_url", "worldclim_bio15_url"
    required_keys = [
        "srtm_url", "copernicus_url",
        "worldclim_bio1_url", "worldclim_bio5_url", "worldclim_bio6_url",
        "worldclim_bio12_url", "worldclim_bio15_url"
    ]
    for key in required_keys:
        if key not in layers_data:
            raise ValueError(f"Falta la capa '{key}' en layers/{region_id}")

    # --- 2) Descargar y abrir cada GeoTIFF, luego re‐samplear para que coincidan ---
    # Elegimos como “referencia” la capa de SRTM (por ejemplo), para que todas las demás
    # se ajusten a su misma resolución y tamaño.
    tmp_region_folder = os.path.join(TMP_DIR, "simulations", job_id)
    os.makedirs(tmp_region_folder, exist_ok=True)

    # 2.1. Descarga SRTM
    srtm_local = os.path.join(tmp_region_folder, "srtm.tif")
    download_geotiff_from_url(layers_data["srtm_url"], srtm_local)
    srtm_arr, srtm_meta = open_raster_as_array(srtm_local)

    # 2.2. Para cada capa WorldClim y Copernicus, descarga y re‐samplear
    layers_arrays = {}
    # Copernicus
    copernicus_local = os.path.join(tmp_region_folder, "copernicus.tif")
    download_geotiff_from_url(layers_data["copernicus_url"], copernicus_local)
    cop_arr, cop_meta = open_raster_as_array(copernicus_local)
    cop_resampled = resample_rasters_to_match(cop_arr, cop_meta, srtm_meta, Resampling.nearest)
    layers_arrays["copernicus"] = cop_resampled

    # WorldClim variables
    wc_vars = ["bio1", "bio5", "bio6", "bio12", "bio15"]
    for var in wc_vars:
        key = f"worldclim_{var}_url"
        local_tif = os.path.join(tmp_region_folder, f"wc_{var}.tif")
        download_geotiff_from_url(layers_data[key], local_tif)
        arr, meta = open_raster_as_array(local_tif)
        arr_resampled = resample_rasters_to_match(arr, meta, srtm_meta, Resampling.nearest)
        layers_arrays[var] = arr_resampled

    # --- 3) Construir matriz de idoneidad ---
    suitability = build_suitability_matrix({
        "bio1": layers_arrays["bio1"],
        "bio5": layers_arrays["bio5"],
        "bio6": layers_arrays["bio6"],
        "bio12": layers_arrays["bio12"],
        "bio15": layers_arrays["bio15"]
        # (Opcional: podrías incorporar copernicus o srtm como parte de idoneidad/barrera)
    })
    # Normalizamos idoneidad entre 0 y 1. Ya lo hace la función build_suitability_matrix.

    # --- 4) Inicializar matriz de ocupación ---
    # Como ejemplo: arrancamos la simulación con todos los píxeles que tienen
    # Copernicus == cierto valor (p.ej. especie presente) como ocupados=1.  
    # Supongamos que tu capa Copernicus usa un valor de categoría 5 para indicar “especie invasora ya establecida”.
    initial_occupancy = np.zeros_like(srtm_arr, dtype=np.uint8)
    invasive_category = 5
    # Marcamos 1 en all píxeles donde copernicus == invasive_category
    initial_occupancy[np.where(layers_arrays["copernicus"] == invasive_category)] = 1

    # Alternativamente, podrías tener un payload["initial_points"] con coordenadas puntuales
    # y traducir esas coordenadas a índices de array para marcar un único foco de invasión.

    # --- 5) Bucle temporal de simulación ---
    # Creamos una carpeta en Storage para subir GeoTIFFs de cada paso
    sim_storage_folder = f"simulations/{job_id}"
    # Documento padre en Firestore para marcar estado “running”
    db.collection("simulations").document(job_id).set({
        "region_id": region_id,
        "status": "running",
        "created_at": db.SERVER_TIMESTAMP
    })

    current_occ = initial_occupancy.copy()
    for t in range(1, DEFAULT_TIMESTEPS + 1):
        # 5a) Dispersión espacial: convolucionar current_occ con kernel
        # Para simplificar, usamos correlación bidimensional.
        # Cada píxel vecino se suma; luego aplicamos un umbral para colonización.
        from scipy.signal import convolve2d
        dispersal_prob = convolve2d(current_occ.astype(float), DISPERSAL_KERNEL, mode="same", boundary="fill", fillvalue=0)

        # 5b) Filtrar por idoneidad: solo píxeles con suitability > 0.5 (umbral)
        # Píxeles ya ocupados siguen ocupados; nuevos píxeles se ocupan si dispersal_prob > 0 y suitability alta.
        new_occ = current_occ.copy()
        colonizable = (dispersal_prob > 0) & (suitability > 0.5) & (current_occ == 0)
        new_occ[ colonizable ] = 1

        # 5c) Actualizar current_occ
        current_occ = new_occ

        # 5d) Guardar resultados de este paso
        #   - Conteo de píxeles ocupados
        occupied_count = int(np.sum(current_occ))
        #   - Área invadida: si cada píxel es, por ejemplo, 30m × 30m = 900 m² = 0.0009 km²,
        #     entonces: area_km2 = occupied_count * 0.0009
        pixel_area_km2 = abs(srtm_meta["transform"][0] * srtm_meta["transform"][4]) / 1e6
        area_invaded = occupied_count * pixel_area_km2

        #   - Crear un GeoTIFF temporal para current_occ
        step_tif = os.path.join(tmp_region_folder, f"timestep_{t:02d}.tif")
        sim_meta = srtm_meta.copy()
        sim_meta.update({
            "driver": "GTiff",
            "dtype": rasterio.uint8,
            "count": 1
        })
        with rasterio.open(step_tif, "w", **sim_meta) as dst:
            dst.write(current_occ, 1)

        #   - Subir ese GeoTIFF a Firebase Storage: path “simulations/{job_id}/timestep_XX.tif”
        blob_path = f"{sim_storage_folder}/timestep_{t:02d}.tif"
        blob = bucket.blob(blob_path)
        blob.upload_from_filename(step_tif)
        blob.make_public()
        step_url = blob.public_url

        #   - Guardar documento en Firestore: simulations/{job_id}/steps/{t}
        db.collection("simulations").document(job_id).collection("steps").document(f"{t:02d}").set({
            "t": t,
            "occupied_count": occupied_count,
            "area_invadida_km2": area_invaded,
            "geo_tif_url": step_url,
            "timestamp": db.SERVER_TIMESTAMP
        })

        #   - Eliminar el archivo temporal para ahorrar espacio
        os.remove(step_tif)

    # --- 6) Marcar simulación como completada ---
    db.collection("simulations").document(job_id).update({
        "status": "completed",
        "timesteps": DEFAULT_TIMESTEPS,
        "results_storage_folder": sim_storage_folder
    })

    # --- 7) Limpiar carpeta temporal ---
    try:
        shutil.rmtree(tmp_region_folder)
    except Exception:
        pass
