import assert from "assert"
import {
    extractAupIdsFromTopSkyAreas,
    normalizeAreaId,
} from "./topsky-areas-loader"
import {
    filterRestrictions,
    formatHi,
    formatYmd,
    parseUsePlanText,
    serializeTopSky,
} from "./parser"
import { isRowStruck } from "./strikethrough"

const sampleAreas = `
//ESR425 SOLLEFTEÅ
AREA:4F:  R425
ACTIVE:AUP:ESR425
ACTIVE:AUP:ESD317
`

assert.deepStrictEqual(extractAupIdsFromTopSkyAreas(sampleAreas).sort(), ["ESD317", "ESR425"])
assert.strictEqual(normalizeAreaId("ES R425"), "ESR425")

const modernSample = `2026-05-21
DAILY USE PLAN
20:0017:00ES D155
4000ft
14:0006:00ES R5
14300ft
`

const { restrictions: modernRest } = parseUsePlanText(modernSample)
assert.strictEqual(modernRest.length, 2)
assert.strictEqual(modernRest[0].name, "ESD155")
assert.strictEqual(modernRest[0].altitude, "4000")
assert.strictEqual(modernRest[1].name, "ESR5")

const known = new Set(["ESD155", "ESR5"])
const { included, excluded } = filterRestrictions(modernRest, "sectorfile", known, new Set())
assert.strictEqual(isRowStruck(240.7, [{ y: 244.5, x1: 25, x2: 765 }]), true)
assert.strictEqual(isRowStruck(170.4, [{ y: 244.5, x1: 25, x2: 765 }]), false)
assert.strictEqual(included.length, 2)
assert.strictEqual(excluded.length, 0)

const topsky = serializeTopSky(included)
assert.ok(topsky.startsWith("REFRESH_INTERVAL:3600\n"))
const dataLine = topsky.split("\n")[1]
assert.match(dataLine, /^ESD155:\d{6}:\d{6}:0:0000:1700:0:4000$/)

const flRange: import("./types").Restriction = {
    name: "ESD309",
    from: new Date(Date.UTC(2026, 0, 1, 0, 0)),
    to: new Date(Date.UTC(2026, 11, 31, 23, 59)),
    altitude: "520",
    altitudeUpper: "660",
    altitudeType: "FL",
    comment: "FLYG",
}
assert.match(
    serializeTopSky([flRange]).split("\n")[1],
    /^ESD309:260101:261231:0:0000:2359:52000:66000:FLYG$/,
)

const aFlBand: import("./types").Restriction = {
    name: "EP655B",
    from: new Date(Date.UTC(2026, 4, 21, 8, 0)),
    to: new Date(Date.UTC(2026, 4, 21, 19, 0)),
    altitude: "030",
    altitudeUpper: "145",
    altitudeType: "ft",
    comment: "",
}
assert.match(serializeTopSky([aFlBand]).split("\n")[1], /^EP655B:260521:260521:0:0800:1900:3000:14500$/)

const d = new Date(Date.UTC(2026, 4, 21, 8, 30))
assert.strictEqual(formatYmd(d), "260521")
assert.strictEqual(formatHi(d), "0830")

console.log("aup/parser.test.ts: all assertions passed")
