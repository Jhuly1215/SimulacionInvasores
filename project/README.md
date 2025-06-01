# Invasive Species Simulation Platform

An interactive web application for simulating and visualizing biological invasions across geographical regions.

## Features

- **Interactive Map**: Select regions and visualize invasion spread
- **Species Catalog**: Browse, filter, and select invasive species
- **Custom Parameters**: Configure simulation parameters
- **Environmental Layers**: Include geographical factors affecting spread
- **Dynamic Simulation**: Visualize invasion spread over time
- **Data Visualization**: View charts and statistics about invasion impacts
- **AI Analysis**: Get ecological insights powered by LLM

## Tech Stack

- React with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Leaflet.js for interactive maps
- Recharts for data visualization
- React Query for data fetching
- Axios for API requests

## Getting Started

1. Clone this repository
2. Install dependencies:

```
npm install
```

3. Start the development server:

```
npm run dev
```

4. Open your browser to the URL shown in the console

## API Integration

The application is designed to work with a backend API that provides:

- Invasive species data for geographical regions
- Environmental layers data
- Simulation capabilities
- LLM-powered analysis

In development mode, mock data is used to simulate these API endpoints.

## Project Structure

- `/src/components`: UI components organized by feature
- `/src/hooks`: Custom React hooks for business logic
- `/src/api`: API integration and mock data
- `/src/types`: TypeScript type definitions

## Deployment

Build the application for production:

```
npm run build
```

Preview the production build:

```
npm run preview
```

## License

MIT