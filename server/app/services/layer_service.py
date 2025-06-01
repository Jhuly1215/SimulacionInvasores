#File: layer_service.py
# server/app/services/layer_service.py
import os
from pathlib import Path
from typing import Dict

import geopandas as gpd
from shapely.geometry import shape
import rasterio
from rasterio.mask import mask

from firebase_admin import storage
from app.core.firebase import db

# Firebase Storage bucket
bucket = storage.bucket()    

# --- Utility Functions ---
def load_user_polygon(geojson: dict) -> gpd.GeoDataFrame:
    """
    Convierte un GeoJSON de Firestore en un GeoDataFrame en EPSG:4326.
    """
    # Extraer geometría (suponiendo FeatureCollection)
    feature = geojson.get("features", [])[0]
    geom = shape(feature["geometry"])
    gdf = gpd.GeoDataFrame([{"geometry": geom}], crs="EPSG:4326")
    return gdf

def clip_raster_to_polygon(
    src_path: str,
    polygon_gdf: gpd.GeoDataFrame,
    dst_path: str
) -> None:
    """
    Recorta el ráster en src_path según el polígono y guarda el resultado en dst_path.
    """
    with rasterio.open(src_path) as src:
        # Reproyectar polígono al CRS del ráster
        poly = polygon_gdf.to_crs(src.crs)
        geoms = [feature for feature in poly["geometry"]]

        # Aplicar máscara y recorte
        out_image, out_transform = mask(src, geoms, crop=True)
        out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })

        # Crear directorio si no existe
        Path(dst_path).parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(dst_path, "w", **out_meta) as dst:
            dst.write(out_image)

def upload_to_storage(local_path: str, blob_path: str) -> str:
    """
    Sube un archivo local a Firebase Storage y devuelve la URL pública.
    """
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_path)
    # Hacer público o usar URL firmada según configuración
    blob.make_public()
    return blob.public_url

async def create_layer_urls(region_id: str) -> Dict[str, str]:
    """
    Pipeline completo: recorta rásteres al polígono de usuario y sube a Storage.
    Devuelve un diccionario con las URLs de cada capa.
    """
    # 1. Leer polígono de Firestore
    reg_ref = db.collection("regions").document(region_id)
    reg_doc = reg_ref.get()
    if not reg_doc.exists:
        raise ValueError(f"Región {region_id} no encontrada")
    geojson = reg_doc.to_dict().get("geojson")

    # 2. Preparar GeoDataFrame
    user_gdf = load_user_polygon(geojson)

    # 3. Paths temporales
    tmp_dir = f"/tmp/regions/{region_id}"
    os.makedirs(tmp_dir, exist_ok=True)

    # 4. Origen de rásteres (ajusta rutas según tu sistema)
    datasets = {
        "srtm": "/mnt/srtm/srtm_mosaic.tif",
        "wc_bio1": "/mnt/worldclim/wc2.1_30s_bio_1.tif",
        "copernicus_lc": "/mnt/copernicus/cgls_landcover_global.tif"
    }

    urls: Dict[str, str] = {}

    # 5. Recorte y subida de cada capa
    for key, src in datasets.items():
        dst_local = os.path.join(tmp_dir, f"{key}_clipped.tif")
        clip_raster_to_polygon(src, user_gdf, dst_local)

        blob_path = f"layers/{region_id}/{key}_clipped.tif"
        urls[key] = upload_to_storage(dst_local, blob_path)

    # 6. Guardar metadatos en Firestore
    layer_ref = db.collection("layers").document(region_id)
    layer_ref.set({"status": "completed", **urls})

    return urls

async def get_layer_urls(region_id: str):
    # Suponiendo que guardas las URLs o paths en Firestore
    layers_doc = db.collection("layers").document(region_id).get()
    if not layers_doc.exists:
        # Lógica para desencadenar procesamiento y guardar en Firestore
        raise ValueError("Capas aún no generadas")
    return layers_doc.to_dict()