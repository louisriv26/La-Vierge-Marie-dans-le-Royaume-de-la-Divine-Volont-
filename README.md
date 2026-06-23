# 31 Jours avec Marie

**La Vierge Marie dans le Royaume de la Divine Volonté** — Luisa Piccarreta

Progressive Web App for daily Marian meditations. 31 days + 6 appendices.

## Deploy

This repository is deployed via **GitHub Pages** (Settings → Pages → Branch: `main` → Folder: `/root`).

Live URL: `https://louisriv26.github.io/La-Vierge-Marie-dans-le-Royaume-de-la-Divine-Volont-/`

## Version sync (mandatory on every deploy)

Three locations must always match:
- `sw.js` line 2: `const CACHE = 'mjv-vX.Y.0';`
- `index.html`: `const APP_VERSION = 'X.Y';`
- `index.html` visible badges (×2): `vX.Y`

## Features (v2.3.0)

- Date-aware: opens to today's meditation automatically (mobile stays on Home, wide auto-opens reader)
- Offline-capable (service worker, network-first shell + corpus, cache-first assets)
- Text size slider (14–22px, persisted)
- Notes tied to stable paragraph references
- Favorites and reading progress (localStorage, no account needed)
- Three-way theme: System ◑ / Dark ☽ / Light ☀ (persisted)
- Active day ring: gold double-ring on calendar for the active practice day
- Pour aujourd'hui card: tap to open centred modal with Petite pratique + Oraison
- Search: filter 37 units by title, diacritic-insensitive
- Debug panel: triple-tap version badge → live state readout
- Help section: dedicated Aide screen (mobile) and panel (desktop/iPad)
- Responsive: mobile (<768px) · tablet/iPad (768px+, min-height 600px) · desktop (1200px+)
- Installable as PWA on iOS and Android

## Corpus

31 main days + 6 appendices from *La Vierge Marie dans le Royaume de la Divine Volonté* (1932).  
Corpus version: `1.0.0` · 753 meditative paragraphs · SHA256 fingerprints per paragraph (`fingerprint_sha256` field).

## Tech

Single HTML file + service worker + static JSON corpus. No build step, no dependencies, no server.
