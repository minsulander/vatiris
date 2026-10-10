# Backend relay for EuroScope AMAN plugins

vatIRIS relays data between EuroScope plugins. It does not run an AMAN calculation engine or provide an AMAN frontend. This addition requires no database migration, new dependency, or frontend change.

The original `/aman/:net/:icao` API remains a separate legacy room for existing ESAA AMAN clients. New clients use the scoped API below. These rooms do not exchange state with the legacy API. Legacy endpoints retain their callsign-based identity model; use the new authenticated room protocol for stronger identity and independent tests. The legacy leave route now applies its existing authorization check, the live controller-feed check fails closed when unavailable/stale, and its public sequence expires after 30 seconds instead of ten minutes.

## Independent tests on one SweatBox exercise

Choose a session identifier for the exercise, shared by both groups, and a channel for each AMAN implementation:

| Plugin | Room URL |
| --- | --- |
| SAAMAN | `/aman/rooms/sweatbox1/ESSA/essa-test-01/saaman` |
| ESAA AMAN | `/aman/rooms/sweatbox1/ESSA/essa-test-01/esaa-aman` |

Both plugins observe the same SweatBox traffic. Each channel has independent sequence, sequencer, recovery state, commands, calculation settings and supervisory diagnostics. It is the plugin's responsibility to select the correct network and exercise. Start a new session identifier for a restarted exercise, or reset each room explicitly. Do not use `sweatbox2` to distinguish plugins connected to the same `sweatbox1` server.

For an exact comparison of the engines, feed them an identical recorded telemetry stream: two connected radar clients may otherwise observe updates at slightly different times. Run the implementations in separate EuroScope instances so their local TopSky/label output does not compete.

The scoped API is additive. Both plugin authors must implement its client adapter; this backend change alone does not upgrade a DLL. SAAMAN's earlier `/maestro/ESSA` server-engine mode is not part of this API or this PR.

## Identity and access

- Every write, poll, supervisory read and leave request requires authentication. VATSIM users send `Authorization: Bearer <access-token>` using the existing vatIRIS authentication service.
- Live editors must have the authenticated CID **and supplied callsign** connected as ATC in the VATSIM data feed. Feed failures return 503. `AMAN_REQUIRE_ATC=0` bypasses only the connection check for development, never sign-in.
- SweatBox clients can use sign-in, or `X-AMAN-Key` matching `AMAN_SWEATBOX_KEY`. A training key grants ordinary editing only, never supervision. There is no public SweatBox controller feed to verify their callsigns. Only distribute the training key to participating testers; it identifies possession of that key, not a person.
- With neither sign-in nor a key, new SweatBox rooms reject requests. `AMAN_ALLOW_OPEN_SWEATBOX=1` explicitly permits anonymous training clients for local development. It does not affect live rooms.
- `AMAN_SUPERVISOR_CIDS` is a comma-separated list for settings, diagnostic reads and room resets. Default: `1396125`. Set an empty value to deny all supervision, or add the other AMAN's supervisors explicitly.
- Each plugin installation generates an `instanceId`, retained across temporary disconnections. Identity is CID + instance ID, or training-key scope + instance ID. Do not key ownership on the callsign alone. Use different IDs for separate EuroScope instances. Clients must keep credentials and instance IDs out of their recovery checkpoints.

## Client protocol

Use the room URL as `R`. Requests with a plugin identity carry:

```json
{
  "instanceId": "unique-installation-id",
  "callsign": "ESSA_APP",
  "engine": { "name": "saaman", "version": "1.0.14", "schema": "saaman-1" }
}
```

Engine names and schemas must match within one room. The version is reported for diagnosis. A plugin author may allow different versions to share a schema only if their command and recovery formats and calculation behavior are compatible. Use a new schema/channel for incompatible builds. `observer: true` prevents election and editing.

