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
# CONFIGURACIÓN: Ajusta según tu proyecto y dónde estén los GeoTIFFs
# -------------------------------------------------------------------

# Firebase Storage bucket (configurado en app/core/firebase.py)
bucket = storage.bucket()

# Carpeta temporal raíz (p.ej. "/tmp" en Linux)
TMP_ROOT = tempfile.gettempdir()

# Directorio donde están almacenados globalmente los GeoTIFFs de WorldClim
WORLDCLIM_DIR = "/mnt/worldclim"

# Mapping de variables bioclimáticas a sus archivos GeoTIFF en WORLDCLIM_DIR
decl_var_files = {
    "bio1": "wc2.1_30s_bio_1.tif",    # Temperatura media anual
    "bio5": "wc2.1_30s_bio_5.tif",    # Temperatura máxima mes más cálido
    "bio6": "wc2.1_30s_bio_6.tif",    # Temperatura mínima mes más frío
    "bio12": "wc2.1_30s_bio_12.tif",  # Precipitación anual
    "bio15": "wc2.1_30s_bio_15.tif"   # Estacionalidad precipitación
}

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
# 2) Utility: recortar GeoTIFF global al polígono
# -------------------------------------------------------------------
def clip_raster_to_polygon(
    src_global_tif: str,
    polygon_gdf: gpd.GeoDataFrame,
    dst_path: str
) -> None:
    """
    Recorta el ráster en src_global_tif usando el polígono y guarda en dst_path.
    """
    with rasterio.open(src_global_tif) as src:
        # Reproyectar el polígono al CRS del ráster si es necesario
        if polygon_gdf.crs.to_string() != src.crs.to_string():
            poly = polygon_gdf.to_crs(src.crs)
        else:
            poly = polygon_gdf

        geoms = [geom for geom in poly["geometry"]]

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
def upload_worldclim_to_storage(local_tif_path: str, region_id: str, var_name: str) -> str:
    """
    Sube el GeoTIFF recortado a Firebase Storage en `worldclim/{region_id}/{filename}`
    y devuelve la URL pública.
    """
    filename = Path(local_tif_path).name  # ej. "worldclim_bio1_clip_<region_id>.tif"
    blob_path = f"worldclim/{region_id}/{filename}"
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_tif_path)
    blob.make_public()
    return blob.public_url

# -------------------------------------------------------------------
# 4) Función principal: pipeline completo para múltiples variables
# -------------------------------------------------------------------
async def generate_worldclim_layers_for_region(region_id: str) -> Dict[str, str]:
    """
    Orquesta la creación de múltiples capas bioclimáticas para la región:
      1. Carga el polígono desde Firestore.
      2. Para cada variable en decl_var_files:
         a. Comprueba existencia del GeoTIFF global.
         b. Recorta al polígono.
         c. Sube a Firebase Storage.
         d. Guarda URL en diccionario.
      3. Almacena todas las URLs en Firestore en 'layers/{region_id}'.
      4. Limpia archivos temporales.
      5. Retorna un diccionario con las URLs: {"worldclim_bio1_url": ..., ...}
    """
    # 1. Leer GeoJSON del polígono (EPSG:4326)
    user_gdf = load_user_polygon_from_firestore(region_id)

    # 2. Preparar carpeta temporal específica
    tmp_folder = os.path.join(TMP_ROOT, "worldclim_vars", region_id)
    os.makedirs(tmp_folder, exist_ok=True)

    urls: Dict[str, str] = {}

    # 3. Iterar sobre cada variable deseada
    for var_name, tif_filename in decl_var_files.items():
        # 3a. Ruta al GeoTIFF global
        src_tif_path = os.path.join(WORLDCLIM_DIR, tif_filename)
        if not os.path.exists(src_tif_path):
            raise FileNotFoundError(f"GeoTIFF de WorldClim para {var_name} no encontrado en '{src_tif_path}'")

        # 3b. Definir ruta local para el clip
        clipped_name = f"worldclim_{var_name}_clip_{region_id}.tif"
        dst_path = os.path.join(tmp_folder, clipped_name)

        # 3c. Recortar
        clip_raster_to_polygon(src_tif_path, user_gdf, dst_path)

        # 3d. Subir a Storage
        url = upload_worldclim_to_storage(dst_path, region_id, var_name)
        urls[f"worldclim_{var_name}_url"] = url

    # 4. Guardar todas las URLs en Firestore (colección 'layers')
    #    Se usa merge=True para no sobrescribir otros campos existentes (p.ej. srtm_url, copernicus_url)
    db.collection("layers").document(region_id).set({**urls, "status": "completed"}, merge=True)

    # 5. Limpiar archivos temporales
    try:
        shutil.rmtree(tmp_folder)
    except Exception:
        pass

    return urls
