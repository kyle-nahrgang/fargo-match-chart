# Deploying to GitHub Pages

## Setup

Deploy this repository as one Node web service. Render is configured by [render.yaml](render.yaml): it builds the React app and runs the Express server from the same deployment.

1. Create a new Render Web Service from this GitHub repository.
2. Use the included `render.yaml`, or set the build command to `npm ci && npm run build` and the start command to `npm start`.
3. Open the URL provided by Render. No `VITE_BACKEND_URL` variable is needed because the frontend and backend share the same origin.

## Local development

```bash
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

The app and API are served from the same Render URL. GitHub Pages is not used because it cannot run the Express server, and FargoRate's division schedule report is a POST request that blocks public CORS proxies.
