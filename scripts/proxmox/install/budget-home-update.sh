#!/usr/bin/env bash

# Budget-Home LXC Update Script
# Runs inside an existing LXC container
# Idempotent — safe to re-run

set -euo pipefail

export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# Color / logging
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
INSTALL_DIR="${BUDGET_HOME_DIR:-/opt/Budget-Home}"
ENV_FILE="${INSTALL_DIR}/apps/api/.env"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [ ! -d "${INSTALL_DIR}/.git" ]; then
  msg_error "Budget-Home is not installed at ${INSTALL_DIR}. Run budget-home-install.sh first."
fi

if [ ! -f "${ENV_FILE}" ]; then
  msg_error ".env not found at ${ENV_FILE}. Installation may be incomplete."
fi

# ---------------------------------------------------------------------------
# Capture current version
# ---------------------------------------------------------------------------
FROM_VERSION=$(git -C "${INSTALL_DIR}" describe --tags --always 2>/dev/null || \
               node -e "const p=require('${INSTALL_DIR}/package.json'); console.log(p.version)" 2>/dev/null || \
               echo "unknown")
FROM_COMMIT=$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

printf "\n${BL}Budget-Home Updater${CL}\n"
printf "Current version: ${DGN}%s${CL} (%s)\n\n" "${FROM_VERSION}" "${FROM_COMMIT}"

# ---------------------------------------------------------------------------
# 1. Pull latest code
# ---------------------------------------------------------------------------
msg_info "Pulling latest code from origin/main"
git -C "${INSTALL_DIR}" fetch --quiet origin
UPSTREAM=$(git -C "${INSTALL_DIR}" rev-parse origin/main)
LOCAL=$(git -C "${INSTALL_DIR}" rev-parse HEAD)

if [ "${UPSTREAM}" = "${LOCAL}" ]; then
  printf "${BFR}${CM} Already up to date (${FROM_COMMIT})\n"
  # Still continue — dependencies or migrations may need updating
else
  git -C "${INSTALL_DIR}" reset --quiet --hard origin/main
  msg_ok "Code updated"
fi

# ---------------------------------------------------------------------------
# 2. npm install
# ---------------------------------------------------------------------------
msg_info "Installing npm dependencies"
cd "${INSTALL_DIR}"
npm ci --silent >/dev/null 2>&1
msg_ok "Dependencies up to date"

# ---------------------------------------------------------------------------
# 3. Build
# ---------------------------------------------------------------------------
msg_info "Building all workspaces"
npm run build --silent >/dev/null 2>&1
msg_ok "Build complete"

# ---------------------------------------------------------------------------
# 4. Database migrations
# ---------------------------------------------------------------------------
msg_info "Running database migrations"
DATABASE_URL="$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2-)" \
  npm run db:migrate --workspace=packages/db --silent >/dev/null 2>&1
msg_ok "Migrations applied"

# ---------------------------------------------------------------------------
# 5. Restore ownership (in case new files landed as root)
# ---------------------------------------------------------------------------
APP_USER="budgetapp"
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/apps/api/uploads"

# ---------------------------------------------------------------------------
# 6. Restart services
# ---------------------------------------------------------------------------
msg_info "Restarting budget-home-api"
systemctl restart budget-home-api
msg_ok "budget-home-api restarted"

msg_info "Reloading nginx"
nginx -t >/dev/null 2>&1
systemctl reload nginx
msg_ok "nginx reloaded"

# ---------------------------------------------------------------------------
# Done — version summary
# ---------------------------------------------------------------------------
TO_VERSION=$(git -C "${INSTALL_DIR}" describe --tags --always 2>/dev/null || \
             node -e "const p=require('${INSTALL_DIR}/package.json'); console.log(p.version)" 2>/dev/null || \
             echo "unknown")
TO_COMMIT=$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

printf "\n${GN}Update complete!${CL}\n"
printf "  From: ${RD}%s${CL} (%s)\n" "${FROM_VERSION}" "${FROM_COMMIT}"
printf "  To:   ${GN}%s${CL} (%s)\n\n" "${TO_VERSION}" "${TO_COMMIT}"
