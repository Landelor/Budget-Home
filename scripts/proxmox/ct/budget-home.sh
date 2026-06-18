#!/usr/bin/env bash

# Budget-Home — Proxmox LXC Container Creation Script
# Runs on the Proxmox VE host (NOT inside a container).
# Self-contained — does not depend on community-scripts infrastructure.
#
# Usage:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/ct/budget-home.sh)"
#
# All prompts can be bypassed with env vars:
#   BUDGET_HOME_CTID=210 BUDGET_HOME_STORAGE=local-lvm BUDGET_HOME_TMPL_STORAGE=local \
#     bash budget-home.sh

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
if ! command -v pct &>/dev/null || ! command -v pvesm &>/dev/null; then
  msg_error "pct/pvesm not found — this script must run on a Proxmox VE host."
fi

# ---------------------------------------------------------------------------
# Helper: interactive numbered menu
# Usage: pick_from_list "prompt" item1 item2 ...  → sets PICKED
# ---------------------------------------------------------------------------
pick_from_list() {
  local prompt="$1"; shift
  local items=("$@")
  if [ "${#items[@]}" -eq 1 ]; then
    PICKED="${items[0]}"
    return
  fi
  echo
  echo "  ${prompt}"
  local i=1
  for item in "${items[@]}"; do
    printf "    ${GN}%d)${CL} %s\n" "$i" "$item"
    (( i++ ))
  done
  local choice
  while true; do
    read -rp "  Enter number [1-${#items[@]}]: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#items[@]}" ]; then
      PICKED="${items[$((choice-1))]}"
      return
    fi
    echo "  Invalid choice, try again."
  done
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
cat <<EOF

${BL}╔══════════════════════════════════════╗
║       Budget-Home LXC Installer      ║
╚══════════════════════════════════════╝${CL}

EOF

# ---------------------------------------------------------------------------
# CTID
# ---------------------------------------------------------------------------
CTID="${BUDGET_HOME_CTID:-}"
if [ -z "$CTID" ]; then
  DEFAULT_CTID=$(pvesh get /cluster/nextid 2>/dev/null || echo "200")
  read -rp "  Container ID [${DEFAULT_CTID}]: " CTID
  CTID="${CTID:-$DEFAULT_CTID}"
fi

# ---------------------------------------------------------------------------
# Hostname
# ---------------------------------------------------------------------------
HOSTNAME="${BUDGET_HOME_HOSTNAME:-}"
if [ -z "$HOSTNAME" ]; then
  read -rp "  Hostname [budget-home]: " HOSTNAME
  HOSTNAME="${HOSTNAME:-budget-home}"
fi

# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
RAM="${BUDGET_HOME_RAM:-1024}"
CORES="${BUDGET_HOME_CORES:-2}"
DISK="${BUDGET_HOME_DISK:-8}"
BRIDGE="${BUDGET_HOME_BRIDGE:-vmbr0}"
IP_CONFIG="${BUDGET_HOME_IP:-ip=dhcp}"

# ---------------------------------------------------------------------------
# Storage for container disk (rootdir content)
# ---------------------------------------------------------------------------
if [ -n "${BUDGET_HOME_STORAGE:-}" ]; then
  STORAGE="$BUDGET_HOME_STORAGE"
else
  msg_info "Detecting available disk storages"
  mapfile -t DISK_STORES < <(pvesm status --content rootdir 2>/dev/null \
    | awk 'NR>1 && /active/{print $1}')
  printf "${BFR}"
  if [ "${#DISK_STORES[@]}" -eq 0 ]; then
    msg_error "No active storage with rootdir support found on this host."
  fi
  pick_from_list "Select storage for container disk:" "${DISK_STORES[@]}"
  STORAGE="$PICKED"
fi
msg_ok "Disk storage: ${STORAGE}"

# ---------------------------------------------------------------------------
# Template storage (vztmpl content)
# ---------------------------------------------------------------------------
if [ -n "${BUDGET_HOME_TMPL_STORAGE:-}" ]; then
  TMPL_STORAGE="$BUDGET_HOME_TMPL_STORAGE"
