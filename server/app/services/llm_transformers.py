# app/services/llm_transformers.py

import os
from transformers import pipeline, GenerationConfig
import torch

# Ajusta este ID al repositorio de Hugging Face que hayas descargado / cacheado localmente.
# Si ya hiciste `transformers-cli login` y tienes permiso de lectura, basta con el nombre del modelo.
MODEL_ID = os.getenv("LLAMA_MODEL_ID", "meta-llama/Llama-4-Scout-17B-16E")

# Opciones de generación (puedes afinarlas según tu hardware y necesidad)
GEN_CONFIG = GenerationConfig(
    temperature=0.2,
    top_p=0.95,
    # Si deseas sampling, pon do_sample=True
    do_sample=False,
    max_new_tokens=1024  # o el valor que consideres suficiente de contexto
)

# Construimos el pipeline global
# device_map="auto" intentará colocar el modelo en GPU si está disponible, 
# o partirá capas en CPU/GPU si tu hardware lo soporta.
# torch_dtype=torch.bfloat16 usa BF16 si tu GPU lo admite (A100/V100 con CUDA >= 11).
pipe = pipeline(
    task="text-generation",
    model=MODEL_ID,
    device_map="auto",
    torch_dtype=torch.bfloat16,
    initialization_parameters={"trust_remote_code": True},  # en caso de repositorios que requieran custom code
    generation_config=GEN_CONFIG,
)
