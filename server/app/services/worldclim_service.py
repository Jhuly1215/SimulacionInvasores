# File: server/app/services/worldclim_service.py

import os
import shutil
import tempfile
from pathlib import Path
from typing import Dict
from app.utils.cog import to_cog 
import geopandas as gpd
from shapely.geometry import Polygon
import rasterio
from rasterio.mask import mask
from firebase_admin import storage
from app.core.firebase import db
import logging
# -------------------------------------------------------------------
# CONFIGURACIÓN: Ajusta según tu proyecto y dónde estén los GeoTIFFs
# -------------------------------------------------------------------


bucket = storage.bucket()
TMP_ROOT = tempfile.gettempdir()
BASE_DIR = Path(__file__).resolve().parents[2]
WORLDCLIM_DIR = BASE_DIR / "resources" / "worldclim"

# Mapping de variables bioclimáticas a sus archivos GeoTIFF
decl_var_files = {
    "bio1":  "wc2.1_30s_bio_1.tif",    # Temperatura media anual
    "bio5":  "wc2.1_30s_bio_5.tif",    # Temperatura máxima mes más cálido
    "bio6":  "wc2.1_30s_bio_6.tif",    # Temperatura mínima mes más frío
    "bio12": "wc2.1_30s_bio_12.tif",   # Precipitación anual
    "bio15": "wc2.1_30s_bio_15.tif"    # Estacionalidad precipitación
}


# -------------------------------------------------------------------
# 1) Utility: cargar GeoJSON del polígono desde Firestore
# -------------------------------------------------------------------
def load_user_polygon_from_firestore(region_id: str) -> gpd.GeoDataFrame:
    """
    Recupera del documento en Firestore:
       {
         "name": "...",
         "points": [
           {"latitude": -19.0447, "longitude": -65.2570},
           {"latitude": -19.0420, "longitude": -65.2535},
           {"latitude": -19.0461, "longitude": -65.2527},
           …
         ]
       }
    Construye un Polygon a partir de esos puntos (lon, lat)
    y retorna un GeoDataFrame EPSG:4326.
    """
    reg_doc = db.collection("regions").document(region_id).get()
    if not reg_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada en Firestore.")

    data = reg_doc.to_dict()
    points = data.get("points")
    if not points or not isinstance(points, list):
        raise ValueError(f"El campo 'points' es inválido o inexistente para la región {region_id}.")

    coords = []
    for pt in points:
        lat = pt.get("latitude")
        lon = pt.get("longitude")
        if lat is None or lon is None:
            raise ValueError(f"Punto inválido en 'points' de la región {region_id}: {pt}")
        coords.append((lon, lat))

    # Asegurarse de cerrar el polígono:
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    polygon = Polygon(coords)
    gdf = gpd.GeoDataFrame([{"geometry": polygon}], crs="EPSG:4326")
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
        # 3a. Ruta al GeoTIFF global (dentro de resources/worldclim)
        src_tif_path = WORLDCLIM_DIR / tif_filename
        if not src_tif_path.exists():
            raise FileNotFoundError(
                f"GeoTIFF de WorldClim para {var_name} no encontrado en '{src_tif_path}'"
            )

        # 3b. Definir ruta local para el archivo recortado
        clipped_name = f"worldclim_{var_name}_clip_{region_id}.tif"
        dst_path = os.path.join(tmp_folder, clipped_name)

        # 3c. Recortar con la función utilitaria
        clip_raster_to_polygon(str(src_tif_path), user_gdf, dst_path)

        #3c.1  ⇢ Convertir a Cloud-Optimized GeoTIFF
        try:
            cog_path = to_cog(Path(dst_path))
            path_to_upload = str(cog_path)
        except Exception as e:
            logging.getLogger("uvicorn.error").warning(
                f"[COG] {var_name}: conversión fallida ({e}); subiendo el TIFF normal."
            )
            path_to_upload = dst_path

        # 3d. Subir el recorte a Storage y obtener URL pública
        url = upload_worldclim_to_storage(path_to_upload, region_id, var_name)
        urls[f"worldclim_{var_name}_url"] = url

    # 4. Guardar todas las URLs en Firestore (colección 'layers/{region_id}')
    #    Se usa merge=True para no sobrescribir otros campos existentes
    db.collection("layers").document(region_id).set(urls, merge=True)

    # 5. Limpiar archivos temporales
    try:
        shutil.rmtree(tmp_folder)
    except Exception:
        pass

    return urls
