# app/core/firebase.py
import firebase_admin
from firebase_admin import credentials, firestore, storage

cred = credentials.Certificate("firebase_credentials.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'invasores-72d3c.firebasestorage.app'
})

db = firestore.client()
bucket = storage.bucket()