1. **Join/poll:** `POST R/poll` with identity and optional `epoch`, `revision`, `role`, `resultsAfter`. First join returns immediately. Further polls wait up to 20 seconds; `wait: false` requests an immediate heartbeat. A response includes `role`, `sequencer`, `epoch`, `revision`, `settingsRevision`, engine metadata, freshness and users. On changes it includes `sequence`, `checkpoint` and canonical `settings`. Only the sequencer receives its `lease` token and pending `commands`.
2. **Heartbeat:** the sequencer must poll or publish every 2 seconds. Lease expires after 8 seconds without an active request; holding a long poll open does not renew it. Keep a separate heartbeat while a long poll is outstanding. If the owner leaves/expires, waiting editors are awakened to re-poll and elect one compatible successor. Never publish after a failed heartbeat without checking ownership again.
3. **Publish:** `PUT R` with identity, `epoch`, `revision`, `lease`, `settingsRevision`, unique `requestId`, `sequence` in MAESTRO format, and an object `checkpoint`. Optional `results: [{id,ok,message}]` atomically acknowledge pending commands with their resulting sequence; optional `supervision` contains private diagnostic data. Successful publication increments revision. An old lease, epoch, revision or settings revision returns 409. Retry a lost response with the identical request ID and payload.
4. **Edit:** `POST R/command` with identity, `epoch`, current `revision`, unique `requestId`, and `cmd: {op,...}`. The server returns a command ID and relays it to the sequencer. Results are routed back to the originating instance. `resultsAfter` is the greatest result ID safely consumed. Retry IDs remain deduplicated for two minutes; results are retained for two minutes. Pending commands expire after one minute with a failure result. Reconcile before retrying after that retention period. Serialize commands and process results in increasing ID order before advancing `resultsAfter`.
5. **Leave:** `POST R/leave` with identity. Releases only that instance's ownership. This does not erase the last checkpoint.

The sequencer must apply each command ID at most once, record applied IDs in its checkpoint, and publish the updated checkpoint and command results together. After uncertain delivery or handover, restore that checkpoint before applying pending commands. The server queues/deduplicates transport requests but cannot make an arbitrary plugin operation itself idempotent.

The backend does not interpret aircraft commands; each engine validates its supported operations, including Frozen restrictions and aircraft still belonging to the current exercise. The reserved operations `settings`, `supervision` and `reset` are rejected on the ordinary command endpoint. Plugins must not support alternate command names which change the canonical supervisory settings.

## Recovery and settings

The MAESTRO sequence alone is insufficient for a reliable SAAMAN handover. Its checkpoint must include accepted slots, relevant aircraft history, manual edits, pending runway/rate changes and applied command IDs. Checkpoints are opaque, private to authenticated room clients, and limited to 1 MB. Validate them against fresh simulator telemetry before reuse. They must not include tokens, personal details or supervisory diagnostics. Keep diagnostic explanations in the separate `supervision` field (250 KB limit).

Calculation settings have their own server-authoritative field, outside the checkpoint:

- `GET R/supervision`: supervisor only; current settings, settings revision and latest diagnostic payload. This does not acquire sequencer ownership.
- `PUT R/settings`: supervisor only; `{epoch,revision,settings:{...}}`. Increments room and settings revisions and wakes clients. Ordinary publications cannot replace these settings. Plugins must use this canonical field when calculating and validate their engine-specific setting values.
- `POST R/reset`: supervisor only; `{epoch,revision}`. Clears sequence, checkpoint, settings, commands and lease, and assigns a new epoch. Reset both test channels for a complete exercise restart.

The relay does not validate engine-specific settings or calculate their effects. Both plugin authors own that validation; malformed or unsupported settings must produce an error without generating misleading guidance.

## TopSky and freshness

Read-only MAESTRO data is explicitly scoped:

`R/MAESTRO_sequence_data_ESSA.json`

For example, set the test client's `AMAN_URL` to `https://backend.vatiris.se/aman/rooms/sweatbox1/ESSA/essa-test-01/saaman`. The original `/aman/MAESTRO_sequence_data_ESSA.json` remains the legacy live feed; it does not automatically choose a new channel.

Only the MAESTRO label sequence is public. Checkpoints, settings and diagnostics are not part of this export. After 30 seconds without publication the export returns 404 and polls mark the output stale and return a null sequence. Plugins must then clear their local instructions, even if an older checkpoint exists.

Everything is in memory, for a single backend process. A backend restart loses rooms and creates new epochs; clients must clear previous cursors, pending local commands and stale sequence output and rejoin. Idle rooms expire after 30 minutes. Maximums: 200 rooms, 100 clients per room, 500 pending commands; JSON body limit is 2 MB only under `/aman`, while other routes retain their original limit. Multiple backend workers would require shared storage/lease coordination; do not deploy this relay across independent workers.

## Validation and staging

Run from `backend`:

```text
npm run test:aman
npm run type-check:aman
npm run build
```

Automated tests cover room isolation, compatible-engine election, lease fencing, recovery handover, retry/result delivery, stale output, resets, permissions, queue limits and actual Express HTTP requests. The focused type check avoids an existing unrelated AUP type mismatch in the current base branch.

Before rollout, run two compatible clients in each of the two rooms against one SweatBox exercise. Verify within-room edits propagate, cross-room edits do not, supervisor settings propagate only within their room, disconnecting each sequencer preserves accepted slots, simulator reset clears old traffic, and each EuroScope instance displays only its selected room's guidance. Backend deployment and those real plugin acceptance tests remain separate from the local automated tests.
