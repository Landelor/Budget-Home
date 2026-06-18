#!/usr/bin/env bash

# Budget-Home — Proxmox LXC Container Creation Script
# Runs on the Proxmox VE host
# Usage: bash -c "$(curl -fsSL https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/ct/budget-home.sh)"

# shellcheck source=misc/build.func
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func) || {
  echo "Unable to load community-scripts helper. Ensure the Proxmox host has internet access." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# App Metadata
# ---------------------------------------------------------------------------
APP="Budget-Home"
var_tags="finance budgeting nodejs"
var_cpu="2"
var_ram="1024"
var_disk="8"
var_os="debian"
var_version="12"
var_unprivileged="1"

# Install script URL — points to this repo's own install script
INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/Landelor/Budget-Home/main/scripts/proxmox/install/budget-home-install.sh"

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
header_info "$APP"
color
verb_ip6
catch_errors

# ---------------------------------------------------------------------------
# Settings prompt (uses community-scripts interactive helpers)
# ---------------------------------------------------------------------------
variables
overrides
build_container

# ---------------------------------------------------------------------------
# Post-creation: run install script inside the new container
# ---------------------------------------------------------------------------
description

msg_info "Installing $APP inside LXC ${CTID}"
lxc-attach -n "${CTID}" -- bash -c "$(curl -fsSL "${INSTALL_SCRIPT_URL}")"
msg_ok "$APP installed"

# ---------------------------------------------------------------------------
# Print access info
# ---------------------------------------------------------------------------
IP=$(lxc-info -n "${CTID}" -iH 2>/dev/null | head -1 || pct exec "${CTID}" -- hostname -I | awk '{print $1}')
echo
echo -e "${GN}Budget-Home is running!${CL}"
echo -e "${DGN}Access: ${BL}http://${IP}${CL}"
echo -e "${DGN}API:    ${BL}http://${IP}/api/healthz${CL}"
echo
motd_ssh
customize
