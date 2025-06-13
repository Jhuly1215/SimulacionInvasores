# utils/run_simulation.py
import os
from pathlib import Path
import numpy as np
import rasterio
from scipy.signal import convolve2d
from shapely.geometry import Polygon
from typing import Dict, List, Tuple

def build_suitability_and_barrier(
    class_arr: np.ndarray,
    elev_arr: np.ndarray,
    clim_dict: Dict[str, np.ndarray]
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Construye dos matrices:
      - suitability: combinación ponderada de cobertura de suelo, elevación y bioclimáticas
      - barrier: mapa de barreras estáticas

    class_arr: arreglo de códigos de cobertura
    elev_arr: arreglo de elevación
    clim_dict: diccionario con variables bioclimáticas pre-recortadas y remuestreadas
    """
    # 1) Suitability base por clases
    class_weights = {
        111: 0.9, 113: 0.8, 112: 0.85, 114: 0.75, 115: 0.8,
        116: 0.5, 121: 0.7, 123: 0.65,122: 0.7,124: 0.6,
        125: 0.6,126: 0.5,20:0.4,30:0.4,40:0.3,
        50:0.0,60:0.2,70:0.1,80:0.0,90:0.3,100:0.2
    }
    s_class = np.full(class_arr.shape, 0.1, dtype=np.float32)
    for code, w in class_weights.items():
        s_class[class_arr == code] = w

    # 2) Elevación normalizada (pico en altitud media)
    elev_min, elev_max = 0.0, 3000.0
    mid = 0.5 * (elev_min + elev_max)
    half_range = 0.5 * (elev_max - elev_min)
    s_el = 1.0 - np.abs((elev_arr - mid) / half_range)
    s_el = np.clip(s_el, 0.0, 1.0)

    # 3) Bioclimáticas vectorizadas
    clim_ranges = {
        'bio1': (-10.0, 45.0), 'bio5': (0.0, 55.0),
        'bio6': (-20.0, 30.0), 'bio12': (0.0, 3000.0), 'bio15': (0.0, 100.0)
    }
    s_bioclim_components = []
    for var, arr in clim_dict.items():
        vmin, vmax = clim_ranges[var]
        s = (arr - vmin) / (vmax - vmin)
        s_bioclim_components.append(np.clip(s, 0.0, 1.0))
    # rango adicional bio5-bio6
    max_range = clim_ranges['bio5'][1] - clim_ranges['bio6'][0]
    s_range = np.clip((clim_dict['bio5'] - clim_dict['bio6']) / max_range, 0.0, 1.0)
    s_bioclim_components.append(s_range)

    weights = [0.25, 0.20, 0.20, 0.25, 0.05, 0.05]
    s_bioclim = sum(w * comp for w, comp in zip(weights, s_bioclim_components))

    # 4) Combinar
    suitability = 0.3 * s_class + 0.3 * s_el + 0.4 * s_bioclim
    suitability = np.clip(suitability, 0.0, 1.0)

    # 5) Barrier
    barrier = np.zeros(class_arr.shape, dtype=np.float32)
    barrier[class_arr == 80] = 1.0
    barrier[class_arr == 60] = 0.7
    return suitability, barrier


def run_dynamic_simulation(
    output_dir: str,
    suitability: np.ndarray,
    barrier: np.ndarray,
    polygon: Polygon,
    params: Dict
) -> List[str]:
    """
    Ejecuta la dinámica de crecimiento y dispersión.

    output_dir: carpeta de salida
    polygon: geometría para ubicar el punto inicial
    params incluye: maxGrowthRate, dispersalKernel, initial_population, timesteps, dt_years, mobility, long_distance_fraction

    Retorna lista de rutas de archivos GeoTIFF generados.
    """
    # Extraer params
    r = params.get('maxGrowthRate', 0.1)
    sigma_m = params.get('dispersalKernel', 500)
    init_pop = params.get('initial_population', 0.01)
    T = params.get('timesteps', 20)
    dt = params.get('dt_years', 1.0)
    mobility = params.get('mobility', 'ground')
    jump_frac = params.get('long_distance_fraction', 0.0)

    h, w = suitability.shape
    # Inicializar densidad y estado
    D = np.zeros((h, w), np.float32)
    Infested = np.zeros((h, w), np.uint8)
    # Punto inicial (centroid)
    cx, cy = polygon.centroid.x, polygon.centroid.y
    # convertir a fila/col (se asume transform uniforme)
    # TODO: pasar transform si se requiere precisión
    i0, j0 = h//2, w//2  # placeholder
    D[i0, j0] = init_pop
    Infested[i0, j0] = 1

    # Construir kernel base
    pix_size = 100
    sigma_px = sigma_m / pix_size
    rad = int(3 * sigma_px)
    yv, xv = np.ogrid[-rad:rad+1, -rad:rad+1]
    base_kernel = np.exp(-(xv**2 + yv**2)/(2*sigma_px**2))
    base_kernel /= base_kernel.sum()
    # Mezclar si vuela
    kernel = base_kernel
    if mobility == 'flight':
        wide = np.exp(-(xv**2 + yv**2)/(2*(sigma_px*3)**2))
        wide /= wide.sum()
        kernel = 0.8*base_kernel + 0.2*wide
        kernel /= kernel.sum()

    os.makedirs(output_dir, exist_ok=True)
    output_paths = []

    # Loop
    for t in range(T):
        # Crecimiento
        K = suitability
        D2 = D + r * D * (1 - D/(K + 1e-6)) * dt
        # Dispersión
        disp = convolve2d(D2, kernel, mode='same', boundary='fill', fillvalue=0)
        D_next = D2 + disp * suitability * (1 - barrier)
        # Saltos largos
        if mobility == 'flight' and jump_frac > 0:
            total = D_next.sum()
            n_jump = int(total * jump_frac)
            ys = np.random.randint(0, h, n_jump)
            xs = np.random.randint(0, w, n_jump)
            for y,x in zip(ys, xs):
                D_next[y,x] += total * jump_frac / max(n_jump,1)
        # Infested
        Infested = (D_next > init_pop*0.5).astype(np.uint8)
        D = D_next
        # Guardar
        path = os.path.join(output_dir, f"infested_t{t:03d}.tif")
        with rasterio.open(
            path, 'w', driver='GTiff', height=h, width=w,
            count=1, dtype=rasterio.uint8,
            crs='+proj=latlong', transform=[1,0,0,0,-1,0]
        ) as dst:
            dst.write(Infested, 1)
        output_paths.append(path)
    return output_paths
