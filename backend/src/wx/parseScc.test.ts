import assert from "assert"
import { parseSccFromInfo, findSccForRunway } from "./parseScc"
import { runwaysMatch } from "./oppositeRunways"
import { parseAwosHtml, parseRunwayInUse } from "./parseAwos"
import { assessFlightCategory, parseVisibilityM, parseCeilingFt } from "./flightCategory"
import { buildOpsFromHtml } from "./service"

const sampleInfo = `01L: SCC 5 5 5 ISSUED AT 1128 RWY 100 PCT WET 
 
08: CLOSED 
 
01R: SCC 5 5 5 ISSUED AT 1110 RWY 100 PCT WET 
 
 
SIG: ENOR U09 
INDEPENDENT PARALLEL APCH IN OPERATION. SECONDARY APCH RNP Y 
TAF 1412/1512 33015KT 9999 BKN010`

const entries = parseSccFromInfo(sampleInfo)
assert.strictEqual(entries.length, 3)
assert.deepStrictEqual(entries[0].thirds, [5, 5, 5])
assert.strictEqual(entries[0].issuedAt, "1128")
assert.strictEqual(entries[0].remark, "RWY 100 PCT WET")
assert.strictEqual(entries[1].closed, true)
assert.strictEqual(entries[1].matchedKey, "08")

assert.ok(runwaysMatch("01L", "19R"))
assert.ok(runwaysMatch("19R", "01L"))
assert.ok(!runwaysMatch("01L", "01R"))

const for19R = findSccForRunway(entries, "19R")
assert.ok(for19R)
assert.strictEqual(for19R!.matchedKey, "01L")

const sampleHtml = `<div style="float:right"><span class="spanText">2026-10-14T21:34:38Z
	</span></div><div style="float:left"><span class="spanText">
		RUNWAY IN USE: <b>ARR: 01L DEP: 01L</b></span></div><div style="clear:both" /><div style="float:left"><table><tr><td style="vertical-align:top" class="columnHeight"><div><pre class="spanText" /></div><br /><br /><div><pre class="spanText">01L: SCC 5 5 5 ISSUED AT 1128 RWY 100 PCT WET 
 
08: CLOSED 
 
01R: SCC 5 5 5 ISSUED AT 1110 RWY 100 PCT WET 
 
 
SIG: ENOR U09 
TAF 1412/1512 33015KT 9999 BKN010=</pre></div></td><td /><td style="vertical-align:top" class="columnHeight"><pre class="spanText">RWY     01L         M        19R
MEAN02  270/05 KT            290/04 KT
QNH  1019.2</pre></td></tr></table><div class="column"><span class="spanText">METAR ESSA 142120Z 29004KT CAVOK 05/04 Q1018 NOSIG</span></div></div>`

const parts = parseAwosHtml(sampleHtml)
assert.ok(parts.time.includes("2026-10-14"))
const rwy = parseRunwayInUse(parts.rwy)
assert.strictEqual(rwy.arr, "01L")
assert.strictEqual(rwy.dep, "01L")
assert.ok(parts.metar.includes("CAVOK"))

const cavok = assessFlightCategory("METAR ESSA 142120Z 29004KT CAVOK 05/04 Q1018 NOSIG")
assert.strictEqual(cavok.flightCategory, "VMC")
assert.strictEqual(cavok.wxAdaptation.cavok, true)

assert.strictEqual(parseVisibilityM("METAR ESSA 142120Z 29004KT 2000 BR BKN005"), 2000)
assert.strictEqual(parseCeilingFt("METAR ESSA 142120Z 29004KT 2000 BR BKN005"), 500)

const imc = assessFlightCategory("METAR ESSA 142120Z 29004KT 2000 BR BKN005 05/04 Q1018")
assert.strictEqual(imc.flightCategory, "IMC")
assert.strictEqual(imc.wxAdaptation.lowVisibility, true)

const ops = buildOpsFromHtml("ESSA", sampleHtml, "01L")
assert.strictEqual(ops.flightCategory, "VMC")
assert.ok(ops.scc)
assert.deepStrictEqual(ops.scc!.thirds, [5, 5, 5])
assert.strictEqual(ops.sccAll.length, 3)

const opsOpp = buildOpsFromHtml("ESSA", sampleHtml, "19R")
assert.ok(opsOpp.scc)
assert.strictEqual(opsOpp.scc!.matchedKey, "01L")
assert.strictEqual(opsOpp.scc!.runway, "19R")

console.log("wx parseScc/flightCategory/ops tests OK")
