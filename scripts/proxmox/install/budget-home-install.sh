#!/usr/bin/env bash

# Budget-Home LXC Install Script
# Runs inside the LXC container on Debian 12
# Idempotent — safe to re-run

set -euo pipefail

# Minimal Debian LXC containers often have no locale generated.
# C.UTF-8 is always available without needing locale-gen.
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# Color / logging (community-scripts conventions)
# ---------------------------------------------------------------------------
YW=$(printf '\033[33m')
BL=$(printf '\033[36m')
RD=$(printf '\033[01;31m')
GN=$(printf '\033[1;92m')
DGN=$(printf '\033[32m')
CL=$(printf '\033[m')
BFR="\\r\\033[K"
HOLD="  "
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"

msg_info()  { local m="$1"; printf "${HOLD}${YW}○${CL} %s..." "$m"; }
msg_ok()    { local m="$1"; printf "${BFR}${CM} %s\n" "$m"; }
msg_error() { local m="$1"; printf "${BFR}${CROSS} %s\n" "$m"; exit 1; }

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BUDGET_HOME_TZ="${BUDGET_HOME_TZ:-}"  # set by ct/budget-home.sh; empty = prompt/skip
REPO_URL="${BUDGET_HOME_REPO:-https://github.com/Landelor/Budget-Home.git}"
INSTALL_DIR="${BUDGET_HOME_DIR:-/opt/Budget-Home}"
APP_USER="budgetapp"
DB_NAME="budgetapp"
DB_USER="budgetapp"
DB_PASS="${BUDGET_HOME_DB_PASS:-$(openssl rand -hex 16)}"
JWT_SECRET="${BUDGET_HOME_JWT_SECRET:-$(openssl rand -hex 32)}"
API_PORT="${BUDGET_HOME_PORT:-3000}"
LXC_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
FRONTEND_ORIGIN="${BUDGET_HOME_ORIGIN:-http://${LXC_IP}}"

# ---------------------------------------------------------------------------
# 1. System update
# ---------------------------------------------------------------------------
msg_info "Updating system packages"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl \
  ca-certificates \
  gnupg \
  git \
  nginx \
  openssl \
  sudo >/dev/null 2>&1
msg_ok "System packages updated"

# ---------------------------------------------------------------------------
# 1b. Timezone
# ---------------------------------------------------------------------------
if [ -z "${BUDGET_HOME_TZ}" ] && [ -t 0 ]; then
  # Interactive standalone run: prompt the user
  CURRENT_TZ=$(cat /etc/timezone 2>/dev/null || echo "UTC")
  read -rp "  Timezone [${CURRENT_TZ}]: " INPUT_TZ
  BUDGET_HOME_TZ="${INPUT_TZ:-${CURRENT_TZ}}"
fi
if [ -n "${BUDGET_HOME_TZ}" ]; then
  if [ ! -f "/usr/share/zoneinfo/${BUDGET_HOME_TZ}" ]; then
    msg_error "Unknown timezone '${BUDGET_HOME_TZ}'. Check /usr/share/zoneinfo/ for valid names."
  fi
  msg_info "Setting timezone to ${BUDGET_HOME_TZ}"
  ln -sf "/usr/share/zoneinfo/${BUDGET_HOME_TZ}" /etc/localtime
  echo "${BUDGET_HOME_TZ}" > /etc/timezone
  msg_ok "Timezone set to ${BUDGET_HOME_TZ}"
fi

# ---------------------------------------------------------------------------
# 2. Node.js 20
# ---------------------------------------------------------------------------
if ! node --version 2>/dev/null | grep -q "^v20"; then
  msg_info "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  msg_ok "Node.js $(node --version) installed"
else
  msg_ok "Node.js $(node --version) already installed"
fi

# ---------------------------------------------------------------------------
# 3. PostgreSQL 16
# ---------------------------------------------------------------------------
if ! pg_lsclusters 2>/dev/null | grep -q "16"; then
  msg_info "Installing PostgreSQL 16"
  # Resolve distro codename without lsb_release (not installed in minimal containers)
  DISTRO_CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-bookworm}")
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg >/dev/null 2>&1
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
https://apt.postgresql.org/pub/repos/apt ${DISTRO_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-16 >/dev/null 2>&1
  msg_ok "PostgreSQL 16 installed"
else
  msg_ok "PostgreSQL 16 already installed"
fi

systemctl enable --quiet postgresql
systemctl start postgresql

# ---------------------------------------------------------------------------
# 4. PostgreSQL database & user
# ---------------------------------------------------------------------------
msg_info "Configuring PostgreSQL"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c \
    "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c \
    "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
