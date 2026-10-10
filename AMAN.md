# ESSA AMAN

The arrival manager is a movable/resizable vatIRIS window for ESSA, with ACC, FLOW and Runway views. The Runway view has three paired columns (19L/19R, 26/08, 01L/01R), one active arrival runway and a separate departure runway. Feeder views use NILUG, ELTOK, VACRA and XILAN. The display covers an hour ahead and five minutes of confirmed landing history.

## Arrival prediction

Live prediction uses aircraft/route geometry and `frontend/src/data/essa-star-distances.json`, imported from **STAR Distances (updated).xlsx**, sheet Tabellenblatt1. Its source fingerprint and cell ranges accompany the 24 regular STAR profiles, eight supported RNP profiles and remaining-distance anchors. Vectors distance is the default; ESE/Shortest and explicit arrival profiles are selectable. The table contains distances, not measured flight durations. U/S rows and the unsupported HMR-only RNP path are excluded. HMR coordinates identical to VACRA are normalized to VACRA.

Before the feeder, the engine sums remaining route distances and estimates entry time from observed groundspeed and a configurable departure climb/cruise forecast. After the feeder, geometry is calibrated to the workbook path and matching trajectory anchors. Planning speeds default to 250 kt IAS, 180 kt for the last 20–10 NM and 140 kt for the last 10 NM. Assigned-speed caps, altitude-dependent TAS, wind and a descent-rate limit affect duration. Persistent vectoring uses a bounded-turn path; aligned final traffic uses fresh threshold-relative geometry and observed speed. These settings are exposed on the restricted supervision page. Missing profile/position data is diagnosed rather than silently falling back to EuroScope route EET. Demo and manual arrivals use explicit synthetic times.

Runway rate, ICAO-category wake spacing, feeder intervals and runway closures constrain scheduled times. RECAT, simultaneous/dependent runway operations, forecast winds aloft and a full aircraft-performance model are not implemented. Scheduled times are never fed back as raw ETAs.

## Sequence and controls

| Phase | Colour | Behaviour |
| --- | --- | --- |
| Unstable | Dark blue | Known flight, provisional prediction |
| Stable | Green | Committed sequence, can drag to assign a time |
| Super Stable | White | Order changes manually through slot insertion |
| Frozen | Turquoise | Manual sequence changes are blocked |
| Landed | Pink | Confirmed landing history retained five minutes |

Drag between aircraft to insert into the sequence; dropping on a callsign is not a teleport/swap action. An earlier TMA slot can satisfy an existing positive lose instruction. Ordinary slot moves do not invent gain/lose from drifting route estimates; actual wake/rate/closure constraints remain. Aircraft menus offer Recompute, explicit arrival profile, runway, gaps, desequence, missed approach and removal. Background selection recomputes a group. Missed approaches resume in movable recovery mode until fresh telemetry describes the new approach. Landed aircraft can be returned to the queue manually.

Right-click a column to add a flight or runway closure. Drag a closure's body or its start/end handles. Rate/runway changes have independent effective times, sliders and markers: dotted while editing, solid once confirmed. Top boxes show the current values and arrows to pending values. The overview scrollbar shows NOW and aircraft markers.

Gain is green negative minutes; lose is yellow 1–2 and red 3+; zero is blank. Aircraft Information shows selected workbook cells, remaining distances, prediction source and spacing. Fresh low-speed/low-altitude near-airport reports confirm landing; passing a planned time alone does not. Missing airborne tracks disappear immediately when the source inventory clears.

## EuroScope and shared use

See [AMAN-SHARING.md](AMAN-SHARING.md). The updated x86 VatIRIS DLL exports telemetry and consumes instructions beside the local bridge. It sends native sequence JSON to TopSky through the documented/recovered MAESTRO Windows-message interface, without editing profiles, scratchpads or tag definitions. Gain/lose output stops once a fresh position confirms an aircraft is at least 12 NM beyond its feeder, while the AMAN keeps its timing. Enable AMA in TopSky's unselected-label controls to see guidance without hovering.

The existing native protocol is compatible with Juha MAESTRO sequence consumers. This is an independent replacement engine and web presentation, not recovered original source or a binary-equivalent clone. Geometry equations adapted from PythonRobotics are credited in [AMAN-THIRD-PARTY-NOTICES.txt](AMAN-THIRD-PARTY-NOTICES.txt).

## Verification

Run `npm run test:maestro` in `frontend`. Engine regressions cover protected phases, drag/slot behaviour, closures, rate changes, wake separation, workbook prediction, bogus EET independence, feeder order/delay and the 12 NM guidance boundary. Frontend/backend builds and the native x86 protocol test are separate checks. Staging PostgreSQL lease/handover, browser loopback connectivity and actual TopSky rendering remain integration checks before production enablement.
# Live supervision

Open `/maestro/supervision` in a separate browser window. It is independent of the normal AMAN, which has no supervision button. The backend restricts supervisory access to CID **1396125** by default; deployment can override the list with `MAESTRO_SUPERVISOR_CIDS`. Select a callsign to inspect position and speed inputs, workbook profile and remaining distance, feeder and landing ETA/STA, phase horizons, vector detection, spacing leader, wake/rate requirements, protected TMA instruction and EuroScope guidance suppression. The page also records observed state, instruction, order, timing and prediction changes.

Surface wind, sequence phases, STAR model, label options and Winds/Actual rates/TMA-TOT preferences are saved here and synchronized to every normal AMAN through the shared configuration. Only supervisors can change those fields, including through the API; the normal MASTER keeps control of runway/rate/closure/aircraft edits. Supervisor saves lock the plan row and check its revision, preserve the MASTER lease and aircraft edits, and update the authoritative calculation. Editing settings does not take over sequencing or upload local telemetry.

History is local to the open supervision page, bounded to 1,000 events and reset when switching telemetry source. It is not a server audit log and cannot show events before the page opened or between polling snapshots. Export downloads the current snapshot, settings, controller edits and observed history as JSON. The separate page observes the shared live plan, not a normal browser's private DEMO session. The localhost preview permits supervision on this computer without VATSIM authentication; that local testing exception does not exist in the shared backend.

