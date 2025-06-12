# server/app/services/srtm_service.py

import os
import tempfile
import shutil
import math
import requests
import gzip
from pathlib import Path
from typing import List
from app.utils.cog import to_cog
import geopandas as gpd
from shapely.geometry import Polygon
import rasterio
from rasterio.merge import merge
from rasterio.mask import mask
from rasterio.io import MemoryFile
import logging
from firebase_admin import storage
from app.core.firebase import db

# -------------------------------------------------------------------
# CONFIGURACIÓN
# -------------------------------------------------------------------

bucket = storage.bucket()
TMP_ROOT = tempfile.gettempdir()
SRTM_BASE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/skadi"


# -------------------------------------------------------------------
# 1) Utility: cargar polígono a partir de `points` en Firestore
# -------------------------------------------------------------------
def load_user_polygon_from_firestore(region_id: str) -> gpd.GeoDataFrame:
    """
    Lee regions/{region_id} que ahora contiene:
      {
        "name": "...",
        "points": [ {latitude, longitude}, … ]
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

    # Si el polígono no está cerrado, cerrarlo
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    polygon = Polygon(coords)
    gdf = gpd.GeoDataFrame([{"geometry": polygon}], crs="EPSG:4326")
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
            lat_prefix = f"N{abs(lat):02d}" if lat >= 0 else f"S{abs(lat):02d}"
            lon_prefix = f"E{abs(lon):03d}" if lon >= 0 else f"W{abs(lon):03d}"
            tile_names.append(lat_prefix + lon_prefix)

    return tile_names


# -------------------------------------------------------------------
# 4) Utility: descargar y descomprimir un .hgt.gz
# -------------------------------------------------------------------
def download_and_extract_srtm_tile(tile_name: str, dest_folder: str) -> str:
    """
    Descarga <tile_name>.hgt.gz desde S3 y lo descomprime a <tile_name>.hgt.
    Si retorna None significa que no existía (404). 
    Devuelve la ruta local al archivo .hgt si existía, o None si recibimos 404.
    """
    # tile_name ej: "S20W066"
    lat_dir     = tile_name[:3]            # "S20"
    gz_filename = f"{tile_name}.hgt.gz"     # "***.hgt.gz", ej: "S20W066.hgt.gz"
    url         = f"{SRTM_BASE_URL}/{lat_dir}/{gz_filename}"
    # Ej: https://s3.amazonaws.com/elevation-tiles-prod/skadi/S20/S20W066.hgt.gz

    local_gz_path = os.path.join(dest_folder, gz_filename)
    local_hgt_path = os.path.join(dest_folder, f"{tile_name}.hgt")

    # Si ya existe el .hgt descomprimido, devolvemos la ruta
    if os.path.exists(local_hgt_path):
        return local_hgt_path

    try:
        with requests.get(url, stream=True) as r:
            if r.status_code == 404:
                return None
            r.raise_for_status()
            with open(local_gz_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        # Descomprimir
        with gzip.open(local_gz_path, "rb") as gz_in, open(local_hgt_path, "wb") as out_f:
            shutil.copyfileobj(gz_in, out_f)

        os.remove(local_gz_path)
        return local_hgt_path

    except requests.HTTPError as http_err:
        raise RuntimeError(f"Error HTTP descargando tile {tile_name}: {http_err}") from http_err
    except Exception as e:
        raise RuntimeError(f"Error descargando o descomprimiendo tile {tile_name}: {e}") from e

# -------------------------------------------------------------------
# 5) Utility: crear mosaico in-memory a partir de varios .hgt
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

    memfile = MemoryFile()
    with memfile.open(**out_meta) as dest:
        dest.write(mosaic_array)

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
    Sube el GeoTIFF recortado a Firebase Storage en 'srtm/{region_id}/'
    y devuelve la URL pública.
    """
    filename = Path(local_tif_path).name
    blob_path = f"srtm/{region_id}/{filename}"

    # 1) Creamos un blob en Firebase Storage:
    blob = bucket.blob(blob_path)

    # 2) Subimos el GeoTIFF desde local:
    blob.upload_from_filename(local_tif_path)

    # 3) Lo ponemos público (si es que tu configuración lo permite):
    blob.make_public()

    # 4) Construimos la URL pública (o guardamos el "gs://..." si prefieres)
    public_url = blob.public_url  # esto quedará como "https://storage.googleapis.com/tu-bucket/srtm/..."
    
    # 5) Guardamos la URL en Firestore (para que puedas recuperarla luego)
    db.collection("layers").document(region_id).set({
        "srtm_url": public_url
    }, merge=True)

    return public_url


