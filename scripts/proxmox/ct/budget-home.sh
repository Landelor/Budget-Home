#!/usr/bin/env bash

# Budget-Home — Proxmox LXC Container Creation Script
# Runs on the Proxmox VE host (NOT inside a container).
# Self-contained — does not depend on community-scripts infrastructure.
#
# Usage:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/ct/budget-home.sh)"
#
# Or with overrides:
#   BUDGET_HOME_CTID=210 BUDGET_HOME_STORAGE=local-lvm bash budget-home.sh

set -euo pipefail

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
msg_error() { local m="$1"; printf "${BFR}${CROSS} %s\n" "$m" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight: must run on Proxmox host
# ---------------------------------------------------------------------------
if ! command -v pct &>/dev/null; then
  msg_error "pct not found — this script must run on a Proxmox VE host."
fi

# ---------------------------------------------------------------------------
# Defaults (all overridable via environment variables)
# ---------------------------------------------------------------------------
CTID="${BUDGET_HOME_CTID:-$(pvesh get /cluster/nextid 2>/dev/null || echo 200)}"
HOSTNAME="${BUDGET_HOME_HOSTNAME:-budget-home}"
RAM="${BUDGET_HOME_RAM:-1024}"          # MB
CORES="${BUDGET_HOME_CORES:-2}"
DISK="${BUDGET_HOME_DISK:-8}"           # GB
BRIDGE="${BUDGET_HOME_BRIDGE:-vmbr0}"
IP_CONFIG="${BUDGET_HOME_IP:-ip=dhcp}"  # e.g. "ip=192.168.1.50/24,gw=192.168.1.1"

# Storage detection: prefer local-lvm, fall back to whatever pvesm lists first
if [ -z "${BUDGET_HOME_STORAGE:-}" ]; then
  STORAGE=$(pvesm status --content rootdir 2>/dev/null | awk 'NR>1 && /active/{print $1; exit}' || echo "local-lvm")
else
  STORAGE="${BUDGET_HOME_STORAGE}"
fi

# Template storage (where .tar.zst templates live)
TMPL_STORAGE="${BUDGET_HOME_TMPL_STORAGE:-local}"
TMPL_NAME="debian-12-standard_12.7-1_amd64.tar.zst"

INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/install/budget-home-install.sh"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
cat <<EOF

${BL}╔══════════════════════════════════════╗
║       Budget-Home LXC Installer      ║
╚══════════════════════════════════════╝${CL}

  CTID:     ${GN}${CTID}${CL}
  Hostname: ${GN}${HOSTNAME}${CL}
  vCPU:     ${GN}${CORES}${CL}
  RAM:      ${GN}${RAM} MB${CL}
  Disk:     ${GN}${DISK} GB${CL} on ${GN}${STORAGE}${CL}
  Bridge:   ${GN}${BRIDGE}${CL}
  IP:       ${GN}${IP_CONFIG}${CL}

EOF

read -rp "  Proceed? [y/N] " CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || { echo "Aborted."; exit 0; }

# ---------------------------------------------------------------------------
# Template: download if not already present
# ---------------------------------------------------------------------------
msg_info "Checking for Debian 12 template"
if ! pveam list "${TMPL_STORAGE}" 2>/dev/null | grep -q "${TMPL_NAME}"; then
  printf "${BFR}${YW}○${CL} Downloading Debian 12 template (this may take a minute)...\n"
  pveam download "${TMPL_STORAGE}" "${TMPL_NAME}" >/dev/null 2>&1 || \
    msg_error "Template download failed. Check network or set BUDGET_HOME_TMPL_STORAGE."
  msg_ok "Template downloaded"
else
  msg_ok "Template already present"
fi

TEMPLATE="${TMPL_STORAGE}:vztmpl/${TMPL_NAME}"

# ---------------------------------------------------------------------------
# Create the LXC container
# ---------------------------------------------------------------------------
msg_info "Creating LXC container ${CTID}"
pct create "${CTID}" "${TEMPLATE}" \
  --hostname  "${HOSTNAME}" \
  --memory    "${RAM}" \
  --cores     "${CORES}" \
  --rootfs    "${STORAGE}:${DISK}" \
  --net0      "name=eth0,bridge=${BRIDGE},${IP_CONFIG}" \
  --unprivileged 1 \
  --features  "nesting=1" \
  --onboot    1 \
  --start     0 \
  --ostype    debian >/dev/null 2>&1
msg_ok "Container ${CTID} created"

# ---------------------------------------------------------------------------
# Start the container
# ---------------------------------------------------------------------------
msg_info "Starting container ${CTID}"
pct start "${CTID}"
# Wait until networking is ready (up to 30 s)
for i in $(seq 1 15); do
  if pct exec "${CTID}" -- hostname &>/dev/null 2>&1; then break; fi
  sleep 2
done
msg_ok "Container started"

# ---------------------------------------------------------------------------
# Run install script inside the container
# ---------------------------------------------------------------------------
msg_info "Installing Budget-Home inside container ${CTID}"
pct exec "${CTID}" -- bash -c \
  "apt-get install -y -qq curl >/dev/null 2>&1 && bash <(curl -fsSL '${INSTALL_SCRIPT_URL}')"
msg_ok "Budget-Home installed"

# ---------------------------------------------------------------------------
# Show access info
# ---------------------------------------------------------------------------
IP=$(pct exec "${CTID}" -- hostname -I 2>/dev/null | awk '{print $1}' || echo "<container-ip>")

printf "\n${GN}Done!${CL}\n"
printf "  ${DGN}App:${CL}    ${BL}http://%s${CL}\n" "${IP}"
printf "  ${DGN}Health:${CL} ${BL}http://%s/api/healthz${CL}\n\n" "${IP}"
printf "  To update later, run inside the container:\n"
printf "    ${YW}pct exec %s -- bash /opt/Budget-Home/scripts/proxmox/install/budget-home-update.sh${CL}\n\n" "${CTID}"
