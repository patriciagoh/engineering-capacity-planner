# Hosting — Capacity Web App

A static site that runs the real Python engine in your browser via Pyodide.
No backend server. Published to GitHub Pages, gated by a shared password
(staticrypt).

## One-time setup
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → New secret**:
   `STATICRYPT_PASSWORD` = the shared password you'll give viewers.

## Deploy
Push to `main` (touching `web/**` or `engine/**`), or run the **Deploy capacity
web app** workflow manually. It builds the engine wheel, builds the web bundle,
encrypts the entry page, and publishes to Pages. The published URL appears in the
workflow's deploy step.

The workflow builds with `VITE_BASE=/<repo-name>/` so all assets resolve under the
Pages project subpath automatically — no manual base config needed. (A user/org
page or custom domain at the root works too; just build without `VITE_BASE`.)

## What viewers experience
Open the URL → enter the shared password → the app loads. First load takes a few
seconds while the Python-in-WASM engine boots ("Warming up the engine…").

## Run locally
```
cd web && ./scripts/prepare-engine-assets.sh && npm install && npm run dev
```
No server needed — the engine runs in the browser. (To run against the FastAPI
backend instead: `VITE_API_MODE=http npm run dev` with the server started.)

## Note on the password
staticrypt encrypts the entry page; the JS bundle and `sample_org.json` remain
fetchable by direct URL. That's fine here — the data is fictional and the code is
open-source. The gate keeps the page from being trivially public, not secret.
