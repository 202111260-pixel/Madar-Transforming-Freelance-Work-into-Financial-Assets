Set-Location 'C:\ai-smart-preview'

# Start the API proxy server in background
Start-Process -NoNewWindow node -ArgumentList "scripts/api-server.cjs"

# Start Vite dev server (proxies /api → localhost:3001)
npx vite --port 5173
