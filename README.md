# 31 Jours avec Marie

**La Vierge Marie dans le Royaume de la Divine Volonté** — Luisa Piccarreta

Progressive Web App for daily Marian meditations. 31 days + 6 appendices.

## Deploy

This repository is deployed via **GitHub Pages** (Settings → Pages → Branch: `main` → Folder: `/root`).

Live URL: `https://<username>.github.io/<repo-name>/`

## Version sync (mandatory on every deploy)

Three locations must always match:
- `sw.js` line 2: `const CACHE = 'mjv-v1.4.0';`
- `index.html`: `const APP_VERSION = '1.4';`
- `index.html` visible badge: `v1.4`

## Features (v1.4)

- Date-aware: opens to today's meditation automatically
- Offline-capable (service worker, cache-first)
- Text size slider (14–22px, persisted)
- Notes tied to stable paragraph references
- Favorites and reading progress (localStorage, no account needed)
- Dark mode: manual toggle ☽ (persisted) + system preference fallback
- Active day ring: gold double-ring on calendar for the active practice day
- Help section: dedicated Aide screen (mobile) and panel (desktop/iPad)
- Wider sidebar on iPad (340px) and desktop (380px)
- Installable as PWA on iOS and Android

## Corpus

31 main days + 6 appendices from *La Vierge Marie dans le Royaume de la Divine Volonté* (1932).  
Corpus version: `1.0.0` · 753 meditative paragraphs · SHA256 fingerprints per paragraph.

## Tech

Single HTML file + service worker + static JSON corpus. No build step, no dependencies, no server.
