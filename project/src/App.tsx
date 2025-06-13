// src/App.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Pantalla from './pages/Pantalla';
import GeoTiffPage from './pages/GeoTiffPage';

const App: React.FC = () => {
  return (
    <Routes>
      {/* Ruta principal: carga toda tu lógica actual */}
      <Route path="/" element={<Pantalla />} />

      {/* Ruta /geo: muestra solo tu GeoTiffPage */}
      <Route path="/geo" element={<GeoTiffPage />} />

      {/* Si quisieras redirigir cualquier otra ruta de vuelta a "/" */}
      {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
};

export default App;
