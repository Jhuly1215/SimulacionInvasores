// src/components/GeoTiffLayer.tsx
import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import parseGeoraster from 'georaster'
import GeoRasterLayer from 'georaster-layer-for-leaflet'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

interface Props {
  storagePath: string
}

const GeoTiffLayer: React.FC<Props> = ({ storagePath }) => {
  const map = useMap()

  useEffect(() => {
    let layer: any

    getDownloadURL(ref(storage, storagePath))
      .then(url => fetch(url))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then(buf => parseGeoraster(buf))
      .then(georaster => {
        layer = new GeoRasterLayer({
          georaster,
          resolution: 300,
          opacity: 0.8,
          // Para binario: 0 = transparente, 1 = rojo semitransparente
          pixelValuesToColorFn: (values: number[]) => {
            const v = values[0]
            if (v === 1) {
              // rojo claro
              return 'rgba(255,0,0,0.5)'
            }
            // fuera de infestación, nada
            return 'rgba(0,0,0,0)'
          }
        })
        layer.addTo(map)
        map.fitBounds(layer.getBounds())
      })
      .catch(err => console.error('Error cargando GeoTIFF:', err))

    return () => {
      if (layer) map.removeLayer(layer)
    }
  }, [map, storagePath])

  return null
}

export default GeoTiffLayer
