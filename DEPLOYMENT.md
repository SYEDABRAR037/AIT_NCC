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

## 2. Quickstart: 1-Command Docker Deployment

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

### Initial Database Migration & Seed
Run this once after first container creation:
```bash
# Push Prisma schema to PostgreSQL inside the container
docker compose exec backend npx prisma db push

# Seed initial institutional accounts (ANO, DI, Platoon Seniors, Cadets)
docker compose exec backend npm run seed
```

### Live Endpoints
- **Public Portal & Command Center:** `http://localhost:3000` (or `http://your-server-ip`)
- **Backend API & Telemetry:** `http://localhost:5050/api/health`

---

## 3. Production Environment Variables (`.env.production`)

Create a `.env.production` file at the root:

```env
# Database
POSTGRES_USER=ncc_admin
POSTGRES_PASSWORD=MilitaryGradeSecurePassword2026!
POSTGRES_DB=ncc_command_db
DATABASE_URL=postgresql://ncc_admin:MilitaryGradeSecurePassword2026!@db:5432/ncc_command_db?schema=public

# Security & Sessions
JWT_SECRET=super_secret_institutional_jwt_token_key_ait_2mah_bn_2026
NODE_ENV=production
PORT=5050
CORS_ORIGIN=https://ncc.aitpune.edu.in,http://localhost:3000

# Email & SMS Notification Gateway
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ncc.command@aitpune.edu.in
SMTP_PASS=your_app_specific_password_here
```

---

## 4. Bare-Metal Linux VM Deployment (Ubuntu 22.04 LTS / 24.04 LTS)

If deploying directly to a bare-metal Linux server without Docker:

### A. Install System Packages
```bash
sudo apt update && sudo apt install -y nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx
```

### B. Configure PostgreSQL Database
```bash
sudo -u postgres psql
CREATE DATABASE ncc_command_db;
CREATE USER ncc_admin WITH ENCRYPTED PASSWORD 'MilitarySecure2026!';
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
Environment=DATABASE_URL=postgresql://ncc_admin:MilitarySecure2026!@localhost:5432/ncc_command_db?schema=public

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

## 6. Official Institutional Command Credentials (Fresh Launch)

| Role | Identifier / Email | Default Password | Authority Level |
| :--- | :--- | :--- | :--- |
| **Associate NCC Officer (ANO / Admin)** | `ano.admin@aitpune.edu.in` | `AdminCommand@2026` | Institutional Command (Full Access) |
| **Senior Under Officer (SUO / Platoon Senior)** | `platoon.senior@aitpune.edu.in` | `PlatoonLead@2026` | Unit Leadership & Live Face Attendance |
| **Senior Cadet** | `senior.cadet@aitpune.edu.in` | `SeniorCadet@2026` | Cadet Mentorship & Live Face Attendance |

> [!NOTE]
> All test cadet accounts, parade sessions, biometric templates, and test records have been wiped. Cadets will enroll live with real data via the public **Cadet Registration** portal (`#register`) or bulk CSV roster import in the Command Center.
