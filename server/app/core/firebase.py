# app/core/firebase.py

import firebase_admin
from firebase_admin import credentials, firestore, storage
cred = credentials.Certificate("firebase_credentials.json")

# Inicializa la App e incluye el nombre de tu bucket de Cloud Storage
firebase_admin.initialize_app(cred, {
    "storageBucket": "invasores-72d3c.firebasestorage.app"
})

# Cliente de Firestore
db = firestore.client()

# Bucket de Storage (ahora ya conoce el bucket por defecto)
bucket = storage.bucket()
