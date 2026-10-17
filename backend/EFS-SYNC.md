# VatEFS ↔ VatIRIS `/efs/sync`

IRIS stores EFS-owned data only. EuroScope/ops status stays on **esdata**; consumers join by callsign / `stripKey`.

## Single allowed write set

| Method | Path | Body |
|--------|------|------|
| PUT/GET/DELETE | `/efs/sync/:realm/:airport/:stripKey` | `{ strokes?, strip? }` |
| PUT/GET | `/efs/sync/:realm/:airport/order` | `{ revision?, entries: [{ stripKey, bayId, sectionId, position, cfto?, atd? }] }` |
| PUT/GET | `/efs/sync/:realm/:airport/meta` | `{ essaSep: { sep, dlv, depGap }, essaConfig?: "1"\|"9A"\|… }` |
| PUT | `/efs/sync/:realm/:airport/heartbeat` | `{}` |
| GET | `/efs/sync/:realm/:airport` | Full snapshot |
| WS | `/efs/sync/:realm/:airport/ws?cid=` | Fanout |

**Not supported:** `PUT …/sep`, `…/strips/:stripKey`, `PUT /efs/:airport/:view`.

- **Realms:** `live` \| `sweatbox` \| `playback` \| `local`
- **Write auth:** `X-Vatsim-Cid` (optional allowlist `EFS_SYNC_ALLOW_CIDS=cid,cid`)
- **TTL:** 5 minutes from any write → `efsActive`
- **SEP:** bare numbers preferred (`2.5`); IRIS strips trailing `nm`
- **essaConfig:** optional ESSA bankonfig id from TWR ES (Strip TV header). If omitted, IRIS derives from plugin `rwyconfig` / ATIS / WX.
- **cfto / atd (EFS-owned):** allowed on **order entries** and **strip bodies**.
  - `cfto`: boolean — `true` = cleared for takeoff; `false` clears
  - `atd`: `"HHmm"` UTC or `null` — `null` / `false` / omit clears (RTO)
  - Strip TV prefers order-entry values, then strip body. Do not put these on esdata; IRIS does not echo them back to EFS.
- **Forbidden on strip bodies:** `groundstate`, `clearance`, `clearedForTakeoff`, `depRwy`, `sid`, `stand`, `cfl`, ownership, type/wtc, …

## ESSA Strip TV bay map

| bayId | dep RWY |
|-------|---------|
| `TWR-W` | 01L, 19R, 08, 26 |
| `TWR-E` | 01R, 19L |

`sectionId`: `TAXI` \| `LINEUP` \| `DEPA`

Strip TV shows only `/order` entries with those bayIds (section then ascending `position`).

**TAXI display:** position `0` / first entry = **top**; highest position = **bottom** (same as EFS TAXIWAY DEP). Do not reverse.

Transfer to APP/DEP ⇒ omit from order (no DELETE required).

## WebSocket events (flat JSON)

```ts
{ type: "hello", realm, airport, efsActive, updatedAt }
{ type: "snapshot", /* AirportSyncSnapshot fields */ }
{ type: "scribble", stripKey, strokes, strip?, updatedAt, updatedByCid, deleted? }
{ type: "meta", meta: { essaSep?, essaConfig? }, updatedAt, updatedByCid }
{ type: "order", order: { revision, entries }, updatedAt, updatedByCid }
{ type: "heartbeat", updatedAt, updatedByCid, efsActive }
```

## Local mock

```bash
cd backend && node scripts/mock-striptv.mjs
# EFS_SYNC_CID=1396125 EFS_SYNC_REALM=live
```

Publishes esdata + sync order/meta/heartbeat for ESSA.
