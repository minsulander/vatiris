# Shared ESSA arrival management

The backend owns one ESSA plan and runs the same arrival engine for all controllers. One authenticated controller holds MASTER, uploads fresh EuroScope telemetry, and changes the sequence, rates and runway closures. SLAVE windows receive the backend's snapshot rather than calculating their own queues. A SLAVE can forward that shared snapshot to its own EuroScope/TopSky labels.

## Deployment

1. Back up the existing vatIRIS database, then apply `backend/migrations/002_maestro.sql` and `003_maestro_engine.sql` to the existing database. Both migrations are additive. Do not replace the database or reset other vatIRIS tables.
2. Build and deploy the backend and frontend together, using the project's existing deployment process. The frontend's `VITE_BACKEND_BASE_URL` must point to the deployed backend. The backend build includes the arrival engine and workbook distance data.
3. Optionally set backend `MAESTRO_EDITOR_CIDS` to a comma-separated list of controllers allowed to acquire MASTER and edit. With the variable unset, authenticated VATSIM users with controller rating S1 or higher can acquire MASTER. Authenticated readers can view the shared plan.
4. Verify `/maestro` reaches the frontend route and the existing backend reverse proxy forwards its `/maestro/*` API paths. VATSIM authentication remains the existing vatIRIS login.
5. Publish an x86 build of the updated EuroScope plugin and the `euroscope-plugin/bridge` folder for controllers to install together. A DLL should sit in the parent of the bridge folder, where `MAESTROTelemetry.json` and `MAESTROTiming.json` are exchanged. Do not publish controller telemetry, timing files, local saved sessions or credentials in the repository or web build.

The supplied migrations create the ESSA plan, authoritative engine configuration/edits/snapshot, raw telemetry and MASTER lease. An atomic database update assigns the lease; edits and telemetry lock the plan row. Only the lease owner can write, and plan edits require the current revision. The lease lasts 30 seconds and renews on telemetry uploads; a stopped MASTER becomes stale and another controller can claim it. Handover retains the shared configuration and plan. It does not automatically elect a new controller.

## Controller setup

1. Load the updated VatIRIS DLL in EuroScope and keep TopSky loaded. Unload the original Juha MAESTRO during testing so it cannot publish a competing sequence. No `.prf` or TAG definitions edits are needed for the direct TopSky sequence interface.
2. Run `bridge/start.cmd` with Node.js on PATH. This starts the loopback bridge only, without a local AMAN engine or competing browser tab.
3. Open vatIRIS, sign in, then choose **Flight → MAESTRO ESSA**, or open `/maestro` directly.
4. One controller selects **MASTER · Web + Local**. Their browser reads fresh EuroScope telemetry from the loopback bridge and uploads it to the authenticated backend.
5. Other controllers use **SLAVE · Web + Local**. They receive the same sequence, rate and closure plan. Enable the EuroScope timing checkbox when their local bridge/DLL is available; the DLL delivers shared guidance to TopSky.

Close standalone localhost AMAN tabs when using the shared page. Keep the bridge window running. Browser loopback permissions, if prompted, must allow the page to reach the controller's local bridge. Only the local bridge listens on `127.0.0.1:17777`; the public backend does not connect to controller computers directly.

For unselected TopSky labels, use **Radar menu → Track Control… → Unselected Label Fields → AMA → All**. This is a radar-screen display option. The shared feed hides gain/lose guidance once a fresh position confirms an aircraft is 12 NM past its feeder. Zero instructions remain blank.

## Acceptance test before enabling operational use

Use a staging backend/database and two different controller accounts. Acquire MASTER on account A and verify B receives the same runway and feeder scheduled times. Reorder an aircraft, change rate and add/remove a closure on A; verify B receives each revision and cannot overwrite it as SLAVE. Attempt a competing MASTER claim on B and verify it is rejected. Stop A's upload, wait for the lease to expire, acquire MASTER on B, and verify the existing plan remains. Feed an empty simulator inventory and verify airborne arrivals disappear for both clients. Confirm live TopSky line-0 output on both computers and its 12 NM cutoff.

The engine regressions, frontend build, backend build and native x86 protocol test have passed locally. Real PostgreSQL concurrency/handover and production HTTPS-to-loopback browser connectivity still require this staging test; they have not been represented as verified production behavior.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /maestro/ESSA` | Authenticated shared plan/snapshot |
| `POST /maestro/ESSA/master` | Controller acquires or releases MASTER |
| `POST /maestro/ESSA/telemetry` | MASTER submits current EuroScope inventory |
| `PUT /maestro/ESSA` | MASTER submits configuration/edits with a revision |
| `GET /maestro/MAESTRO_sequence_data_ESSA.json` | Public read-only native sequence, emptied when stale |

No API response exposes VATSIM access tokens, controller names or authentication secrets. The native sequence contains virtual aircraft identifiers, timing and planning configuration.

## Future native AMAN window

A future EuroScope DLL can replace the web presentation without replacing the shared engine. It should consume the same authoritative snapshot, claim the same MASTER lease and submit the same revision-checked edits and telemetry. Keep one calculation engine on the backend so native and web clients cannot diverge. Authentication and transport need a separately designed native or local-bridge login flow; the present DLL is a telemetry/TopSky adapter, not a native AMAN-window implementation.
