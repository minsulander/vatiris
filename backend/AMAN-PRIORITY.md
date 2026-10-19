# Mandatory ESSA sequencer priority and confirmed command handover

ESSA priority is enforced by the server for every client, including older clients that send no policy fields. No client can opt out. Other airports retain their existing first-caller lease behavior. No database or frontend migration is needed. Normal live-controller and SweatBox-key authorization is unchanged.

`GET /aman/capabilities` returns `{ "runwayHandover": 1, "essaPriority": 1 }`.

Every eligible ESSA client participates automatically through its normal polls. `engineVersion` (for example `"1.3.34"`) is optional diagnostic metadata, not a switch for priority. Active clients are ranked in this order:

1. `ESSA_E_APP`, including handover spelling such as `ESSA_E__APP`.
2. `ESSA_FMP`.
3. Other ESSA APP or ESOS/ESAA CTR positions.

A higher-priority connected client supersedes a lower-priority sequencer regardless of client version or policy fields. ESMM, TWR and unrelated callsigns can follow the sequence but cannot become ESSA sequencer. Equal-priority clients retain the current owner. Proxy and observer instances must use the read-only sequence endpoint rather than sending owner polls. A disconnected client's preference expires with the existing eight-second lease; a live long poll counts as present.

To apply a runway plan and request ownership, submit the normal command with top-level `takeSequencer: true`. The server queues the request without changing owner. The current sequencer applies the command and publishes the resulting sequence with its usual `cmdAck` and matching successful `{ id, from, ok: true }` result. Only then does the server atomically store the plan and consider the new owner. A higher-priority active client always wins, even over an explicit handover request. Among successful requests from peers, the highest command ID wins. Failed, expired, unmatched and replayed results cannot transfer ownership.

After a priority change or command handover, a sequencer poll can include `handover: { from, callsign, version }`. When its version matches the received sequence, continue from that confirmed shared runway plan rather than reseeding it from local EuroScope selections. With an empty initial room, still initialize from EuroScope.

Poll replies also include `sequencerVersion` when known and `versions` for active eligible clients. These are reported build identifiers for a client's version warning, not authentication or proof of the latest GitHub release.

A publisher may include `expectedVersion` in PUT. A mismatched or invalid value returns 409 without changing the sequence. Existing clients that omit it continue working.

Run `npm run test:aman` and `npm run type-check:aman` in `backend`. The new handler tests exercise the real router without listening on a local port. They cover priority preemption, command acknowledgement, publication fencing, competing requests, expiry, authorization and fallback. SAAMAN's companion tests cover recovery-plan preservation and compatibility with older backends.

Deployment: merge and deploy this backend before enabling the companion SAAMAN handover feature. There are no new environment variables or tokens.
