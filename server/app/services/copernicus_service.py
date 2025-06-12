#app/services/copernicus_service.py
import os
import shutil
import tempfile
from pathlib import Path
import logging

import geopandas as gpd
from shapely.geometry import Polygon
import rasterio
from rasterio.mask import mask
from app.utils.cog import to_cog
from firebase_admin import storage
from app.core.firebase import db

# -------------------------------------------------------------------
# CONFIGURACIÓN
# -------------------------------------------------------------------

bucket = storage.bucket()
TMP_ROOT = tempfile.gettempdir()

# A partir de la ubicación de este archivo, subimos dos niveles y entramos en server/
BASE_DIR = Path(__file__).resolve().parents[2]   # Raíz del proyecto (…/Invasores)
COPERNICUS_GLOBAL_TIF = BASE_DIR / "resources"/ "copernicus" / "PROBAV_LC100_global_v3.0.1_2019-nrt_Discrete-Classification-map_EPSG-4326.tif"


# -------------------------------------------------------------------
# 1) Utility: leer polígono (lista de puntos) desde Firestore
# -------------------------------------------------------------------
def load_user_polygon_from_firestore(region_id: str) -> gpd.GeoDataFrame:
    """
    Lee 'regions/{region_id}' que debe contener:
      {
        "name": "...",
        "points": [
          {"latitude": ..., "longitude": ...},
          ...
        ]
      }
    Construye un Polygon EPSG:4326 y lo devuelve como GeoDataFrame.
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

    # Cerramos el polígono si no está cerrado
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    polygon = Polygon(coords)
    gdf = gpd.GeoDataFrame([{"geometry": polygon}], crs="EPSG:4326")
    return gdf


# -------------------------------------------------------------------
# 2) Utility: recortar el GeoTIFF global al polígono del usuario
# -------------------------------------------------------------------
def clip_local_copernicus_to_polygon(
    src_global_tif: Path,
    polygon_gdf: gpd.GeoDataFrame,
    dst_path: str
) -> None:
    """
    Recorta el GeoTIFF global de Copernicus (Discrete-Classification-map 2019)
    usando el polígono y escribe un nuevo GeoTIFF en dst_path.
    """
    with rasterio.open(str(src_global_tif)) as src:
        # Asegurarse de que el polígono esté en el mismo CRS que el ráster
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
def upload_copernicus_to_storage(local_tif_path: str, region_id: str) -> str:
    """
    Sube el GeoTIFF recortado a Firebase Storage en "copernicus/{region_id}/"
    y devuelve la URL pública.
    """
    filename = Path(local_tif_path).name
    blob_path = f"copernicus/{region_id}/{filename}"
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_tif_path)
    blob.make_public()
    return blob.public_url


# -------------------------------------------------------------------
# 4) Función principal: pipeline completo usando el TIFF local
# -------------------------------------------------------------------
async def generate_copernicus_for_region(region_id: str) -> str:
    """
    1. Carga polígono (lista de puntos) de Firestore.
    2. Usa el GeoTIFF global local para recortarlo al polígono.
    3. Guarda localmente el GeoTIFF recortado.
    4. Sube a Firebase Storage y guarda 'copernicus_url' en Firestore.
    5. Limpia archivos temporales y retorna la URL pública.
    """
    # 1) Leer polígono en EPSG:4326
    user_gdf = load_user_polygon_from_firestore(region_id)

    # 2) Verificar que exista el GeoTIFF global
    if not COPERNICUS_GLOBAL_TIF.exists():
        raise FileNotFoundError(f"GeoTIFF global de Copernicus no encontrado en '{COPERNICUS_GLOBAL_TIF}'")

    # 3) Carpeta temporal para guardar el TIFF recortado
    tmp_folder = os.path.join(TMP_ROOT, "copernicus_local_clips", region_id)
    os.makedirs(tmp_folder, exist_ok=True)
    clipped_tif_path = os.path.join(tmp_folder, f"copernicus_clip_{region_id}.tif")

    logging.getLogger("uvicorn.error").info(
        f"Copernicus local ─ recortando {COPERNICUS_GLOBAL_TIF} con el polígono de la región {region_id}"
    )

    # 4) Recortar localmente
    clip_local_copernicus_to_polygon(
        COPERNICUS_GLOBAL_TIF,
        user_gdf,
        clipped_tif_path
    )
    #4.1) ⇢ Convertir a Cloud-Optimized GeoTIFF (COG)
    try:
        cog_path = to_cog(Path(clipped_tif_path))
        path_to_upload = str(cog_path)     # subimos el ._cog.tif
    except Exception as e:
        logging.getLogger("uvicorn.error").warning(
            f"[COG] Falló la conversión a COG ({e}), se usará el TIFF normal."
        )
        path_to_upload = clipped_tif_path

    # 5) Subir el GeoTIFF recortado a Firebase Storage
    copernicus_url = upload_copernicus_to_storage(path_to_upload, region_id)
    db.collection("layers").document(region_id).set(
        {"copernicus_url": copernicus_url},
        merge=True
    )

    # 6) Limpiar archivos temporales
    try:
        shutil.rmtree(tmp_folder)
    except Exception:
        pass

    return copernicus_url
