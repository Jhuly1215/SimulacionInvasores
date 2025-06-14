import React from 'react';
import { MapPin, RefreshCw, PlayCircle } from 'lucide-react';
import { Loader } from '../UI/Loader';

interface Region {
  id: string;
  name: string;
  points: Array<{
    latitude: number;
    longitude: number;
  }>;
}

interface RegionsListProps {
  regions?: Region[]; // Lista de regiones
  isLoading?: boolean; // Estado de carga
  error?: Error | null; // Error
  onSelectRegion: (region: Region) => void; // Callback al seleccionar región
  selectedRegionId?: string; // ID de la región seleccionada
  showFilters?: boolean; // Mostrar filtros avanzados
  onRefresh?: () => void; // Función para refrescar
}

const RegionsList: React.FC<RegionsListProps> = ({
  regions = [],
  isLoading = false,
  error = null,
  onSelectRegion,
  selectedRegionId,
  showFilters = false,
  onRefresh,
}) => {
  // Estados para filtros
  const [nameFilter, setNameFilter] = React.useState<string>('');
  const [sortBy, setSortBy] = React.useState<'name' | 'area'>('name');

  // Calcular área aproximada de una región (usando fórmula de Shoelace simplificada)
  const calculateRegionArea = (points: Region['points']): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const j = (i + 1) % points.length;
      area += points[i].latitude * points[j].longitude;
      area -= points[j].latitude * points[i].longitude;
    }
    return Math.abs(area / 2);
  };

  // Calcular centro aproximado de una región
  const calculateRegionCenter = (points: Region['points']): { lat: number; lng: number } => {
    if (points.length === 0) return { lat: 0, lng: 0 };
    
    const lat = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
    
    return { lat, lng };
  };

  // Aplicar filtros
  let filteredRegions = regions;
  if (nameFilter) {
    filteredRegions = regions.filter(region => 
      region.name.toLowerCase().includes(nameFilter.toLowerCase())
    );
  }

  // Aplicar ordenamiento
  filteredRegions = [...filteredRegions].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      const areaA = calculateRegionArea(a.points);
      const areaB = calculateRegionArea(b.points);
      return areaB - areaA; // Descendente por área
    }
  });

  if (isLoading) {
    return <Loader message="Loading regions data..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-md">
        <div className="flex items-center justify-between">
          <span>Failed to load regions data. Please try again.</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (regions.length === 0) {
    return (
      <div className="p-4 text-gray-600 bg-gray-50 rounded-md">
        <div className="text-center">
          <p className="mb-2">No regions found.</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 mx-auto"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Found {filteredRegions.length} 
            {regions.length !== filteredRegions.length && ` of ${regions.length}`} Regions
          </h3>
          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
            <span className="flex items-center space-x-1">
              <MapPin size={14} />
              <span>Total regions: {regions.length}</span>
            </span>
          </div>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Search:</label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name..."
              className="text-sm border border-gray-300 rounded px-2 py-1 w-40"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'area')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="name">Name</option>
              <option value="area">Area (largest first)</option>
            </select>
          </div>
          
          {nameFilter && (
            <button
              onClick={() => setNameFilter('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      
      {/* Lista de regiones */}
      <div className="space-y-3">
        {filteredRegions.map((region, index) => {
          const center = calculateRegionCenter(region.points);
          const area = calculateRegionArea(region.points);
          
          return (
            <div 
              key={`${region.id}-${index}`}
              className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
                selectedRegionId === region.id 
                  ? 'border-blue-600 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
              }`}
              onClick={() => onSelectRegion(region)}
            >
              <div className="flex items-center p-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{region.name}</h4>
                  <p className="text-sm text-gray-500">ID: {region.id}</p>
                  <div className="flex mt-1 space-x-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {region.points.length} points
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Area: {area.toFixed(4)}°²
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-center w-10 h-10 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full">
                  <PlayCircle size={20} />
                </div>
              </div>
              
              {/* Información adicional */}
              <div className="px-3 py-2 text-sm bg-gray-50 border-t border-gray-200">
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">Center:</span> 
                    <span className="ml-1">
                      {center.lat.toFixed(4)}°, {center.lng.toFixed(4)}°
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Coordinates range:</span>
                    <span className="ml-1">
                      Lat: {Math.min(...region.points.map(p => p.latitude)).toFixed(4)}° to {Math.max(...region.points.map(p => p.latitude)).toFixed(4)}°,
                      Lng: {Math.min(...region.points.map(p => p.longitude)).toFixed(4)}° to {Math.max(...region.points.map(p => p.longitude)).toFixed(4)}°
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegionsList;