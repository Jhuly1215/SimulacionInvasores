import * as L from 'leaflet';

declare module 'leaflet' {
  namespace DrawEvents {
    interface Created {
      layerType: string;
      layer: L.Layer;
    }
  }

  namespace Draw {
    let Event: {
      CREATED: 'draw:created';
      EDITED: 'draw:edited';
      DELETED: 'draw:deleted';
    };
  }
}