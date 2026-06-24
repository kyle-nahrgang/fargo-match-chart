# Deploying to GitHub Pages

## Setup

1. Push to the `main` branch (or run the **Deploy to GitHub Pages** workflow manually).
2. In **Settings → Pages → Build and deployment**, set Source to **GitHub Actions**.

The workflow builds on every push to `main` and publishes the `dist/` output to GitHub Pages.

## Local development

```bash
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

The app is served at `https://kyle-nahrgang.github.io/fargo-match-chart/` with assets under `/fargo-match-chart/`.
