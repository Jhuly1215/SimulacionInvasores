import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayerUrls, LayerRequest, Layer } from '../types';
import { layersAPI } from '../api/layers';

export const useEnvironmentLayers = (regionId?: string) => {
  const [visibleLayers, setVisibleLayers] = useState<string[]>([]);
  
  const layerRequest: LayerRequest = {
    region_id: regionId ?? '',
  };

  const { data: layerUrls, isLoading, error } = useQuery<LayerUrls>({
    queryKey: ['environmentLayers', regionId],
    queryFn: async () => {
      if (!regionId) {
        // Retorna objeto vacío en lugar de array vacío
        return {} as LayerUrls;
      }
      // La API ya devuelve LayerUrls directamente, no necesita conversión
      const result = await layersAPI.generateAllLayers(layerRequest);
      return result;
    },
    enabled: !!regionId,
  });

  // Función para obtener detalles de cada layer
  function getLayerDescription(layerId: string) {
    switch (layerId) {
      case 'copernicus_url':
        return {
          name: 'Cobertura terrestre (Copernicus)',
          description: 'Imágenes satelitales o datos raster de observación de la Tierra provenientes del programa Copernicus de la Unión Europea.',
          type: 'landuse',
          visible: false
        };
      case 'worldclim_bio1_url':
        return {
          name: 'Temperatura media anual (WorldClim BIO1)',
          description: 'Temperatura media anual derivada de datos climáticos globales WorldClim.',
          type: 'climate',
          visible: false
        };
      case 'worldclim_bio5_url':
        return {
          name: 'Temperatura máxima del mes más cálido (WorldClim BIO5)',
          description: 'Temperatura máxima del mes más cálido según WorldClim.',
          type: 'climate',
          visible: false
        };
      case 'worldclim_bio6_url':
        return {
          name: 'Temperatura mínima del mes más frío (WorldClim BIO6)',
          description: 'Temperatura mínima del mes más frío según WorldClim.',
          type: 'climate',
          visible: false
        };
      case 'worldclim_bio12_url':
        return {
          name: 'Precipitación anual total (WorldClim BIO12)',
          description: 'Precipitación anual total según WorldClim.',
          type: 'climate',
          visible: false
        };
      case 'worldclim_bio15_url':
        return {
          name: 'Estacionalidad de la precipitación (WorldClim BIO15)',
          description: 'Coeficiente de variación de la precipitación anual según WorldClim.',
          type: 'climate',
          visible: false
        };
      case 'srtm_url':
        return {
          name: 'Elevación del terreno (SRTM)',
          description: 'Altitud o elevación del terreno del modelo digital de elevación SRTM.',
          type: 'elevation',
          visible: false
        };
      default:
        return {
          name: layerId,
          description: '',
          type: 'other',
          visible: false
        };
    }
  }

  const layers: Layer[] = Object.entries(layerUrls ?? {}).map(([key, url]) => {
    const details = getLayerDescription(key);
    return {
      id: key,
      url: url as string,
      ...details,
    };
  });

  // Aplica visibilidad a las capas
  const layersWithVisibility = layers.map(layer => ({
    ...layer,
    visible: visibleLayers.includes(layer.id)
  }));

  // Agrupa las capas por tipo
  const groupedLayers = layersWithVisibility.reduce((acc, layer) => {
    const group = acc[layer.type] || [];
    return {
      ...acc,
      [layer.type]: [...group, layer]
    };
  }, {} as Record<string, Layer[]>);

  // Función para toggle de visibilidad
  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayers(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(id => id !== layerId);
      } else {
        return [...prev, layerId];
      }
    });
  }, []);

  return {
    layers: layersWithVisibility,
    groupedLayers,
    isLoading,
    error,
    toggleLayer,
    visibleLayers,
    setVisibleLayers,
    getLayerDescription,
    rawData: layerUrls
  };
};