// src/pages/GeoTiffPage.tsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import GeoTiffLayer                from '../components/GeoTiffLayer';

const STORAGE_PATH =
  'https://storage.googleapis.com/invasores-72d3c.firebasestorage.app/simulation/4qR2izcDcxqPByhNbkSr/infested_t009_cog.tif';

const GeoTiffPage: React.FC = () => (
  <div className="h-screen w-full">
    <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoTiffLayer storagePath={STORAGE_PATH} />
    </MapContainer>
  </div>
);

export default GeoTiffPage;
