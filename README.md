# Fargo Matchups

A modern React application that calculates race lengths and odds for all player matchups in a FargoRate match and displays them in a beautiful, interactive grid.

## Features

- 🎨 Modern React UI with beautiful styling
- 📊 Interactive table using @tanstack/react-table
- ⚡ Fast API server with Express
- 🔄 Real-time matchup calculations
- 📱 Responsive design

## Installation

Install dependencies:

```bash
npm install
```

## Usage

### Development Mode

Start both the API server and React dev server:

```bash
npm run dev
```

This will start:
- API server on `http://localhost:3000`
- React dev server on `http://localhost:5173`

Open your browser to `http://localhost:5173` and enter a match ID to analyze.

### Production Build

Build the React app:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The app will be available at `http://localhost:3000`

## How It Works

1. Enter a match ID in the input field
2. Click "Analyze Matchups"
3. The app fetches match data and calculates all possible player matchups
4. Results are displayed in an interactive table showing:
   - Team 1 players listed vertically on the left
   - Team 2 players rotated vertically at the top
   - Race and odds displayed in each cell

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **@tanstack/react-table** - Powerful table library
- **Express** - API server
- **Axios** - HTTP client

## Project Structure

```
fargo/
├── src/
│   ├── components/
│   │   ├── MatchupGrid.jsx    # Main table component
│   │   └── MatchupGrid.css    # Table styles
│   ├── App.jsx                 # Main app component
│   ├── App.css                 # App styles
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles
├── server.js                   # Express API server
├── vite.config.js              # Vite configuration
├── index.html                  # HTML template
└── package.json                # Dependencies

```

## Requirements

- Node.js (v16 or higher)
- npm

## Deployment

### GitHub Pages

The app is configured to deploy to GitHub Pages automatically via GitHub Actions:

1. Push your code to the `main` branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions

The app will be available at `https://[your-username].github.io/[repository-name]/`

### Manual Deployment

1. Build the app: `npm run build`
2. The `dist` folder contains the static files ready for deployment
3. Deploy the `dist` folder to any static hosting service

## API Endpoints

- `GET /api/matchups/:matchId` - Fetches matchup data for a given match ID (development only)
- In production (GitHub Pages), API calls are made directly to the FargoRate API
