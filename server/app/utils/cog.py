from pathlib import Path
import math
import rasterio
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles


def to_cog(src_path: Path) -> Path:
    """
    Convierte <archivo>.tif → <archivo>_cog.tif.
    Elige dinámicamente la cantidad de overviews para evitar el error
    “Too many overviews levels ...”.
    """
    dst_path = src_path.with_name(src_path.stem + "_cog.tif")

    # ── 1. Determinar dimensión mínima del ráster recortado ───────────
    with rasterio.open(src_path) as src:
        min_dim = min(src.width, src.height)

    # ── 2. Calcular cuántos niveles caben (dividir por 2 hasta quedar ≥ 64 px) ─
    if min_dim < 64:
        ov_level = None          # ráster tan pequeño que no necesita pirámides
    else:
        # potencia máxima de 2 que cabe sin llegar a 1×1
        max_levels = int(math.floor(math.log(min_dim, 2))) - 1
        ov_level = min(max_levels, 5)   # nunca pedimos más de 5

    # ── 3. Ejecutar cog_translate ─────────────────────────────────────
    cog_translate(
        str(src_path),                       # in
        str(dst_path),                       # out
        cog_profiles.get("deflate"),         # perfil DEFLATE + TILED
        overview_level=ov_level,             # puede ser None o un entero 1-5
        overview_resampling="nearest",
        quiet=True,
    )
    return dst_path
