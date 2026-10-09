import assert from "assert"
import { parseDate, parsePibLines, textToPibLines } from "./parser"
import { parseFileList } from "./service"

const sample = `ESAA FIR IFR
                         AERONAUTICAL INFORMATION SERVICES
       Pre-Flight Information Bulletin:                     VALIDITY (UTC):
                    AREA                         09 OCT 2026 15:00 - 10 OCT 2026 15:00
    Id: ES972610090298
    Legend:
    + NOTAM not older than 250 days
ESAA - SWEDEN FIR
AERODROMES
ESCF - LINKOEPING/MALMEN
+    INSTRUMENT APPROACH PROCEDURE RNP RWY 01 AND RNP RWY 19 LPV
     MINIMA NOT AVAILABLE.
       INDENTED LINE.
     FROM: 07 OCT 2026 12:21    TO: 07 JAN 2027 23:59 EST                       B3330/26

ESCM - UPPSALA
     No information received or matching the query

ESGP - GOETEBORG/SAEVE
+
     HELIPORT WORK IN PROGRESS
     FROM: 17 AUG 2026 08:39    TO: 30 OCT 2026 18:00                       H0341/26
     SCHEDULE: DAILY 0400-1800

SNOWTAM
    FROM: 09 OCT 2026 12:54
    ESNZ
    10091254 12 5/5/5 50/50/50 NR/NR/NR WET/WET/WET

ESKS - SAELEN/SCANDINAVIAN MOUNTAINS
-   LOC RWY 33 OCA(H) CHANGED TO 2340(700).
    FROM: 19 DEC 2025 14:26    TO: PERM                                    B4361/25

EN-ROUTE
+   please see NOTAM A1049/26 :- ESKN

NAV WARNINGS
+   TRIGGER NOTAM - AIP SUP 171/2026. TEMPORARY RESTRICTED AREAS
    LOWER: SFC
    UPPER: 2200FT AMSL
    FROM: 03 OCT 2026 07:00    TO: 10 OCT 2026 20:00                       A1035/26

                                  END OF PIB
Briefing includes all NOTAM available.
`

const b = parsePibLines(textToPibLines(sample), "IFR")
assert.deepStrictEqual(b.parseWarnings, [])
assert.strictEqual(b.bulletinId, "ES972610090298")
assert.strictEqual(b.validFrom, "2026-10-09T15:00:00.000Z")
assert.strictEqual(b.validTo, "2026-10-10T15:00:00.000Z")
assert.deepStrictEqual(
    b.aerodromes.map((a) => [a.icao, a.name, a.notams.length]),
    [
        ["ESCF", "LINKOEPING/MALMEN", 1],
        ["ESCM", "UPPSALA", 0],
        ["ESGP", "GOETEBORG/SAEVE", 2],
        ["ESKS", "SAELEN/SCANDINAVIAN MOUNTAINS", 1],
    ],
)

const escf = b.aerodromes[0].notams[0]
assert.strictEqual(escf.id, "B3330/26")
assert.strictEqual(escf.marker, "+")
assert.strictEqual(escf.text, "INSTRUMENT APPROACH PROCEDURE RNP RWY 01 AND RNP RWY 19 LPV\nMINIMA NOT AVAILABLE.\n  INDENTED LINE.")
assert.strictEqual(escf.from, "2026-10-07T12:21:00.000Z")
assert.strictEqual(escf.to, "2027-01-07T23:59:00.000Z")
assert.strictEqual(escf.toEstimated, true)

const [heli, snowtam] = b.aerodromes[2].notams
assert.strictEqual(heli.text, "HELIPORT WORK IN PROGRESS")
assert.strictEqual(heli.schedule, "DAILY 0400-1800")
assert.strictEqual(heli.toEstimated, false)
assert.strictEqual(snowtam.type, "snowtam")
assert.strictEqual(snowtam.from, "2026-10-09T12:54:00.000Z")
assert.strictEqual(snowtam.text, "ESNZ\n10091254 12 5/5/5 50/50/50 NR/NR/NR WET/WET/WET")

const perm = b.aerodromes[3].notams[0]
assert.strictEqual(perm.marker, "-")
assert.strictEqual(perm.permanent, true)
assert.strictEqual(perm.to, undefined)

assert.deepStrictEqual(
    b.sections.map((s) => s.title),
    ["EN-ROUTE", "NAV WARNINGS"],
)
const ref = b.sections[0].notams[0]
assert.strictEqual(ref.type, "ref")
assert.strictEqual(ref.refId, "A1049/26")
assert.strictEqual(ref.refLocation, "ESKN")

const warning = b.sections[1].notams[0]
assert.strictEqual(warning.lower, "SFC")
assert.strictEqual(warning.upper, "2200FT AMSL")
assert.ok(warning.text.endsWith("UPPER: 2200FT AMSL"))
assert.strictEqual(b.footer, "Briefing includes all NOTAM available.")

assert.strictEqual(parseDate("31 DEC 2026 23:59"), "2026-12-31T23:59:00.000Z")
assert.strictEqual(parseDate("PERM"), undefined)

const links = parseFileList(`
<a href="https://aro.lfv.se/FileList/pibsweden//ESAA FIR 99days_20261009150000.pdf">x</a>
<a href="https://aro.lfv.se/FileList/pibsweden//ESAA FIR IFR 24hr_20261009143000.pdf">x</a>
<a href="https://aro.lfv.se/FileList/pibsweden//ESAA FIR IFR 24hr_20261009150014.pdf">x</a>
<a href="https://aro.lfv.se/FileList/pibsweden//ESAA FIR HKP 24hr_20261009150009.pdf">x</a>
<a href="https://aro.lfv.se/FileList/pibsweden//ESAA FIR OHT_20261009150003.pdf">x</a>
`)
assert.deepStrictEqual(Object.keys(links).sort(), ["HKP", "IFR"])
assert.strictEqual(links.IFR?.url, "https://aro.lfv.se/FileList/pibsweden//ESAA%20FIR%20IFR%2024hr_20261009150014.pdf")
assert.strictEqual(links.IFR?.publishedAt, "2026-10-09T15:00:14.000Z")

console.log("notam parser tests passed")
