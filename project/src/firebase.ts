// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getStorage }    from 'firebase/storage';

// Tu JSON con el resto de las credenciales
import firebaseConfigJSON from './firebase_credentials.json';

// Extiende el JSON para añadir el storageBucket
const firebaseConfig = {
  ...firebaseConfigJSON
};

// Inicializa la app con el config completo
const app = initializeApp(firebaseConfig);

// Exporta storage y, si la necesitas, la app
export const storage = getStorage(app);
export { app };
