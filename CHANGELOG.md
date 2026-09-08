# Changelog

All notable changes to Budget-Home are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Offset page** — the "Add" expense dropdown now excludes expenses that have already been added to the offset list, and the button disables once every expense is added


### Added

- **Data import** — import a previously-exported JSON file back into the app from the Dashboard's Export/Import control; every row is added as a new record (accounts, expenses, transactions, income, utilities, net worth entries, etc.) — nothing existing is overwritten or deleted, and a preview of row counts is shown before confirming, via a new `POST /import` API endpoint
- **Data export** — export all entered data from the Dashboard as either a CSV bundle (one file per section, zipped) or a single JSON file, via a new `GET /export` API endpoint


## [0.1.0] - 2026-06-18

### Added

- **Income tracking** — record monthly salary entries with optional PDF payslip attachment (one payslip per entry); inline PDF viewer in the UI
- **Utility bill tracking** — record electricity, gas, water, and other recurring bills with optional PDF bill attachment; inline PDF viewer
- **Budget allocation** — allocate budget across categories with amounts automatically ceiled to the nearest 10
- **PostgreSQL 16 + Drizzle ORM** — schema-first data model with typed migrations
- **React + Vite frontend** — responsive single-page application with TypeScript
- **Fastify REST API** — JWT-authenticated API with rate limiting and CORS
- **Proxmox LXC deployment scripts** — one-line install on a Debian 12 LXC container (`scripts/proxmox/`)
  - `ct/budget-home.sh` — container creation script (Proxmox host)
  - `install/budget-home-install.sh` — full application install (inside LXC)
  - `install/budget-home-update.sh` — in-place update with migration and service restart
  - `ct/budget-home.json` — community-scripts metadata

[Unreleased]: https://github.com/Landelor/Budget-Home/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Landelor/Budget-Home/releases/tag/v0.1.0
