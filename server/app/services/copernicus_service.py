# app/services/copernicus_service.py

import os
import shutil
import tempfile
from pathlib import Path
from typing import Dict

import geopandas as gpd
from shapely.geometry import shape
import rasterio
from rasterio.mask import mask

from firebase_admin import storage
from app.core.firebase import db

# -------------------------------------------------------------------
# CONFIGURACIÓN: Ajusta según tu proyecto y dónde tengas el ráster
# -------------------------------------------------------------------

# Nombre del bucket en Firebase Storage (configurado en app/core/firebase.py)
bucket = storage.bucket()

# Carpeta temporal raíz (p.ej. "/tmp" en Linux)
TMP_ROOT = tempfile.gettempdir()

# Path local al GeoTIFF global de Copernicus Land Cover (ajusta si lo tienes en otra ruta)
# Por ejemplo, podría ser algo como "/mnt/copernicus/cgls_landcover_global.tif"
COPERNICUS_GLOBAL_TIF = "/mnt/copernicus/cgls_landcover_global.tif"


# -------------------------------------------------------------------
# 1) Utility: cargar GeoJSON del polígono desde Firestore
# -------------------------------------------------------------------
def load_user_polygon_from_firestore(region_id: str) -> gpd.GeoDataFrame:
    """
    Recupera el GeoJSON guardado en Firestore en 'regions/{region_id}'
    y lo convierte a un GeoDataFrame en EPSG:4326.
    """
    reg_doc = db.collection("regions").document(region_id).get()
    if not reg_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada en Firestore.")

    geojson = reg_doc.to_dict().get("geojson")
    if not geojson or "features" not in geojson or len(geojson["features"]) == 0:
        raise ValueError(f"GeoJSON inválido para la región {region_id}.")

    feature = geojson["features"][0]
    geom = shape(feature["geometry"])
    gdf = gpd.GeoDataFrame([{"geometry": geom}], crs="EPSG:4326")
    return gdf


# -------------------------------------------------------------------
# 2) Utility: recortar el ráster global al polígono del usuario
# -------------------------------------------------------------------
def clip_copernicus_to_polygon(
    src_global_tif: str,
    polygon_gdf: gpd.GeoDataFrame,
    dst_path: str
) -> None:
    """
    Recorta el ráster global de Copernicus (GeoTIFF) usando el polígono y guarda en dst_path.
    """
    with rasterio.open(src_global_tif) as src:
        # Asegurarse de que el polígono está en el mismo CRS que el ráster
        if polygon_gdf.crs.to_string() != src.crs.to_string():
            poly = polygon_gdf.to_crs(src.crs)
        else:
            poly = polygon_gdf

        geoms = [geom for geom in poly["geometry"]]

        # Aplica máscara (clip + rellena con nodata fuera del polígono)
        out_image, out_transform = mask(src, geoms, crop=True)
        out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })

        Path(dst_path).parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(dst_path, "w", **out_meta) as dst:
            dst.write(out_image)


# -------------------------------------------------------------------
# 3) Utility: subir GeoTIFF recortado a Firebase Storage
# -------------------------------------------------------------------
def upload_copernicus_to_storage(local_tif_path: str, region_id: str) -> str:
    """
    Sube el GeoTIFF recortado a Firebase Storage en 'copernicus/{region_id}/'
    y devuelve la URL pública.
    """
    filename = Path(local_tif_path).name  # ej. "copernicus_clip_abc123.tif"
    blob_path = f"copernicus/{region_id}/{filename}"
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_tif_path)
    blob.make_public()
    return blob.public_url


# -------------------------------------------------------------------
# 4) Función principal: pipeline completo para Copernicus
# -------------------------------------------------------------------
async def generate_copernicus_for_region(region_id: str) -> str:
    """
    Orquesta el pipeline:
      1. Carga el polígono desde Firestore.
      2. Recorta el ráster global de Copernicus al polígono.
      3. Guarda localmente el GeoTIFF recortado.
      4. Sube a Firebase Storage y obtiene URL pública.
      5. Almacena la URL en Firestore en 'layers/{region_id}' (campo 'copernicus_url').
      6. Limpia archivos temporales y retorna la URL.
    """
    # 1. Leer polígono en EPSG:4326
    user_gdf = load_user_polygon_from_firestore(region_id)

    # 2. Crear ruta temporal para el GeoTIFF recortado
    tmp_folder = os.path.join(TMP_ROOT, "copernicus_tiles", region_id)
    os.makedirs(tmp_folder, exist_ok=True)
    clipped_tif_path = os.path.join(tmp_folder, f"copernicus_clip_{region_id}.tif")

    # 3. Recortar el ráster global de Copernicus
    if not os.path.exists(COPERNICUS_GLOBAL_TIF):
        raise FileNotFoundError(f"GeoTIFF global de Copernicus no encontrado en '{COPERNICUS_GLOBAL_TIF}'")
    clip_copernicus_to_polygon(COPERNICUS_GLOBAL_TIF, user_gdf, clipped_tif_path)

    # 4. Subir el GeoTIFF recortado a Firebase Storage
    copernicus_url = upload_copernicus_to_storage(clipped_tif_path, region_id)

    # 5. Guardar metadatos en Firestore (colección 'layers')
    db.collection("layers").document(region_id).set({
        "copernicus_url": copernicus_url,
        "status": "completed"
    }, merge=True)

    # 6. Limpiar archivos temporales (opcional pero recomendable)
    try:
        shutil.rmtree(tmp_folder)
    except Exception:
        pass

    return copernicus_url