else
  msg_info "Detecting available template storages"
  mapfile -t TMPL_STORES < <(pvesm status --content vztmpl 2>/dev/null \
    | awk 'NR>1 && /active/{print $1}')
  printf "${BFR}"
  if [ "${#TMPL_STORES[@]}" -eq 0 ]; then
    msg_error "No active storage with vztmpl support found. Add template storage in Proxmox datacenter storage config."
  fi
  pick_from_list "Select storage for OS template:" "${TMPL_STORES[@]}"
  TMPL_STORAGE="$PICKED"
fi
msg_ok "Template storage: ${TMPL_STORAGE}"

# ---------------------------------------------------------------------------
# Resolve latest Debian 12 template name from pveam
# ---------------------------------------------------------------------------
msg_info "Looking up latest Debian 12 template"
TMPL_NAME=$(pveam available --section system 2>/dev/null \
  | awk '/debian-12-standard/{print $2}' | sort -V | tail -1)
if [ -z "$TMPL_NAME" ]; then
  msg_error "Could not find a debian-12-standard template in pveam. Check internet access on this host."
fi
msg_ok "Template: ${TMPL_NAME}"

INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/install/budget-home-install.sh"

# ---------------------------------------------------------------------------
# Summary + confirm
# ---------------------------------------------------------------------------
cat <<EOF

  ${BL}Summary${CL}
  ─────────────────────────────────────
  CTID:          ${GN}${CTID}${CL}
  Hostname:      ${GN}${HOSTNAME}${CL}
  vCPU:          ${GN}${CORES}${CL}
  RAM:           ${GN}${RAM} MB${CL}
  Disk:          ${GN}${DISK} GB${CL} → ${GN}${STORAGE}${CL}
  Template:      ${GN}${TMPL_NAME}${CL} (${TMPL_STORAGE})
  Bridge:        ${GN}${BRIDGE}${CL}
  IP:            ${GN}${IP_CONFIG}${CL}
  ─────────────────────────────────────

EOF
read -rp "  Proceed? [y/N] " CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || { echo "Aborted."; exit 0; }

# ---------------------------------------------------------------------------
# Template: download if not already on the selected storage
# ---------------------------------------------------------------------------
msg_info "Checking for template on ${TMPL_STORAGE}"
if pveam list "${TMPL_STORAGE}" 2>/dev/null | grep -qF "${TMPL_NAME}"; then
  msg_ok "Template already present"
else
  printf "${BFR}${YW}○${CL} Downloading ${TMPL_NAME} to ${TMPL_STORAGE} (may take a minute)...\n"
  pveam download "${TMPL_STORAGE}" "${TMPL_NAME}" || \
    msg_error "Template download failed. Verify that ${TMPL_STORAGE} is writable and the host has internet access."
  msg_ok "Template downloaded"
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
# Start + wait for boot
# ---------------------------------------------------------------------------
msg_info "Starting container ${CTID}"
pct start "${CTID}"
for i in $(seq 1 15); do
  if pct exec "${CTID}" -- hostname &>/dev/null 2>&1; then break; fi
  sleep 2
done
msg_ok "Container started"

# ---------------------------------------------------------------------------
# Run install script inside the container
# ---------------------------------------------------------------------------
printf "\n${YW}○${CL} Running Budget-Home install inside container ${CTID}...\n\n"
pct exec "${CTID}" -- bash -c \
  "apt-get install -y -qq curl >/dev/null 2>&1 && bash <(curl -fsSL '${INSTALL_SCRIPT_URL}')"
printf "\n"
msg_ok "Budget-Home installed"

# ---------------------------------------------------------------------------
# Access info
# ---------------------------------------------------------------------------
CONTAINER_IP=$(pct exec "${CTID}" -- hostname -I 2>/dev/null | awk '{print $1}' || echo "<container-ip>")

printf "\n${GN}Done!${CL}\n"
printf "  ${DGN}App:${CL}    ${BL}http://%s${CL}\n" "${CONTAINER_IP}"
printf "  ${DGN}Health:${CL} ${BL}http://%s/api/healthz${CL}\n\n" "${CONTAINER_IP}"
printf "  To update later:\n"
printf "    ${YW}pct exec %s -- bash /opt/Budget-Home/scripts/proxmox/install/budget-home-update.sh${CL}\n\n" "${CTID}"
