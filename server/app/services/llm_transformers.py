# app/services/llm_transformers.py

import os
from transformers import pipeline
import torch

# ID del modelo en Hugging Face
MODEL_ID = os.getenv("LLAMA_MODEL_ID", "meta-llama/Llama-4-Scout-17B-16E")

# Creamos el pipeline sin pasar generation_config directamente
pipe = pipeline(
    task="text-generation",
    model=MODEL_ID,
    device_map="auto",
    torch_dtype=torch.bfloat16,
    trust_remote_code=True  # <- permitido directamente desde versiones recientes
)

# Función que usa el pipeline con parámetros personalizados
def generar_respuesta(prompt):
    result = pipe(
        prompt,
        max_new_tokens=1024,
        temperature=0.2,
        top_p=0.95,
        do_sample=False
    )
    return result[0]['generated_text']  # Ajusta si usas otro modelo
