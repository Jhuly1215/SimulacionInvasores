# app/services/srtm_service.py

import os
import tempfile
import shutil
import math
import requests
import gzip
import shutil
from pathlib import Path
from typing import List

import geopandas as gpd
from shapely.geometry import shape
import rasterio
from rasterio.merge import merge
from rasterio.mask import mask
from rasterio.io import MemoryFile

from firebase_admin import storage
from app.core.firebase import db

# -------------------------------------------------------------------
# CONFIGURACIÓN
# -------------------------------------------------------------------

# Obtenemos el bucket de Firebase Storage (configurado en app/core/firebase.py)
bucket = storage.bucket()

# Carpeta temporal raíz ("/tmp" en Linux)
TMP_ROOT = tempfile.gettempdir()

# URL base para descargar SRTM v4.1 en formato .hgt.gz (AWS Public Data)
SRTM_BASE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/skadi"


# -------------------------------------------------------------------
# 1) Utility: cargar GeoJSON del polígono desde Firestore
# -------------------------------------------------------------------
def load_user_polygon_from_firestore(region_id: str) -> gpd.GeoDataFrame:
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
# 2) Utility: calcular bounding box en EPSG:4326
# -------------------------------------------------------------------
def get_bounding_box(gdf: gpd.GeoDataFrame) -> List[float]:
    if gdf.crs.to_string() != "EPSG:4326":
        gdf_wgs = gdf.to_crs("EPSG:4326")
    else:
        gdf_wgs = gdf

    minx, miny, maxx, maxy = gdf_wgs.total_bounds
    return [minx, miny, maxx, maxy]


# -------------------------------------------------------------------
# 3) Utility: generar lista de nombres de tiles SRTM (1°×1°)
# -------------------------------------------------------------------
def latLon_to_tile_names(
    min_lon: float, min_lat: float, max_lon: float, max_lat: float
) -> List[str]:
    tile_names = []

    lat_start = math.floor(min_lat)
    lat_end = math.ceil(max_lat) - 1
    lon_start = math.floor(min_lon)
    lon_end = math.ceil(max_lon) - 1

    for lat in range(lat_start, lat_end + 1):
        for lon in range(lon_start, lon_end + 1):
            # Prefijo de latitud
            if lat >= 0:
                lat_prefix = f"N{abs(lat):02d}"
            else:
                lat_prefix = f"S{abs(lat):02d}"
            # Prefijo de longitud
            if lon >= 0:
                lon_prefix = f"E{abs(lon):03d}"
            else:
                lon_prefix = f"W{abs(lon):03d}"

            tile_names.append(lat_prefix + lon_prefix)

    return tile_names


# -------------------------------------------------------------------
# 4) Utility: descargar y descomprimir un .hgt.gz
# -------------------------------------------------------------------
def download_and_extract_srtm_tile(tile_name: str, dest_folder: str) -> str:
    """
    Descarga <tile_name>.hgt.gz desde S3 y lo descomprime a <tile_name>.hgt.
    Devuelve la ruta local al archivo .hgt.
    """
    gz_filename = f"{tile_name}.hgt.gz"
    url = f"{SRTM_BASE_URL}/{gz_filename}"

    local_gz_path = os.path.join(dest_folder, gz_filename)
    local_hgt_path = os.path.join(dest_folder, f"{tile_name}.hgt")

    # Si ya existe el .hgt descomprimido, no volvemos a descargar
    if not os.path.exists(local_hgt_path):
        # 4.1. Descargar el .gz
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(local_gz_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        # 4.2. Descomprimir el .gz a .hgt
        with gzip.open(local_gz_path, "rb") as gz_in, open(local_hgt_path, "wb") as out_f:
            shutil.copyfileobj(gz_in, out_f)

        # 4.3. Borrar el .gz
        os.remove(local_gz_path)

    return local_hgt_path


# -------------------------------------------------------------------
# 5) Utility: crear un mosaico en memoria a partir de varios .hgt
# -------------------------------------------------------------------
def build_srtm_mosaic(hgt_paths: List[str]) -> rasterio.io.DatasetReader:
    """
    Dado un listado de rutas a archivos .hgt (SRTM), crea un mosaico in‐memory
    y retorna un DatasetReader listo para recortar.
    """
    sources = [rasterio.open(p) for p in hgt_paths]
    mosaic_array, mosaic_transform = merge(sources)

    out_meta = sources[0].meta.copy()
    out_meta.update({
        "height": mosaic_array.shape[1],
        "width": mosaic_array.shape[2],
        "transform": mosaic_transform,
        "driver": "GTiff",
        "dtype": mosaic_array.dtype
    })

    # Escribimos el mosaico en un MemoryFile para no usar disco
    memfile = MemoryFile()
    with memfile.open(**out_meta) as dest:
        dest.write(mosaic_array)

    # Retornamos un reader que apunta al contenido en memoria
    return memfile.open()


# -------------------------------------------------------------------
# 6) Utility: recortar ráster SRTM (mosaico) al polígono del usuario
# -------------------------------------------------------------------
def clip_mosaic_to_polygon(
    mosaic_reader: rasterio.io.DatasetReader,
    polygon_gdf: gpd.GeoDataFrame,
    dst_path: str
) -> None:
    """
    Recorta el DatasetReader del mosaico usando el GeoDataFrame del polígono
    y escribe el GeoTIFF en dst_path.
    """
    # Asegurarse de que la proyección coincide
    poly = polygon_gdf.to_crs(mosaic_reader.crs)
    geoms = [geom for geom in poly["geometry"]]

    out_image, out_transform = mask(mosaic_reader, geoms, crop=True)
    out_meta = mosaic_reader.meta.copy()
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
# 7) Utility: subir GeoTIFF recortado a Firebase Storage
# -------------------------------------------------------------------
def upload_srtm_to_storage(local_tif_path: str, region_id: str) -> str:
    """
    Sube el GeoTIFF recortado a Storage en la ruta `srtm/{region_id}/{nombre}.tif`
    y devuelve la URL pública.
    """
    filename = Path(local_tif_path).name  # ej. "srtm_clip_abc123.tif"
    blob_path = f"srtm/{region_id}/{filename}"

    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_tif_path)
    blob.make_public()
    return blob.public_url


