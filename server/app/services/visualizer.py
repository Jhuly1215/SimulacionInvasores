import os
import requests
import numpy as np
import rasterio
from rasterio.io import MemoryFile
import matplotlib.pyplot as plt

def read_tif(path_or_url: str) -> np.ndarray:
    """
    Lee la banda 1 de un GeoTIFF, sea URL o ruta local.
    Devuelve float32 con NaN en nodata.
    """
    if path_or_url.lower().startswith(("http://", "https://")):
        # ---- remoto ----
        resp = requests.get(path_or_url)
        resp.raise_for_status()
        with MemoryFile(resp.content) as memfile, memfile.open() as src:
            arr = src.read(1).astype(np.float32)
            nodata = src.nodata
    else:
        # ---- local ----
        with rasterio.open(path_or_url) as src:
            arr = src.read(1).astype(np.float32)
            nodata = src.nodata

    # enmascarar nodata
    if nodata is not None:
        arr = np.where(arr == nodata, np.nan, arr)
    return arr

def tif_to_png(path_or_url: str, output_folder: str, figsize=(6,6)):
    """
    Lee el TIF (URL o local), elige colormap según tipo,
    y guarda como PNG en output_folder.
    """
    arr = read_tif(path_or_url)

    # elegir cmap y rango
    url_low = path_or_url.lower()
    if 'discrete-classification-map' in url_low:
        cmap = 'tab20';      vmin, vmax = 0, 200
    elif 'srtm' in url_low:
        cmap = 'terrain';    vmin, vmax = np.nanmin(arr), np.nanmax(arr)
    elif 'infested' in url_low:
        cmap = 'Reds';       vmin, vmax = 0, 1
    else:
        cmap = 'gray';       vmin, vmax = np.nanmin(arr), np.nanmax(arr)

    # dibujar
    fig, ax = plt.subplots(figsize=figsize)
    im = ax.imshow(arr, cmap=cmap, vmin=vmin, vmax=vmax)
    ax.set_axis_off()

    # colorbar sólo para la clasificación
    if cmap == 'tab20':
        fig.colorbar(im, ax=ax, fraction=0.04, pad=0.01)

    # guardar
    os.makedirs(output_folder, exist_ok=True)
    fname = os.path.splitext(os.path.basename(path_or_url))[0] + '.png'
    out_path = os.path.join(output_folder, fname)
    plt.savefig(out_path, bbox_inches='tight', pad_inches=0)
    plt.close(fig)
    print(f"→ Guardado {out_path}")

def batch_convert(tif_list: list[str], output_folder: str = "png_outputs"):
    for p in tif_list:
        try:
            tif_to_png(p, output_folder)
        except Exception as e:
            print(f"Error procesando {p}: {e}")

if __name__ == "__main__":
    # Recuerda usar raw strings o "/" en Windows
    timesteps = [
        "https://storage.googleapis.com/invasores-72d3c.firebasestorage.app/srtm/HdxeOlD6vfexYTSdL7iv/srtm_clip_HdxeOlD6vfexYTSdL7iv_cog.tif",
        "https://storage.googleapis.com/invasores-72d3c.firebasestorage.app/copernicus/HdxeOlD6vfexYTSdL7iv/copernicus_clip_HdxeOlD6vfexYTSdL7iv_cog.tif",
        "https://storage.googleapis.com/invasores-72d3c.firebasestorage.app/worldclim/HdxeOlD6vfexYTSdL7iv/worldclim_bio1_clip_HdxeOlD6vfexYTSdL7iv_cog.tif",
    ]
    batch_convert(timesteps, output_folder="simulation_pngs")
