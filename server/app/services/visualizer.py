from line_profiler import LineProfiler
from app.services.simulation_service import run_dynamic_simulation
# prepara aquí unos argumentos de prueba:
region_id     = ""
species_params = {
    "commonName": "puma",
    "maxGrowthRate": 0.1,
    "dispersalKernel": 500,
    "initial_population": 0.01,
    "timesteps": 10,
    "dt_years": 1.0
}
# dummy de suitability/barrier/meta/polygon/tmp_folder
# lo ideal es reutilizar tu pipeline real para que el profiling sea fiel

profiler = LineProfiler()
profiler.add_function(run_dynamic_simulation)

# Ejecuta el profiling sobre una llamada real
profiler.runctx(
    'run_dynamic_simulation(region_id, species_params, suitability, barrier, meta, poly_gdf, tmp)',
    globals(), locals()
)

# Muestra el informe
profiler.print_stats()
