# Siddique Admin Dashboard

A full-stack administrative platform featuring a React frontend and Node.js/Express backend, tightly integrated with Supabase for secure data management, authentication, and file storage.

## Repository Structure

- `/client` - The Vite + React Frontend application.
- `/server` - The Node.js + Express Backend API layer.

## Environment Variables

DO NOT commit your `.env` files to GitHub. You will need to configure these securely within your deployment provider (e.g., Vercel, Render, Heroku). 

**Client (`/client/.env`) Required Keys:**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=https://your-deployed-backend.com/api
```

**Server (`/server/.env`) Required Keys:**
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Running Locally

1. Open two terminals.
2. In Terminal 1: `cd server` -> `npm install` -> `npm run dev`
3. In Terminal 2: `cd client` -> `npm install` -> `npm run dev`

## Deployment Strategy

### Option 1: Vercel (Frontend) + Render (Backend)
This is the most common free-tier strategy.
1. Deploy the `/client` folder directly to **Vercel**. Make sure to set the build command to `npm run build` and output directory to `dist`. Add the Frontend Environment variables in Vercel.
2. Deploy the `/server` folder to **Render** as a "Web Service". The start command is `npm start`. Make sure you inject the Server Environment variables in Render's dashboard.

### Option 2: Full VPS (DigitalOcean / AWS / GCP)
If you own a single virtual server:
1. Clone this repository to your server.
2. Use `pm2` to run the active Node server.
3. Build the client (`npm run build`) and serve the `/dist` directory statically using NGINX.
