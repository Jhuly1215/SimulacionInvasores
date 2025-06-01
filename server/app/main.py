# main.py
from fastapi import FastAPI
from app.api import region, species, layers, simulate

app = FastAPI(title="Invasion Simulation Backend")

app.include_router(region.router, prefix="/region", tags=["Region"])
app.include_router(species.router, prefix="/species", tags=["Species"])
app.include_router(layers.router, prefix="/layers", tags=["Layers"])
app.include_router(simulate.router, prefix="/simulate", tags=["Simulation"])
