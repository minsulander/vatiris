# VatEFS ↔ VatIRIS `/efs/sync`

IRIS stores EFS-owned data only. EuroScope/ops status stays on **esdata**; consumers join by callsign / `stripKey`.

## Single allowed write set

| Method | Path | Body |
|--------|------|------|
| PUT/GET/DELETE | `/efs/sync/:realm/:airport/:stripKey` | `{ strokes?, strip? }` |
| PUT/GET | `/efs/sync/:realm/:airport/order` | `{ revision?, entries: [{ stripKey, bayId, sectionId, position }] }` |
| PUT/GET | `/efs/sync/:realm/:airport/meta` | `{ essaSep: { sep, dlv, depGap } }` |
| PUT | `/efs/sync/:realm/:airport/heartbeat` | `{}` |
| GET | `/efs/sync/:realm/:airport` | Full snapshot |
| WS | `/efs/sync/:realm/:airport/ws?cid=` | Fanout |

**Not supported:** `PUT …/sep`, `…/strips/:stripKey`, `PUT /efs/:airport/:view`.

- **Realms:** `live` \| `sweatbox` \| `playback` \| `local`
- **Write auth:** `X-Vatsim-Cid` (optional allowlist `EFS_SYNC_ALLOW_CIDS=cid,cid`)
- **TTL:** 5 minutes from any write → `efsActive`
- **SEP:** bare numbers preferred (`2.5`); IRIS strips trailing `nm`
- **Forbidden on strip bodies:** groundstate, clearance, CFTO, depRwy, sid, stand, cfl, ownership, atd, type/wtc, …

## ESSA Strip TV bay map

| bayId | dep RWY |
|-------|---------|
| `TWR-W` | 01L, 19R, 08, 26 |
| `TWR-E` | 01R, 19L |

`sectionId`: `TAXI` \| `LINEUP` \| `DEPA`

Strip TV shows only `/order` entries with those bayIds (sorted section then position). Transfer to APP/DEP ⇒ omit from order (no DELETE required).

## WebSocket events (flat JSON)

```ts
{ type: "hello", realm, airport, efsActive, updatedAt }
{ type: "snapshot", /* AirportSyncSnapshot fields */ }
{ type: "scribble", stripKey, strokes, strip?, updatedAt, updatedByCid, deleted? }
{ type: "meta", meta: { essaSep? }, updatedAt, updatedByCid }
{ type: "order", order: { revision, entries }, updatedAt, updatedByCid }
{ type: "heartbeat", updatedAt, updatedByCid, efsActive }
```

## Local mock

```bash
cd backend && node scripts/mock-striptv.mjs
# EFS_SYNC_CID=1396125 EFS_SYNC_REALM=live
```

Publishes esdata + sync order/meta/heartbeat for ESSA.
