# app/services/llm_transformers.py

import os
import torch
from transformers import pipeline

# -------------------------------------------------------
# 1) Lee el ID del modelo y asume que HUGGINGFACE_HUB_TOKEN
#    ya está definido en el entorno al arrancar Uvicorn.
# -------------------------------------------------------
MODEL_ID = os.getenv("LLAMA_MODEL_ID", "meta-llama/Llama-3.2-1B-Instruct")

# -------------------------------------------------------
# 2) Creamos el pipeline de text-generation usando Transformers
#
#    - device_map="auto": coloca el modelo en GPU(s) o CPU según disponibilidad.
#    - torch_dtype=torch.bfloat16: usa BF16 si tu GPU lo soporta (A100/V100 con CUDA ≥ 11).
#    - trust_remote_code=True: permite ejecutar scripts custom del repo gated.
#    - use_auth_token=True: fuerza a Transformers a leer HUGGINGFACE_HUB_TOKEN.
# -------------------------------------------------------
pipe = pipeline(
    task="text-generation",
    model=MODEL_ID,
    device_map="auto",
    torch_dtype=torch.bfloat16,
    trust_remote_code=True,
    #use_auth_token=True,
)

# -------------------------------------------------------
# 3) Función auxiliar para generar texto (con formulario Instruct)
# -------------------------------------------------------
def llama_instruct_generate(system_prompt: str, user_prompt: str, 
                             max_new_tokens: int = 256,
                             temperature: float = 0.2,
                             top_p: float = 0.95,
                             do_sample: bool = False) -> str:
    """
    Dada una 'instrucción de sistema' y una 'consulta de usuario', concatena
    los roles en un solo prompt y llama a `pipe` para generar la respuesta.

    Retorna únicamente el texto que genera el asistente (sin reimprimir el prompt).
    """

    # 1) Construimos el prompt concatenado en formato Instruct (roles <System>, <User>, <Assistant>)
    prompt = (
        f"<System>: {system_prompt}\n"
        f"<User>: {user_prompt}\n"
        f"<Assistant>:"
    )

    # 2) Llamamos al pipeline
    outputs = pipe(
        prompt,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_p=top_p,
        do_sample=do_sample,
    )

    # 3) `outputs` es una lista con un único dict → {"generated_text": "..."}
    generated_text = outputs[0]["generated_text"]

    # 4) Extraemos solo la parte después de "<Assistant>:"
    if "<Assistant>:" in generated_text:
        respuesta = generated_text.split("<Assistant>:")[-1].strip()
    else:
        # Si no encuentra el tag (quizás la estructura cambie), devolvemos todo
        respuesta = generated_text.strip()

    return respuesta