# -------------------------------------------------------------------
# 8) Función principal: pipeline completo para SRTM
# -------------------------------------------------------------------
async def generate_srtm_for_region(region_id: str) -> str:
    """
    Llama a cada paso:
      1. Cargar polígono de Firestore (nuevo esquema basado en points).
      2. Calcular bounding box y tiles necesarios.
      3. Descargar + descomprimir cada tile .hgt, saltando los que den 404.
      4. Mosaicar en memoria.
      5. Recortar al polígono y crear GeoTIFF final.
      6. Subir ese GeoTIFF final.
      7. Guardar la URL local en Firestore (layers/{region_id}).
      8. Limpiar archivos temporales.
      9. Retornar la URL local.
    """
    # 8.1. Leer polígono en EPSG:4326
    user_gdf = load_user_polygon_from_firestore(region_id)
    min_lon, min_lat, max_lon, max_lat = get_bounding_box(user_gdf)

    logging.getLogger("uvicorn.error").info(
        f"SRTM bbox ─ Lat: {min_lat} a {max_lat}, Lon: {min_lon} a {max_lon}"
    )
    # 8.2. Calcular tiles SRTM necesarias
    tiles = latLon_to_tile_names(min_lon, min_lat, max_lon, max_lat)
    if not tiles:
        raise ValueError("No se encontraron tiles SRTM para esa región.")

    # 8.3. Carpeta temporal para almacenar .hgt
    tmp_folder = os.path.join(TMP_ROOT, "srtm_tiles", region_id)
    os.makedirs(tmp_folder, exist_ok=True)

    # 8.4. Descargar + descomprimir cada .hgt, saltando los 404
    hgt_paths = []
    for tile in tiles:
        try:
            hgt_path = download_and_extract_srtm_tile(tile, tmp_folder)
            if hgt_path:
                hgt_paths.append(hgt_path)
            # Si hgt_path es None, fue 404 → lo saltamos
        except Exception as e:
            # Si falla por otro motivo (p.ej. 500), limpiamos y propagamos error
            shutil.rmtree(tmp_folder, ignore_errors=True)
            raise RuntimeError(f"Error descargando tile {tile}: {e}")

    # 8.4.1. Verificar que al menos bajamos un tile válido
    if not hgt_paths:
        shutil.rmtree(tmp_folder, ignore_errors=True)
        raise RuntimeError("No se descargó ningún tile SRTM válido para esa región.")

    # 8.5. Mosaico en memoria
    mosaic_reader = build_srtm_mosaic(hgt_paths)

    # 8.6. Recortar con el polígono
    clipped_tif_path = os.path.join(TMP_ROOT, f"srtm_clip_{region_id}.tif")
    clip_mosaic_to_polygon(mosaic_reader, user_gdf, clipped_tif_path)

    # 8.6.1 ⇢ Convertir a Cloud-Optimized GeoTIFF
    try:
        cog_path = to_cog(Path(clipped_tif_path))
        path_to_upload = str(cog_path)
    except Exception as e:
        logging.getLogger("uvicorn.error").warning(
            f"[COG] SRTM: conversión fallida ({e}); subiendo el TIFF normal."
        )
        path_to_upload = clipped_tif_path

    # 8.7. Subir a Storage y registrar URL
    srtm_url = upload_srtm_to_storage(path_to_upload, region_id)

    # 8.8. Limpiar archivos temporales
    try:
        shutil.rmtree(tmp_folder)
    except Exception:
        pass

    return srtm_url
