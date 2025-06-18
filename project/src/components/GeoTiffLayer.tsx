// src/components/GeoTiffLayer.tsx
import React, { useEffect, useRef } from 'react'
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
  const layerRef = useRef<any>(null)
  const currentPathRef = useRef<string>('')
  const isLoadingRef = useRef<boolean>(false)

  useEffect(() => {
    // Si no hay storagePath, limpia cualquier capa existente
    if (!storagePath) {
      cleanupLayer()
      return
    }

    // Si el path no ha cambiado, no hacer nada
    if (currentPathRef.current === storagePath) {
      return
    }

    // Si ya está cargando, cancela la carga anterior
    if (isLoadingRef.current) {
      cleanupLayer()
    }

    loadGeoTiffLayer()
  }, [map, storagePath])

  const cleanupLayer = () => {
    if (layerRef.current && map.hasLayer(layerRef.current)) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    currentPathRef.current = ''
    isLoadingRef.current = false
  }

  const loadGeoTiffLayer = async () => {
    isLoadingRef.current = true
    
    try {
      // Limpiar la capa anterior primero
      cleanupLayer()
      
      console.log('Loading GeoTIFF:', storagePath)

      const url = await getDownloadURL(ref(storage, storagePath))
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const georaster = await parseGeoraster(arrayBuffer)
      
      // Verificar si el componente aún está montado y el path es el mismo
      if (currentPathRef.current !== storagePath && storagePath) {
        return // El path cambió mientras cargábamos, abortar
      }
      
      const layer = new GeoRasterLayer({
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

      // Verificar una vez más antes de agregar al mapa
      if (currentPathRef.current === storagePath || currentPathRef.current === '') {
        layerRef.current = layer
        currentPathRef.current = storagePath
        layer.addTo(map)
        map.fitBounds(layer.getBounds())
        console.log('GeoTIFF layer loaded successfully')
      }

    } catch (error) {
      console.error('Error cargando GeoTIFF:', error)
    } finally {
      isLoadingRef.current = false
    }
  }

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      cleanupLayer()
    }
  }, [map])

  return null
}

export default GeoTiffLayer