import React, { useEffect } from 'react';
import { Species } from '../../types';
import { PlayCircle, RefreshCw } from 'lucide-react';
import { Loader } from '../UI/Loader';
import { useSpeciesList } from '../../hooks/useSpeciesList';

interface SpeciesListProps {
  regionId?: string; // ID de la región para cargar especies automáticamente
  species?: Species[]; // Especies manuales (opcional, para retrocompatibilidad)
  isLoading?: boolean; // Loading manual (opcional)
  error?: Error | null; // Error manual (opcional)
  onSelectSpecies: (species: Species) => void;
  selectedSpeciesId?: string;
  showFilters?: boolean; // Mostrar filtros avanzados
  autoRefresh?: boolean; // Auto-refrescar cuando cambie regionId
}

const SpeciesList: React.FC<SpeciesListProps> = ({
  regionId,
  species: manualSpecies,
  isLoading: manualLoading,
  error: manualError,
  onSelectSpecies,
  selectedSpeciesId,
  showFilters = false,
  autoRefresh = true,
}) => {
  // Usar el hook solo si tenemos regionId
  const {
    species: hookSpecies,
    loading: hookLoading,
    error: hookError,
    fetchSpeciesFromRegion,
    getSpeciesByStatus,
    getSpeciesByImpact,
    getSpeciesCount,
    getImpactDistribution,
  } = useSpeciesList(autoRefresh ? regionId : undefined);

  // Estados para filtros
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [impactFilter, setImpactFilter] = React.useState<Species['impactSummary'] | ''>('');

  // Determinar qué datos usar (hook vs manual)
  const species = regionId ? hookSpecies : (manualSpecies || []);
  const isLoading = regionId ? hookLoading : (manualLoading || false);
  const error = regionId ? hookError : manualError;

  // Refrescar manualmente si no es auto-refresh
  const handleRefresh = () => {
    if (regionId) {
      fetchSpeciesFromRegion(regionId);
    }
  };

  // Aplicar filtros si están habilitados
  let filteredSpecies = species;
  if (showFilters && regionId) {
    if (statusFilter) {
      filteredSpecies = getSpeciesByStatus(statusFilter);
    }
    if (impactFilter) {
      filteredSpecies = getSpeciesByImpact(impactFilter);
    }
  }

  // Estadísticas
  const totalSpecies = regionId ? getSpeciesCount() : species.length;
  const impactStats = regionId ? getImpactDistribution() : getImpactDistributionManual(species);

  if (isLoading) {
    return <Loader message="Loading species data..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-error-500 bg-error-500/10 rounded-md">
        <div className="flex items-center justify-between">
          <span>Failed to load species data. Please try again.</span>
          {regionId && (
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-800"
            >
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (species.length === 0) {
    return (
      <div className="p-4 text-secondary-600 bg-secondary-600/10 rounded-md">
        <div className="text-center">
          <p className="mb-2">
            {regionId 
              ? "No species found for this region." 
              : "No species found. Please select a region or adjust your filters."
            }
          </p>
          {regionId && (
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-800 mx-auto"
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
            Found {filteredSpecies.length} 
            {totalSpecies !== filteredSpecies.length && ` of ${totalSpecies}`} Species
          </h3>
          {regionId && (
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Severe: {impactStats.severe}</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>High: {impactStats.high}</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Medium: {impactStats.medium}</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Low: {impactStats.low}</span>
              </span>
            </div>
          )}
        </div>
        
        {regionId && (
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-800"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      {showFilters && regionId && (
        <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All</option>
              <option value="invasive">Invasive</option>
              <option value="non-invasive">Non-invasive</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Impact:</label>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value as Species['impactSummary'] | '')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          
          {(statusFilter || impactFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setImpactFilter('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      
      {/* Lista de especies */}
      <div className="space-y-3">
        {filteredSpecies.map((sp) => (
          <div 
            key={sp.id}
            className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
              selectedSpeciesId === sp.id 
                ? 'border-primary-600 bg-primary-50 shadow-md' 
                : 'border-gray-200 hover:border-primary-300 hover:shadow-sm'
            }`}
            onClick={() => onSelectSpecies(sp)}
          >
            <div className="flex items-center p-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{sp.name}</h4>
                <p className="text-sm text-gray-500 italic">{sp.scientificName}</p>
                <div className="flex mt-1 space-x-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeColor(sp.status)}`}>
                    {sp.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getImpactBadgeColor(sp.impactSummary)}`}>
                    {sp.impactSummary} impact
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-center w-10 h-10 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-full">
                <PlayCircle size={20} />
              </div>
            </div>
            
            {/* Información adicional */}
            <div className="px-3 py-2 text-sm bg-gray-50 border-t border-gray-200">
              <div className="space-y-1">
                <div>
                  <span className="font-medium">Habitat:</span> {sp.primaryHabitat.join(', ')}
                </div>
                {sp.recommendedLayers && sp.recommendedLayers.length > 0 && (
                  <div>
                    <span className="font-medium">Recommended layers:</span> {sp.recommendedLayers.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper functions
function getImpactBadgeColor(impact: string): string {
  switch (impact) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'severe':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'invasive':
      return 'bg-red-100 text-red-800';
    case 'non-invasive':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getImpactDistributionManual(species: Species[]): Record<Species['impactSummary'], number> {
  const distribution: Record<Species['impactSummary'], number> = {
    low: 0,
    medium: 0,
    high: 0,
    severe: 0,
  };

  species.forEach(sp => {
    distribution[sp.impactSummary]++;
  });

  return distribution;
}

export default SpeciesList;