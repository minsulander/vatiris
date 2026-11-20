import assert from "node:assert/strict"
import {
    hasEngineIceRisk,
    insertEngineIce,
    minimumEngineIceRh,
} from "./engineIce.ts"

// +10°C and warmer is NO even when saturated.
assert.equal(hasEngineIceRisk(20, 20), false)
assert.equal(hasEngineIceRisk(15, 15), false)
assert.equal(hasEngineIceRisk(10, 10), false)

// Below +10°C, YES only at 80% RH or more.
assert.equal(hasEngineIceRisk(9, 9), true)
assert.equal(hasEngineIceRisk(6, 6), true)
assert.equal(hasEngineIceRisk(5, 4), true)
assert.equal(hasEngineIceRisk(2, 0), true)
assert.equal(hasEngineIceRisk(0, -1), true)
assert.equal(hasEngineIceRisk(-10, -12), true)
assert.equal(hasEngineIceRisk(-25, -26), true)

assert.equal(hasEngineIceRisk(2, -3), false)
assert.equal(hasEngineIceRisk(5, 1), false)
assert.equal(hasEngineIceRisk(-8, -20), false)

const report = `ESCF                       251120
RWY --           MET REPORT  <b>201450Z</b>
WIND 270/05KT

VIS 10KM

CLD NCD
T05      DP04
QNH <div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px">1 0 1 3</div> HPA   TRL 60
`
const mil = insertEngineIce("ESCF", report)
assert.match(mil, /margin-top: 7px; margin-bottom: 8px/)
assert.match(mil, /QNH .+\nENGINE ICE: YES/)
assert.equal(insertEngineIce("escf", mil), mil)

const dry = report.replace("T05      DP04", "T20      DP00")
assert.match(insertEngineIce("ESIB", dry), /ENGINE ICE: NO/)
assert.match(insertEngineIce("ESIB", "ESIB\nTMS08      DPMS20\nQNH 1013"), /ENGINE ICE: NO/)

assert.match(insertEngineIce("ESSV", report), /ENGINE ICE: YES/)
assert.equal(insertEngineIce("ESSA", report), report)
assert.equal(insertEngineIce("ESCF", "ESCF\nWIND CALM\nQNH 1013"), "ESCF\nWIND CALM\nQNH 1013")

for (const t of [10, 15, 20]) {
    assert.equal(minimumEngineIceRh(t), undefined)
}
for (const t of [-15, 0, 5, 9]) {
    assert.equal(minimumEngineIceRh(t), 80)
}

console.log("engineIce tests OK")
