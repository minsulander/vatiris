# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

[VatIRIS](https://vatiris.se/) is a web-based interpretation of the real-world IRIS (Integrated Real-time Information System), adapted and extended for VATSIM controllers in Sweden. It aggregates METAR/TAF, NOTAM, charts, AIP, AUP/LARA airspace data, CDM/CTOT data, flight data, etc. into a window-manager-style cockpit UI.

The repo has four components:
- `frontend/` — Vue 3 + Vuetify SPA, the user-facing app
- `backend/` — Express + Postgres API providing auth, data proxying, and parsed data the frontend can't get directly
- `aip-crawler/` — node script(s) for crawling eAIP (mostly empty checkout, deps only)
- `euroscope-plugin/` — C++ EuroScope plugin (CMake) that posts controller data to the backend

## Commands

Frontend (`cd frontend`):
- `npm start` / `npm run dev` — Vite dev server (default port 5173)
- `npm run build` — type-check + production build
- `npm run type-check` — `vue-tsc --build --force`
- `npm run lint` — ESLint with `--fix` over .vue/.ts/.js
- `npm run format` — Prettier over `src/`

Backend (`cd backend`):
- `npm start` — `tsx watch src/server.ts` (default port 5172)
- `npm run build` — esbuild bundle to `dist/server.js`
- Tests: run individually with `tsx`, e.g. `npx tsx src/aup/parser.test.ts` (no test runner configured)

Euroscope plugin: standard CMake build (`CMakeLists.txt`, `CMakeSettings.json`).

## Architecture

### Frontend

- Entry: `src/main.ts` mounts `App.vue` with Pinia, Vuetify (dark default), Vue Router, and a PWA service worker via `vite-plugin-pwa`.
- Routing (`src/router.ts`) is intentionally minimal — most UI is the `Main.vue` view, which hosts a window-manager surface built on **WinBox** (`vue-winbox`). Each "window" type is a component under `src/components/` (e.g. `Wx.vue`, `Notam.vue`, `Wiki.vue`, `Echarts.vue`, `FSP.vue`, `Pdf.vue`, `QuickRef.vue`...).
- `stores/windows.ts` is the central registry of open windows; `stores/preset.ts` handles layout presets.
- Data fetching is per-domain Pinia store: `metar.ts`, `taf.ts`, `notam.ts`, `vatsim.ts`, `fdp.ts`, `eaip.ts`, `vatfsp.ts`, `etfms.ts`, `occupancy.ts`, `esdata.ts`, `aircraft.ts`, `airport.ts`, `wind.ts`, `dct.ts`, `aup/store.ts`, etc. Stores own caching, polling, and backend calls — components stay thin.
- For console debugging, `main.ts` exposes most stores on `window` (`window.vatsim`, `window.metar`, `window.fdp`, …) along with `moment`, `axios`, and the event bus (`window.bus`).
- Auth: VATSIM OAuth. Frontend captures `?code=...` in `main.ts` before app boot, stashes it in `sessionStorage`, and reloads; `stores/auth.ts` then exchanges it via the backend `/token` endpoint.
- Path alias `@/` → `src/` (Vite + tsconfig).

### Backend

- Entry: `src/server.ts` wires Express with CORS, JSON body parser, the auth/token endpoints, and mounts feature routers under `/data`, `/wiki`, `/esdata`, `/eaip`, `/fsp`, `/cdm`, `/aup` (and `/lara` aliased to the AUP router). Static files served from `public/`.
- `src/auth.ts` validates the VATSIM bearer token on incoming requests (`requireUser`); `src/db.ts` is the Postgres pool. Schema lives in `backend/migrations/*.sql` and must be applied manually to a database named `vatiris`.
- Feature areas in `src/routes/`:
  - `wiki.ts` — proxies VATSIM Scandinavia BookStack wiki (needs `WIKI_TOKEN`/`WIKI_SECRET`)
  - `eaip.ts` + root-level `src/eaip-crawler.ts` — Swedish eAIP scraping/caching
  - `cdm.ts` — vIFF/CDM proxy (`VIFF_BASE_URL`, optional `CDM_API_KEY` for DPI; CTOT works without)
  - `fsp.ts` — flight strip / FSP integration
  - `esdata.ts` — data posted by the EuroScope plugin
  - `aup/` — AUP/LARA airspace activation parsing. `parser.ts` (with `parser-layout.ts` and `parser-modern.ts`) parses two distinct PDF layouts; `fetcher.ts` pulls source PDFs; `service.ts` orchestrates and caches; `topsky-areas-loader.ts` resolves area names against TopSky data; `strikethrough.ts` detects struck-out lines in PDFs.
- Backend runs degraded without DB / wiki / CDM credentials — most features still respond but with reduced data.

### Euroscope plugin

C++ plugin compiled with CMake (Windows). Posts controller/session data to the backend `/esdata` endpoint via `postjson.cpp`. `Version.h.in` is configured at build time.

## Environment / external services

Backend env vars (see README for full setup): `PORT`, `VATSIM_AUTH_BASE_URI`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `WIKI_TOKEN`, `WIKI_SECRET`, `VIFF_BASE_URL`, `CDM_API_KEY`, plus Postgres connection (`db.ts`). The defaults in `server.ts` point at VATSIM **dev** auth — production deployment overrides them.

Deployment is via the scripts in `scripts/` (`deploy-frontend.sh`, `deploy-backend.sh`, `vatiris-backend.service` systemd unit).
