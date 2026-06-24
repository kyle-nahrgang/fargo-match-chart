# Deploying to GitHub Pages

## Setup Instructions

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Navigate to Settings → Pages
   - Under "Build and deployment → Source", choose **one** of:
     - **GitHub Actions** (recommended), or
     - **Deploy from a branch** → branch `gh-pages` → folder `/ (root)`
   - Do **not** deploy from the `main` branch. The source `index.html` references dev files like `/src/main.jsx` and will 404 on GitHub Pages.

3. **Trigger Deployment**
   - Push any commit to the `main` branch, or
   - Go to Actions tab and manually trigger the workflow

## How It Works

- **Development**: Uses Express server on `localhost:3000` for API calls
- **Production (GitHub Pages)**: Calls FargoRate API directly from the browser
- The app automatically detects the environment and uses the appropriate method

## Troubleshooting

- **`main.jsx` or `vite.svg` 404 errors**: GitHub Pages is serving the unbuilt source tree (usually because Source is set to the `main` branch). Switch Source to **GitHub Actions** or the **`gh-pages` branch**, then re-run the deploy workflow.
- **Asset 404 errors**: The workflow sets `VITE_BASE_PATH` automatically from the repository name. For project pages, assets are served from `/<repo-name>/assets/...`.
- **API errors**: Ensure the FargoRate API allows CORS requests from your domain
- **Build fails**: Check GitHub Actions logs for specific errors

