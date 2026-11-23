# Institutional Deployment Guide
**NCC Digital Command & Cadet Management System**
*Army Institute of Technology (AIT), Pune NCC Unit (2 Maharashtra Bn NCC)*

---

## 1. System Architecture Overview

The system is architected as a high-security, containerized micro-architecture tailored for institutional defence compliance:

```
┌────────────────────────────────────────────────────────┐
│               Public / Cadet Browser Clients            │
└───────────────────────────┬────────────────────────────┘
                            │ (Ports 80 / 443 HTTPS)
                            ▼
┌────────────────────────────────────────────────────────┐
│            Frontend Web Server (Nginx Alpine)          │
│ - Serves Optimized React 19 SPA Assets                 │
│ - Enforces CSP, X-Frame-Options, HSTS                  │
│ - Reverse Proxies /api/ to Backend                     │
└───────────────────────────┬────────────────────────────┘
                            │ (Internal Docker Network)
                            ▼
┌────────────────────────────────────────────────────────┐
│         Command API Server (Node.js 20 Express)         │
│ - Port 5050                                            │
│ - Server-Side RBAC Enforcement                         │
│ - SHA-256 Cryptographic Digest Engine                  │
│ - Notification Gateway (SMTP Email, SMS DLT)          │
│ - Prisma ORM Connection Pool                           │
└───────────────────────────┬────────────────────────────┘
                            │ (Port 5432)
                            ▼
┌────────────────────────────────────────────────────────┐
│            PostgreSQL 16 Database Engine               │
│ - Persistent Volume: ncc_pgdata                        │
│ - Real-time Attendance, Drill, Certificates, Cadets   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Local-only Docker stack (creates a new empty local database)

This Compose setup is for isolated local development. `docker compose up` creates a new PostgreSQL volume; it does not discover, import, or reuse any existing hosted database. Do not run it as production setup or point it at a database containing cadet records.

### Prerequisites
- Docker Engine $\ge$ 24.0
- Docker Compose $\ge$ 2.20

### Launch the Complete Stack
```bash
# 1. Clone or navigate to the project directory
cd "/Users/syedabrarahmed/Desktop/NCC Web & App"

# 2. Build and launch all containers in detached mode
docker compose up -d --build

# 3. Verify container health status
docker compose ps
```

### Local development schema setup

Use only against the disposable local Compose database. For an existing production database, first identify its provider and contents, take and verify a backup, inspect Prisma migration history/schema drift, and use an approved migration plan. Do not use `prisma db push` or run the seed against production.

```bash
# Apply the repository's versioned migrations to the local development database
docker compose exec backend npx prisma migrate dev

# Seed only if this isolated local database needs environment-provided test accounts
docker compose exec backend npm run seed
```

### Live Endpoints
- **Public Portal & Command Center:** `http://localhost:3000` (or `http://your-server-ip`)
- **Backend API & Telemetry:** `http://localhost:5050/api/health`

---

## 3. Production Environment Variables (`.env.production`)

Configure production variables in the hosting provider's secret manager. The following is a variable checklist only; do not put a production `.env` file in GitHub. Use the maintained [`backend/.env.example`](backend/.env.example) for placeholders.

```env
# Do not create a new/empty database until the owner confirms no existing
# cadet records must be retained. Use the verified existing PostgreSQL service.
DATABASE_URL=<existing-postgresql-runtime-url>
DIRECT_URL=<existing-postgresql-direct-migration-url>

# Security & Sessions
JWT_SECRET=<GENERATE_A_UNIQUE_RANDOM_SECRET_AND_STORE_OUTSIDE_GIT>
OTP_SECRET=<GENERATE_A_DIFFERENT_UNIQUE_RANDOM_SECRET>
NODE_ENV=production
PORT=5050
CORS_ORIGIN=<exact-netlify-site-origin>

# Email & SMS Notification Gateway
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<verified-sender-login>
SMTP_PASSWORD=<provider-app-password>
SMTP_FROM_EMAIL=<verified-sender-address>
RECOVERY_RELAY_SECRET=<shared-random-secret-set-on-backend-and-netlify>
PUBLIC_APP_URL=<exact-netlify-site-origin>
```

---

## 4. Bare-Metal Linux VM Deployment (Ubuntu 22.04 LTS / 24.04 LTS)

If deploying directly to a bare-metal Linux server without Docker:

### A. Install System Packages
```bash
sudo apt update && sudo apt install -y nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx
```

### B. Configure PostgreSQL Database

The commands below create a **new empty database** and are only for a fresh isolated installation. Skip them when connecting to an existing database; do not overwrite, reset, or seed a database with existing records.
```bash
sudo -u postgres psql
CREATE DATABASE ncc_command_db;
CREATE ROLE ncc_admin LOGIN;
\password ncc_admin
GRANT ALL PRIVILEGES ON DATABASE ncc_command_db TO ncc_admin;
\q
```

### C. Backend Systemd Service (`/etc/systemd/system/ncc-backend.service`)
```ini
[Unit]
Description=NCC Digital Command API Server
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/ncc-web-app/backend
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
Environment=DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:5432/<DB_NAME>?schema=public

[Install]
WantedBy=multi-user.target
```

Enable and start backend:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ncc-backend
sudo systemctl start ncc-backend
```

### D. Nginx Reverse Proxy & SSL Setup (`/etc/nginx/sites-available/ncc.conf`)
```nginx
server {
    server_name ncc.aitpune.edu.in;

    root /var/www/ncc-web-app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5050/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and acquire free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/ncc.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ncc.aitpune.edu.in
```

---

## 5. Automated Database Backup & Disaster Recovery

Create an automated backup script at `scripts/backup_db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ncc_command"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U postgres ncc_command_db | gzip > "$BACKUP_DIR/ncc_backup_$TIMESTAMP.sql.gz"

# Retain last 30 daily backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```

Add to cron (`crontab -e`):
```cron
0 2 * * * /bin/bash /var/www/ncc-web-app/scripts/backup_db.sh
```

---

## 6. Privileged account bootstrap

Never publish default administrator credentials. The seed script requires privileged account details through `NCC_SEED_*` environment variables and is guarded against implicit database targets. Use it only on an explicitly approved database after backup and data review. For an existing populated database, preserve existing users and use the application's audited account-management workflow instead of reseeding.
