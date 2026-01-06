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
   - Under "Source", select "GitHub Actions"
   - Save the settings

3. **Update Base Path (if needed)**
   - If your repository name is NOT `fargo`, update the `VITE_BASE_PATH` in `.github/workflows/deploy.yml`
   - For project pages (e.g., `username.github.io/fargo`), use `/fargo/`
   - For user/organization pages (e.g., `username.github.io`), use `/`

4. **Trigger Deployment**
   - Push any commit to the `main` branch, or
   - Go to Actions tab and manually trigger the workflow

## How It Works

- **Development**: Uses Express server on `localhost:3000` for API calls
- **Production (GitHub Pages)**: Calls FargoRate API directly from the browser
- The app automatically detects the environment and uses the appropriate method

## Troubleshooting

- **404 errors**: Check that `VITE_BASE_PATH` matches your repository name
- **API errors**: Ensure the FargoRate API allows CORS requests from your domain
- **Build fails**: Check GitHub Actions logs for specific errors