fi
msg_ok "PostgreSQL database '${DB_NAME}' ready"

# ---------------------------------------------------------------------------
# 5. App user
# ---------------------------------------------------------------------------
if ! id "${APP_USER}" &>/dev/null; then
  msg_info "Creating system user ${APP_USER}"
  useradd --system --shell /usr/sbin/nologin --home-dir "${INSTALL_DIR}" "${APP_USER}"
  msg_ok "User ${APP_USER} created"
fi

# ---------------------------------------------------------------------------
# 6. Clone / update repo
# ---------------------------------------------------------------------------
if [ ! -d "${INSTALL_DIR}/.git" ]; then
  msg_info "Cloning Budget-Home from ${REPO_URL}"
  git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}" >/dev/null 2>&1
  msg_ok "Repository cloned to ${INSTALL_DIR}"
else
  # Allow root to operate on repo owned by budgetapp (git 2.35.2+ safe.directory check)
  git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
  msg_info "Updating repository"
  git -C "${INSTALL_DIR}" fetch --quiet origin
  git -C "${INSTALL_DIR}" reset --quiet --hard origin/main
  msg_ok "Repository updated"
fi

# ---------------------------------------------------------------------------
# 7. Create uploads directory (persists across updates)
# ---------------------------------------------------------------------------
mkdir -p "${INSTALL_DIR}/apps/api/uploads"
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/apps/api/uploads"

# ---------------------------------------------------------------------------
# 8. Environment file
# ---------------------------------------------------------------------------
ENV_FILE="${INSTALL_DIR}/apps/api/.env"
if [ ! -f "${ENV_FILE}" ]; then
  msg_info "Writing .env"
  cat > "${ENV_FILE}" <<EOF
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
PORT=${API_PORT}
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGIN=${FRONTEND_ORIGIN}
JWT_SECRET=${JWT_SECRET}
FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
EOF
  chmod 600 "${ENV_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  msg_ok ".env written to ${ENV_FILE}"
else
  msg_ok ".env already exists — skipping (edit manually to change secrets)"
fi

# ---------------------------------------------------------------------------
# 9. npm install & build
# ---------------------------------------------------------------------------
msg_info "Installing npm dependencies (npm ci)"
cd "${INSTALL_DIR}"
npm ci --silent >/dev/null 2>&1
msg_ok "npm dependencies installed"

msg_info "Building all workspaces"
npm run build --silent >/dev/null 2>&1
msg_ok "Build complete"

# ---------------------------------------------------------------------------
# 10. Run database migrations
# ---------------------------------------------------------------------------
msg_info "Running database migrations"
DATABASE_URL="$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2-)" \
  npm run db:migrate --workspace=packages/db --silent >/dev/null 2>&1
msg_ok "Migrations applied"

# ---------------------------------------------------------------------------
# 11. Set ownership
# ---------------------------------------------------------------------------
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
# uploads dir already set; re-set after chown -R in case it changed
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/apps/api/uploads"

# ---------------------------------------------------------------------------
# 12. systemd service for API
# ---------------------------------------------------------------------------
msg_info "Configuring systemd service"
cat > /etc/systemd/system/budget-home-api.service <<EOF
[Unit]
Description=Budget-Home API (Fastify)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node apps/api/dist/index.js
EnvironmentFile=${INSTALL_DIR}/apps/api/.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=budget-home-api

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --quiet budget-home-api
systemctl restart budget-home-api
msg_ok "budget-home-api service enabled and started"

# ---------------------------------------------------------------------------
# 13. nginx
# ---------------------------------------------------------------------------
msg_info "Configuring nginx"
cat > /etc/nginx/sites-available/budget-home <<EOF
server {
    listen 80 default_server;
    server_name _;

    # Serve the React/Vite static build
    root ${INSTALL_DIR}/apps/web/dist;
    index index.html;

    # Proxy /api to Fastify
    location /api/ {
        proxy_pass         http://127.0.0.1:${API_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Serve uploaded attachments
    location /uploads/ {
        alias ${INSTALL_DIR}/apps/api/uploads/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/budget-home /etc/nginx/sites-enabled/budget-home
nginx -t >/dev/null 2>&1
systemctl enable --quiet nginx
systemctl reload nginx
msg_ok "nginx configured and reloaded"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
printf "\n${GN}Budget-Home installation complete!${CL}\n"
printf "\n${DGN}Access the app at: ${BL}http://%s${CL}\n" "${LXC_IP}"
printf "${DGN}API health:        ${BL}http://%s/api/healthz${CL}\n\n" "${LXC_IP}"
