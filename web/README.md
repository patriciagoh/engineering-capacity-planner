# Capacity Planning — Web App

## Run it
1. Start the API (seeded with the sample org):
   ```
   cd ../server && . .venv/bin/activate && uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000
   ```
2. Start the web app:
   ```
   cd web && npm install && npm run dev
   ```
3. Open the printed URL (default http://localhost:5173). Vite proxies `/org`, `/teams`, `/groups` to the API on :8000.

## Test
```
npm test
```
