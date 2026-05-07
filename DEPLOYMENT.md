# 🚀 Deployment Guide — Siddiqui Admin Panel

> **Target:** `admin.siddiqui.digital` on VPS with Nginx + PM2 + SSL (Certbot)
> **Stack:** React (Vite) frontend + Express.js backend + Supabase + iPage SMTP

---

## 1. Pull Latest Code

SSH into your VPS and pull from the repository:

```bash
cd /path/to/siddique-admin
git pull origin main
```

> ⚠️ `.env` files are gitignored and must be placed manually (Step 2).

---

## 2. Create/Update Server `.env`

The `.env` file must be at `server/.env` on the VPS. Create it if it doesn't exist:

```bash
nano /path/to/siddique-admin/server/.env
```

Paste the following (fill in your actual values):

```env
PORT=5001
NODE_ENV=production

# ── Frontend URL ─────────────────────────────────────────────────────
FRONTEND_URL=https://admin.siddiqui.digital

# ── Supabase ─────────────────────────────────────────────────────────
SUPABASE_URL=https://cneariiepqywvjpmznqn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>

# ── SMTP (iPage) ──────────────────────────────────────────────────────
SMTP_HOST=smtp.ipage.com
SMTP_PORT=587
SMTP_USER=no-reply@siddiqui.digital
SMTP_PASS=<your-smtp-password>
SMTP_FROM="Siddiqui Digital <info@siddiqui.digital>"
ADMIN_EMAIL=info@siddiqui.digital
```

---

## 3. Install Server Dependencies

```bash
cd /path/to/siddique-admin/server
npm install --production
```

---

## 4. Start/Restart the Backend with PM2

```bash
cd /path/to/siddique-admin/server

# First time: start with ecosystem file
pm2 start pm2.config.cjs --env production

# OR if already running, restart with new config:
pm2 restart siddique-admin-api

# Verify it's running:
pm2 status

# Confirm API health check works:
curl http://localhost:5001/api/health
```

Expected response: `{"status":"ok","timestamp":"..."}`

**If PM2 isn't installed:**
```bash
npm install -g pm2
```

**Save PM2 process list for auto-start on reboot:**
```bash
pm2 save
pm2 startup    # Follow the command it prints
```

---

## 5. Build the Frontend

```bash
cd /path/to/siddique-admin/client

# Install dependencies
npm install

# Build for production (uses .env.production automatically)
npm run build

# The output goes to client/dist/
```

---

## 6. Deploy Frontend to Nginx Web Root

```bash
# Clear old build files
sudo rm -rf /var/www/admin/*

# Copy new build
sudo cp -r /path/to/siddique-admin/client/dist/* /var/www/admin/

# Fix permissions
sudo chown -R www-data:www-data /var/www/admin
sudo chmod -R 755 /var/www/admin
```

---

## 7. Update Nginx Configuration

Edit `/etc/nginx/sites-available/admin.siddiqui.digital`:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name admin.siddiqui.digital;
    return 301 https://$host$request_uri;
}

# Main HTTPS server block
server {
    listen 443 ssl;
    http2 on;
    server_name admin.siddiqui.digital;

    root /var/www/admin;
    index index.html;

    # SSL (managed by Certbot — do not edit manually)
    ssl_certificate /etc/letsencrypt/live/admin.siddiqui.digital/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.siddiqui.digital/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Gzip compression for faster asset delivery
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    # ── Frontend SPA ─────────────────────────────────────────────────
    # ALL routes go to index.html so React Router can handle them.
    # Without this, direct URL visits (e.g. /login, /dashboard) return 404.
    location / {
        try_files $uri $uri/ /index.html;

        # Don't cache index.html — ensures users always get the latest build
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            expires 0;
        }
    }

    # Cache static assets aggressively (Vite hashes filenames)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Backend API Proxy ─────────────────────────────────────────────
    # Proxies /api/* to the Node.js backend on port 5001.
    # The proxy_set_header lines ensure Express gets correct host/IP/protocol info.
    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts — prevent Nginx dropping long API requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Disable buffering for streaming responses (if any)
        proxy_buffering off;

        # Increase body size limit for blog image uploads (5MB + margin)
        client_max_body_size 10M;
    }
}
```

**Apply and reload:**

```bash
# Test the config first — never reload with a syntax error
sudo nginx -t

# If OK:
sudo systemctl reload nginx
```

---

## 8. Verify Everything Is Working

Run these checks from your browser and terminal:

### Terminal (on VPS)
```bash
# Backend health check
curl https://admin.siddiqui.digital/api/health
# Expected: {"status":"ok","timestamp":"..."}

# PM2 status
pm2 status

# Nginx error log (last 20 lines)
sudo tail -20 /var/log/nginx/error.log

# App error log
pm2 logs siddique-admin-api --lines 30
```

### Browser
1. Visit `https://admin.siddiqui.digital` → should load login page
2. Visit `https://admin.siddiqui.digital/login` directly → should NOT 404
3. Open DevTools → Network tab → no CORS errors
4. Sign in with existing credentials → dashboard should load
5. Test Forgot Password → reset email should arrive with `admin.siddiqui.digital` link

---

## 9. Common Issues & Quick Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| API calls return 502 | Backend not running | `pm2 restart siddique-admin-api` |
| API calls return 404 | Nginx `/api` proxy not configured | Check Nginx config (Step 7) |
| Direct URLs return 404 | SPA `try_files` missing | Check `location /` in Nginx config |
| CORS errors in DevTools | OPTIONS preflight blocked | Pull latest code (fixed in `server/src/index.js`) |
| PM2 shows `errored` | `.env` missing/invalid | Check `server/.env` exists with correct values |
| Reset email has localhost link | `FRONTEND_URL` missing | Add to `server/.env` and restart PM2 |
| Images not uploading | Nginx body size limit | Check `client_max_body_size 10M` in Nginx |

---

## 10. Supabase Dashboard Settings (One-Time)

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication → URL Configuration**:

- **Site URL:** `https://admin.siddiqui.digital`
- **Redirect URLs (whitelist):** Add `https://admin.siddiqui.digital/**`

This ensures password reset and email confirmation links point to the correct domain.