# -------------------------------------------------------------------
# 8) Función principal: pipeline completo para SRTM
# -------------------------------------------------------------------
async def generate_srtm_for_region(region_id: str) -> str:
    """
    Llama a cada paso:
      1. Cargar polígono de Firestore (EPSG:4326).
      2. Calcular bounding box y tiles necesarios.
      3. Descargar + descomprimir cada tile .hgt (1°×1°).
      4. Mosaicar en memoria.
      5. Recortar al polígono y crear GeoTIFF final.
      6. Subir ese GeoTIFF final a Firebase Storage.
      7. Guardar la URL resultante en Firestore (en `layers/{region_id}`).
      8. Limpiar archivos temporales.
      9. Retornar la URL pública.
    """
    # 8.1. Leer polígono en EPSG:4326
    user_gdf = load_user_polygon_from_firestore(region_id)
    min_lon, min_lat, max_lon, max_lat = get_bounding_box(user_gdf)

    # 8.2. Calcular tiles SRTM necesarias
    tiles = latLon_to_tile_names(min_lon, min_lat, max_lon, max_lat)
    if not tiles:
        raise ValueError("No se encontraron tiles SRTM para esa región.")

    # 8.3. Carpeta temporal para almacenar .hgt
    tmp_folder = os.path.join(TMP_ROOT, "srtm_tiles", region_id)
    os.makedirs(tmp_folder, exist_ok=True)

    # 8.4. Descargar + descomprimir cada .hgt
    hgt_paths = []
    for tile in tiles:
        try:
            hgt_path = download_and_extract_srtm_tile(tile, tmp_folder)
            hgt_paths.append(hgt_path)
        except Exception as e:
            raise RuntimeError(f"Error descargando tile {tile}: {e}")

    if not hgt_paths:
        raise RuntimeError("No se descargó ningún tile SRTM correctamente.")

    # 8.5. Mosaico en memoria
    mosaic_reader = build_srtm_mosaic(hgt_paths)

    # 8.6. Recortar con el polígono
    clipped_tif_path = os.path.join(TMP_ROOT, f"srtm_clip_{region_id}.tif")
    clip_mosaic_to_polygon(mosaic_reader, user_gdf, clipped_tif_path)

    # 8.7. Subir a Firebase Storage
    srtm_url = upload_srtm_to_storage(clipped_tif_path, region_id)

    # 8.8. Guardar metadatos en Firestore (colección "layers")
    db.collection("layers").document(region_id).set({
        "srtm_url": srtm_url,
        "status": "completed"
    })

    # 8.9. Limpiar archivos temporales
    try:
        shutil.rmtree(tmp_folder)
        os.remove(clipped_tif_path)
    except Exception:
        pass

    return srtm_url
