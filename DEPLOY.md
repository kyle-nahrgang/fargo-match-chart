# Deploying to GitHub Pages

## One-time setup (required)

Your site URL is `https://kyle-nahrgang.github.io/fargo-match-chart/`.

Go to **Settings → Pages → Build and deployment → Source** and choose **one** of:

| Source | Branch / folder |
|--------|-----------------|
| **GitHub Actions** (recommended) | — |
| Deploy from a branch | `gh-pages` / `/ (root)` |
| Deploy from a branch | `main` / `/docs` |

**Do not use `main` branch, folder `/ (root)`.** That serves the Vite dev entry point (`/src/main.jsx`, `/manifest.json` at the domain root) and everything 404s.

After changing the source, push to `main` or re-run the **Deploy to GitHub Pages** workflow, then hard-refresh the site.

## How deployment works

Each push to `main` builds the app and publishes it to:

1. **GitHub Actions artifact** (when Source = GitHub Actions)
2. **`gh-pages` branch** (when Source = branch `gh-pages`)
3. **`docs/` folder on `main`** (when Source = branch `main`, folder `/docs`)

## Troubleshooting

- **`main.jsx`, `manifest.json`, or `icons/` 404 at `github.io/...` (without `/fargo-match-chart/` prefix)**  
  Pages is serving the unbuilt repo root. Fix the Source setting above.

- **Hard refresh**  
  Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) after a deploy finishes.

- **API errors**  
  Ensure the FargoRate API allows CORS from your domain.
