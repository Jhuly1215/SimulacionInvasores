# app/core/firebase.py

import firebase_admin
from firebase_admin import credentials, firestore, storage
import json

# Carga las credenciales desde el archivo JSON
with open("firebase_credentials.json") as f:
    cred_dict = json.load(f)

cred = credentials.Certificate(cred_dict)

# Usa el storageBucket directamente del JSON
bucket_name = cred_dict.get("storageBucket")

# Inicializa la App e incluye el nombre de tu bucket de Cloud Storage
firebase_admin.initialize_app(cred, {
    "storageBucket": bucket_name
})

# Cliente de Firestore
db = firestore.client()

# Bucket de Storage (ahora ya conoce el bucket por defecto)
bucket = storage.bucket()