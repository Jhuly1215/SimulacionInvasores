from fastapi import FastAPI
from app.api import region, species, layers, simulation
import logging

# Descripciones para agrupar en Swagger UI
tags_metadata = [
    {
        "name": "Region",
        "description": "Operaciones para gestionar regiones de estudio (crear, listar, actualizar, eliminar)."
    },
    {
        "name": "Species",
        "description": "Endpoints para CRUD de especies invasoras."
    },
    {
        "name": "Layers",
        "description": "Gestión de capas cartográficas y sus metadatos."
    },
    {
        "name": "Simulation",
        "description": "Puesta en marcha y recuperación de simulaciones de invasión."
    },
]

# Configuración del logger
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logging.getLogger().setLevel(logging.DEBUG)
logging.getLogger("uvicorn.error").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)

# Inicialización de la app con OpenAPI/Swagger
app = FastAPI(
    title="Invasion Simulation Backend",
    description="API REST para gestionar regiones, especies y ejecutar simulaciones de invasión.",
    version="1.0.0",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Inclusión de routers con sus tags
app.include_router(region.router, prefix="/region", tags=["Region"])
app.include_router(species.router, prefix="/species", tags=["Species"])
app.include_router(layers.router, prefix="/layers", tags=["Layers"])
app.include_router(simulation.router, prefix="/simulation", tags=["Simulation"])
