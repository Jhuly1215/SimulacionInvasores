# 🐍🌱 Sistema de Simulación de Especies Invasoras

Este proyecto es una plataforma geoespacial inteligente que permite modelar y simular el comportamiento de especies invasoras dentro de regiones geográficas personalizadas. Utiliza datos ambientales reales (clima, altitud, cobertura terrestre), técnicas de modelado ecológico, y modelos de lenguaje (LLM) para automatizar la parametrización de especies.

---

## 📌 Características Principales

- 🌎 Creación y edición de regiones personalizadas.
- 🐦 Identificación de especies presentes usando GBIF o modelos LLM.
- 🌡️ Recorte automático de capas raster (Copernicus, SRTM, WorldClim).
- 📊 Construcción de mapas de idoneidad (suitability) y barreras ecológicas.
- 🔁 Simulación dinámica de dispersión espacial y crecimiento poblacional.
- ☁️ Integración con Firebase para almacenamiento y visualización de resultados.
- 🧠 Opcional: parametrización automática con modelos LLM (infer_species_traits).

---

## 📁 Estructura del Proyecto

```
app/
├── main.py                # Punto de entrada FastAPI
├── api/                   # Rutas y controladores por módulo
│   ├── region_routes.py
│   ├── species_routes.py
│   ├── layer_routes.py
│   └── simulation_routes.py
├── services/              # Lógica principal de negocio
│   ├── region_service.py
│   ├── species_service.py
│   ├── layer_service.py
│   └── simulation_service.py
├── core/                  # Configuración de Firebase, logging, constantes
│   └── firebase.py
├── models/                # Esquemas de datos Pydantic
│   ├── region.py
│   ├── species.py
│   ├── simulation.py
├── utils/
│   └── cog.py             # Conversión de TIFF a COG
└── llm_transformers/      # Integración con LLM
    └── llama_instruct_generate.py
```
## 🚀 Instalación y Ejecución Local
1. Clonar el repositorio

git clone https://github.com/Jhuly1215/SimulacionInvasores.git
cd simulador-invasoras

3. Crear entorno virtual

python -m venv env
source env/bin/activate  # o env\Scripts\activate en Windows

3. Instalar dependencias

pip install -r requirements.txt

4. Configurar credenciales Firebase

Guarda tu archivo firebase-adminsdk.json y configura la variable de entorno:

export GOOGLE_APPLICATION_CREDENTIALS="path/to/firebase-adminsdk.json"

5. Ejecutar FastAPI

uvicorn app.main:app --reload

Accede a la documentación interactiva en:

http://localhost:8000/docs

## 🌐 Dependencias Principales

FastAPI: backend API REST

Firebase Admin: base de datos (Firestore) y almacenamiento (Storage)

rasterio + geopandas: manejo geoespacial y raster

requests: consumo de API GBIF

scipy, numpy: simulación espacial y convolución

LLM: integración con modelo de lenguaje instructivo tipo LLaMA (via llama_instruct_generate.py)

## 🧠 Lógica del Modelo

Combina datos de uso de suelo, altitud y clima para construir mapas de suitability (0 a 1).

Aplica un modelo de crecimiento poblacional logístico + dispersión espacial (kernel gaussiano).

Para especies con movilidad aérea, se simulan “saltos” de larga distancia con probabilidad ajustable.

Todo se orquesta automáticamente mediante funciones asincrónicas y procesamiento por pasos.

---

## 📊 Resultados

Mapas TIFF por timestep accesibles vía URL pública

Indicadores por año: abundancia total, tasa de crecimiento, áreas ocupadas

Visualización embebida con Leaflet + timeline dinámico

# Créditos

Proyecto desarrollado por Jhulianna Vitoria Tarqui Alvarado y Carlos Fernando Pinell Mealla, con fines académicos y de conservación ambiental.

