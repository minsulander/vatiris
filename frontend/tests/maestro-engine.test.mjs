import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runEngine, DEFAULT_CONFIG, validateTelemetry, delayLabel, toJuhaSequence, wakeInterval, effectiveConfig, validateLockedEdits, validateConfig, correctedPrediction, reorderEdits, retimeEdits, windConfig, euroscopeInstruction } from '../src/maestro-engine.ts'
import { dubinsLength, vectoringSeconds } from '../src/maestro-geometry.ts'
import { labelPositions, scrollingLabelPositions } from '../src/maestro-label-layout.ts'
const time = Date.UTC(2026, 9, 9, 12)
const config = () => ({...structuredClone(DEFAULT_CONFIG),predictionMode:'euroscope'})
const plane = (callsign, landingSeconds, extra = {}) => ({ callsign, aircraft: 'A320', wake: 'M', departure: 'EKCH',
    arrival: 'ESSA', runway: '19R', route: [{ name: 'ELTOK', seconds: landingSeconds - 600 }], landingSeconds,
    distanceNm: 60, groundspeed: 240, altitude: 15000, ...extra })
const packet = (timestamp, flights) => ({ source: 'ESSA_C_APP', timestamp, flights })

test('scrolling translates the entire label layout without repacking visible edge aircraft', () => {
    const rows=[{id:'OUTSIDE',y:-20,side:'r'},{id:'TOP',y:5,side:'r'},{id:'MID',y:300,side:'r'},{id:'CLOSE',y:301,side:'r'},{id:'BOTTOM',y:510,side:'r'},{id:'BEYOND',y:550,side:'r'}]
    const gaps=[{side:'r',top:350,bottom:430}]
    const first=scrollingLabelPositions(rows,23,gaps)
    for(const offset of [-100,40,300]){
        const next=scrollingLabelPositions(rows.map(r=>({...r,y:r.y+offset})),23,gaps.map(g=>({...g,top:g.top+offset,bottom:g.bottom+offset})))
        for(const row of rows)assert.ok(Math.abs(next[row.id]-first[row.id]-offset)<1e-7)
    }
})

test('confirmed landings stay five minutes when the track disappears; missing airborne flights clear immediately', () => {
    const c=config()
    const ground=plane('LANDED',0,{distanceNm:.1,groundspeed:0,altitude:180})
    const first=runEngine(packet(time,[ground,plane('AIRBORNE',1200)]),c,{})
    assert.equal(first.flights.find(f=>f.callsign==='LANDED').state,4)
    const missing=runEngine(packet(time+1000,[]),c,{},first)
    assert.deepEqual(missing.flights.map(f=>f.callsign),['LANDED'])
    assert.equal(missing.flights[0].lost,false)
    const held=runEngine(packet(time+299999,[]),c,{},missing)
    assert.equal(held.flights[0].sta,time)
    const expired=runEngine(packet(time+300000,[]),c,{},held)
    assert.equal(expired.flights.length,0)
    const stillGround=runEngine(packet(time+301000,[ground]),c,{},expired)
    assert.equal(stillGround.flights.length,0,'a still-present ground track cannot restart the five-minute history timer')
})

test('closure captions cannot displace labels to the opposite side of a blocked interval', () => {
    const positions=labelPositions([{id:'BEFORE',y:437,side:'r'},{id:'AFTER',y:378,side:'r'}],532,23,[{side:'r',top:368,bottom:447}])
    assert.ok(positions.BEFORE>447)
    assert.ok(positions.AFTER<368)
})

test('closure-side insertion can move a protected flight before or after the same gap without crossing another flight', () => {
    const c=config();c.minimumNewSeconds=0;c.frozenMinutes=0
    const input=packet(time,[plane('WHITE',700,{route:[{name:'ELTOK',seconds:-1}]}),plane('NEXT',2100)])
    const initial=runEngine(input,c,{})
    const begin=time+900000,end=time+1500000
    c.slots=[{id:'closure',runway:'ESSA/19R',begin,end}]
    const first=runEngine(input,c,{},initial)
    const after=reorderEdits(first,{},'WHITE',end+1,'Runway',c,{id:'closure',side:'after'})
    const held=runEngine(input,c,after,{...first,timestamp:time-1})
    assert.equal(held.flights.find(f=>f.callsign==='WHITE').sta,end)
    assert.ok(held.flights.find(f=>f.callsign==='WHITE').closureDelayMs>0)
    const before=reorderEdits(held,after,'WHITE',begin-1,'Runway',c,{id:'closure',side:'before'})
    const moved=runEngine(input,c,before,{...held,timestamp:time-1})
    assert.ok(moved.flights.find(f=>f.callsign==='WHITE').sta<begin)
    assert.equal(moved.flights.find(f=>f.callsign==='WHITE').closureDelayMs,0)
    assert.equal(moved.flights.find(f=>f.callsign==='WHITE').order,0)
    c.slots=[]
    const removed=runEngine(input,c,after,{...held,timestamp:time-1})
    assert.equal(removed.flights.find(f=>f.callsign==='WHITE').delay,initial.flights.find(f=>f.callsign==='WHITE').delay)
})
test('delay is not accumulated into ETA over repeated refreshes', () => {
    let previous
    for (let i = 0; i < 30; i++) {
        const elapsed = i * 5
        previous = runEngine(packet(time + elapsed * 1000, [plane('SAS1', 1200 - elapsed), plane('SAS2', 1210 - elapsed)]), config(), {}, previous)
        assert.equal(previous.flights.find(f => f.callsign === 'SAS2').delay, 105)
    }
})
test('entry-time minimum is applied once instead of being extended each refresh', () => {
    const c = config(); c.minimumNewSeconds = 600
    const seed=runEngine(packet(time-1000,[plane('SAS0',1200)]),c,{})
    const first = runEngine(packet(time, [plane('SAS0',1199),plane('SAS1', 120)]), c, {},seed)
    const next = runEngine(packet(time + 60000, [plane('SAS0',1139),plane('SAS1', 60)]), c, {}, first)
    assert.equal(next.flights.find(f=>f.callsign==='SAS1').minimumArrival, time + 600000)
    assert.equal(first.flights.find(f=>f.callsign==='SAS1').minimumArrival,next.flights.find(f=>f.callsign==='SAS1').minimumArrival)
})
test('disconnected and corrupt predictions do not block following flights', () => {
    const first = runEngine(packet(time, [plane('SAS1', 1200), plane('SAS2', 1210)]), config(), {})
    const lost = runEngine(packet(time + 5000, [plane('SAS2', 1205)]), config(), {}, first)
    assert.equal(lost.flights.find(f => f.callsign === 'SAS2').delay, 0)
    assert.equal(lost.flights.some(f => f.callsign === 'SAS1'), false)
    const corrupt = runEngine(packet(time + 5000, [plane('SAS1', 9000), plane('SAS2', 1205)]), config(), {}, first)
    assert.match(corrupt.flights[0].issue, /jumped/)
    assert.equal(corrupt.flights[1].delay, 0)
    const stillCorrupt = runEngine(packet(time + 10000, [plane('SAS1', 8995), plane('SAS2', 1200)]), config(), {}, corrupt)
    assert.match(stillCorrupt.flights[0].issue, /jumped/)
    assert.equal(stillCorrupt.flights[1].delay, 0)
})
test('native TopSky feed has documented units and excludes quarantined flights', () => {
    const s = runEngine(packet(time, [plane('SAS1', 1200), plane('SAS2', 1210)]), config(), {})
    const data = toJuhaSequence(s, config(), {})
    assert.equal(data.data.timestamp, time / 1000)
    assert.equal(data.sequence[1].ttlttg_ff, 105)
    assert.equal(data.sequence[1].eet_ff, 610 / 60)
    assert.equal(data.sequence[1].sta_ff, (s.flights[1].staFf / 1000))
    s.flights[0].issue = 'Bad prediction'
    assert.equal(toJuhaSequence(s, config(), {}).sequence.length, 1)
})
test('heavy followers use distance wake spacing without adding a second copy of the base rate', () => {
    assert.ok(wakeInterval('H','M','ESSA/19R',config()) > 115)
    const s = runEngine(packet(time, [plane('SAS1', 1200, {wake:'H'}), plane('SAS2', 1200)]),config(),{})
    assert.ok(Math.abs((s.flights[1].sta - s.flights[0].sta) - 5 / 140 * 3600000) < 1)
})
test('ACC feeder schedule uses feeder-to-threshold transfer, not landing timestamp', () => {
    const s = runEngine(packet(time, [plane('SAS1', 1200), plane('SAS2', 1210)]), config(), {})
    const f = s.flights[1]
    assert.equal(f.sta - f.staFf, 600000)
    assert.equal(f.staFf - f.etaFf, 105000)
})
test('stable order is preserved when route ETA order changes', () => {
    const c = config(); c.unstableSeconds = 0
    const a = runEngine(packet(time, [plane('SAS1', 1000), plane('SAS2', 1020)]), c, {})
    const b = runEngine(packet(time + 5000, [plane('SAS1', 1100), plane('SAS2', 900)]), c, {}, a)
    assert.ok(b.flights[0].order < b.flights[1].order)
    assert.equal(delayLabel(b.flights[0].delay), '')
    assert.ok(b.flights[0].runwayDelay<0,'prediction difference stays available for information, not as an automatic gain instruction')
})
test('fixed and aircraft-relative slots apply once per sequence', () => {
    const c = config(); c.slots = [{ id: 'closure', runway: 'ESSA/19R', begin: time + 1100000, end: time + 1300000 }]
    const s = runEngine(packet(time, [plane('SAS1', 1200), plane('SAS2', 1210)]), c, { SAS1: { slotAfter: 2 } })
    assert.equal(s.flights[0].sta, time + 1300000)
    assert.equal(s.flights[1].sta - s.flights[0].sta, 235000)
})
test('ESSB arrivals are excluded from the ESSA engine even with an active legacy ESSB runway', () => {
    const c = config(); c.active.push('ESSB/30')
    const s = runEngine(packet(time, [plane('SAS1', 1200), plane('SAS2', 1200, { arrival: 'ESSB', runway: '30' })]), c, {})
    assert.deepEqual(s.flights.map(f=>f.callsign),['SAS1']);assert.deepEqual(s.diagnostics,[])
})
test('stale snapshots are rejected and out-of-order snapshots cannot rewind a sequence', () => {
    assert.throws(() => validateTelemetry(packet(time, []), time + 31000))
    const s = runEngine(packet(time, [plane('SAS1', 1200)]), config(), {})
    assert.equal(runEngine(packet(time - 1000, []), config(), {}, s), s)
})
test('white aircraft keep their times on ordinary updates; explicit rate changes recalculate spacing without changing order',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1000),plane('SAS2',1020)]),c,{})
    assert.equal(first.flights[0].state,2)
    const next=runEngine(packet(time+5000,[plane('SAS1',900),plane('SAS2',1100)]),c,{},first)
    assert.equal(next.flights[0].sta,first.flights[0].sta)
    assert.equal(next.flights[1].sta,first.flights[1].sta)
    c.rates['ESSA/19R']=180
    const changed=runEngine(packet(time+10000,[plane('SAS1',890),plane('SAS2',1090)]),c,{},next)
    assert.equal(changed.flights[0].order,0)
    assert.equal(changed.flights[1].order,1)
    assert.ok(changed.flights[1].sta-changed.flights[0].sta>=180000)
})
test('white aircraft can explicitly swap existing sequence slots without drifting afterwards',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1000),plane('SAS2',1200)]),c,{})
    const [a,b]=first.flights
    const edits={SAS1:{order:1,target:b.sta},SAS2:{order:0,target:a.sta}}
    assert.doesNotThrow(()=>validateLockedEdits(first,{},edits))
    const swapped=runEngine(packet(time+5000,[plane('SAS1',995),plane('SAS2',1195)]),c,edits,first)
    assert.equal(swapped.flights[0].sta,b.sta)
    assert.equal(swapped.flights[1].sta,a.sta)
    const again=runEngine(packet(time+10000,[plane('SAS1',990),plane('SAS2',1190)]),c,edits,swapped)
    assert.equal(again.flights[0].sta,b.sta)
    assert.throws(()=>validateLockedEdits(first,{}, {SAS1:{target:b.sta+12345}}))
})
test('closure gaps shift locked times and moving the closure does not leave the old interval blocked',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1000)]),c,{})
    c.slots=[{id:'gap',runway:'ESSA/19R',begin:time+900000,end:time+1100000}]
    const shifted=runEngine(packet(time+1000,[plane('SAS1',999)]),c,{},first)
    assert.equal(shifted.flights[0].sta,time+1100000)
    c.slots=[{id:'gap',runway:'ESSA/19R',begin:time+1400000,end:time+1500000}]
    const after=runEngine(packet(time+2000,[plane('SAS1',998)]),c,{},shifted)
    assert.ok(after.flights[0].sta<time+1400000)
})
test('configured runway directions and rates take effect at the scheduled UTC time',()=>{
    const c=config();c.pending={at:time+900000,active:['ESSA/01L'],rates:{...c.rates,'ESSA/01L':180}}
    assert.deepEqual(effectiveConfig(c,time+899999).active,['ESSA/19R'])
    assert.deepEqual(effectiveConfig(c,time+900000).active,['ESSA/01L'])
    assert.equal(effectiveConfig(c,time+900000).rates['ESSA/01L'],180)
    assert.doesNotThrow(()=>validateConfig(c))
    const next=runEngine(packet(time+900000,[plane('SAS1',600,{runway:'01L'}),plane('SAS2',610,{runway:'01L'})]),c,{})
    assert.equal(next.flights[1].sta-next.flights[0].sta,180000)
})
test('manual flights can be planned before they appear in EuroScope',()=>{
    const c=config();c.manualFlights=[{callsign:'TEST123',runway:'ESSA/19R',aircraft:'UNKN',wake:'?',feeder:'ELTOK',eta:time+1500000}]
    const s=runEngine(packet(time,[]),c,{})
    assert.equal(s.flights[0].callsign,'TEST123')
    assert.equal(s.flights[0].state,1)
    assert.equal(s.flights[0].sta,time+1500000)
    const real=runEngine(packet(time+5000,[plane('TEST123',1495,{aircraft:'A320'})]),c,{},s)
    assert.equal(real.flights.length,1)
    assert.equal(real.flights[0].aircraft,'A320')
})

test('dragging reuses existing slots without pushing the sequence later',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1200),plane('SAS2',1210),plane('SAS3',1220)]),c,{})
    const edits=reorderEdits(first,{},'SAS3',time+1190000)
    assert.equal(edits.SAS3.target,first.flights.find(f=>f.callsign==='SAS1').sta)
    const moved=runEngine(packet(time+1000,[plane('SAS1',1199),plane('SAS2',1209),plane('SAS3',1219)]),c,edits,first)
    assert.equal(moved.flights.find(f=>f.callsign==='SAS3').order,0)
    assert.equal(moved.flights.find(f=>f.callsign==='SAS1').order,1)
    assert.notEqual(moved.flights.find(f=>f.callsign==='SAS3').sta,time+1190000)
    const slots=s=>s.flights.map(f=>f.sta).sort((a,b)=>a-b)
    assert.deepEqual(slots(moved),slots(first))
    assert.equal(moved.flights.reduce((sum,f)=>sum+f.delay,0),first.flights.reduce((sum,f)=>sum+f.delay,0))
    const again=runEngine(packet(time+6000,[plane('SAS1',1194),plane('SAS2',1204),plane('SAS3',1214)]),c,edits,moved)
    assert.deepEqual(slots(again),slots(first))
    const restoredEdits=reorderEdits(again,edits,'SAS3',time+1500000)
    const restored=runEngine(packet(time+7000,[plane('SAS1',1193),plane('SAS2',1203),plane('SAS3',1213)]),c,restoredEdits,again)
    assert.deepEqual(slots(restored),slots(first))
    assert.deepEqual(restored.flights.sort((a,b)=>a.order-b.order).map(f=>f.callsign),['SAS1','SAS2','SAS3'])
})
test('an exact drop on the next slot crosses it, as the original move handler does',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('FIRST',1200),plane('NEXT',1210),plane('TAIL',1220)]),c,{})
    const nextSlot=first.flights.find(f=>f.callsign==='NEXT').sta
    const edits=reorderEdits(first,{},'FIRST',nextSlot)
    const moved=runEngine(packet(time+1000,[plane('FIRST',1199),plane('NEXT',1209),plane('TAIL',1219)]),c,edits,first)
    assert.deepEqual(moved.flights.sort((a,b)=>a.order-b.order).map(f=>f.callsign),['NEXT','FIRST','TAIL'])
    assert.equal(moved.flights.find(f=>f.callsign==='FIRST').sta,nextSlot)
    assert.deepEqual(moved.flights.map(f=>f.sta).sort(),first.flights.map(f=>f.sta).sort())
})

test('slot reordering adds only required wake spacing and respects runway closures',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('MEDIUM',1200),plane('HEAVY',1210,{wake:'H'}),plane('TAIL',1220)]),c,{})
    const edits=reorderEdits(first,{},'HEAVY',time+1190000)
    const moved=runEngine(packet(time+1000,[plane('MEDIUM',1199),plane('HEAVY',1209,{wake:'H'}),plane('TAIL',1219)]),c,edits,first)
    const heavy=moved.flights.find(f=>f.callsign==='HEAVY'),medium=moved.flights.find(f=>f.callsign==='MEDIUM')
    assert.equal(heavy.sta,first.flights.find(f=>f.callsign==='MEDIUM').sta)
    assert.ok(Math.abs(medium.sta-heavy.sta-wakeInterval('H','M','ESSA/19R',c)*1000)<1)
    assert.equal(Math.max(...moved.flights.map(f=>f.sta)),Math.max(...first.flights.map(f=>f.sta)))
    c.slots=[{id:'closed',runway:'ESSA/19R',begin:heavy.sta-1000,end:heavy.sta+60000}]
    const closed=runEngine(packet(time+2000,[plane('MEDIUM',1198),plane('HEAVY',1208,{wake:'H'}),plane('TAIL',1218)]),c,edits,moved)
    assert.equal(closed.flights.find(f=>f.callsign==='HEAVY').sta,c.slots[0].end)
})

test('slot insertion across white aircraft passes locked-edit validation',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('WHITE',900),plane('GREEN',1200),plane('TAIL',1210)]),c,{})
    assert.equal(first.flights.find(f=>f.callsign==='WHITE').state,2)
    const edits=reorderEdits(first,{},'GREEN',time+899000)
    assert.doesNotThrow(()=>validateLockedEdits(first,{},edits))
    const next=runEngine(packet(time+1000,[plane('WHITE',899),plane('GREEN',1199),plane('TAIL',1209)]),c,edits,first)
    assert.deepEqual(next.flights.map(f=>f.sta).sort(),first.flights.map(f=>f.sta).sort())
})

test('a white reorder keeps its accepted wake spacing over later refreshes',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('MEDIUM',900),plane('HEAVY',910,{wake:'H'}),plane('TAIL',920)]),c,{})
    assert.ok(first.flights.every(f=>f.state===2))
    const edits=reorderEdits(first,{},'HEAVY',time+899000)
    let accepted=runEngine(packet(time+1000,[plane('MEDIUM',899),plane('HEAVY',909,{wake:'H'}),plane('TAIL',919)]),c,edits,first)
    const times=new Map(accepted.flights.map(f=>[f.callsign,f.sta]))
    assert.ok(times.get('MEDIUM')-times.get('HEAVY')>=wakeInterval('H','M','ESSA/19R',c)*1000-1)
    for(let elapsed=2;elapsed<=30;elapsed++) {
        accepted=runEngine(packet(time+elapsed*1000,[plane('MEDIUM',900-elapsed),plane('HEAVY',910-elapsed,{wake:'H'}),plane('TAIL',920-elapsed)]),c,edits,accepted)
        assert.ok(accepted.flights.every(f=>!f.spacingConflict))
        assert.deepEqual(new Map(accepted.flights.map(f=>[f.callsign,f.sta])),times)
    }
})

test('explicit Recompute can recover a white aircraft and reset its initial ETA',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1000),plane('SAS2',1100)]),c,{})
    const edits={SAS1:{recomputeAt:time+5000,changedAt:time+5000}}
    assert.doesNotThrow(()=>validateLockedEdits(first,{},edits))
    const next=runEngine(packet(time+5000,[plane('SAS1',1300),plane('SAS2',1095)]),c,edits,first)
    const f=next.flights.find(f=>f.callsign==='SAS1')
    assert.equal(f.initialEta,f.eta)
    assert.equal(f.order,1)
})
test('new arrivals do not displace SuperStable order; missed approaches may enter before SuperStable but never Frozen',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('FROZEN',250),plane('SUPER',900),plane('MISSED',1100)]),c,{MISSED:{mode:'missed'}})
    const next=runEngine(packet(time+5000,[plane('FROZEN',245),plane('SUPER',895),plane('MISSED',600),plane('NEW',500)]),c,{MISSED:{mode:'sequenced'}},first)
    const ordered=next.flights.filter(f=>f.mode==='sequenced').sort((a,b)=>a.order-b.order).map(f=>f.callsign)
    assert.deepEqual(ordered,['FROZEN','MISSED','SUPER','NEW'])
})
test('frozen post-feeder order stays committed even when final positions cross',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const threshold={latitude:59.66,longitude:17.92,heading:180}
    const a=plane('SAS1',200,{latitude:59.76,longitude:17.92,heading:180,threshold})
    const b=plane('SAS2',220,{latitude:59.80,longitude:17.92,heading:180,threshold})
    const first=runEngine(packet(time,[a,b]),c,{})
    const next=runEngine(packet(time+5000,[a,{...b,latitude:59.72}]),c,{},first)
    assert.equal(next.flights.find(f=>f.callsign==='SAS2').order,1)
    assert.equal(next.flights.find(f=>f.callsign==='SAS2').sta,first.flights.find(f=>f.callsign==='SAS2').sta)
    const offFinal=runEngine(packet(time+5000,[a,{...b,latitude:59.72,longitude:18.0}]),c,{},first)
    assert.equal(offFinal.flights.find(f=>f.callsign==='SAS2').order,1)
})
test('minimum EET for a missed approach is anchored once, not added repeatedly',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',1000)]),c,{SAS1:{mode:'missed'}})
    const edits={SAS1:{mode:'sequenced',recomputeAt:time+5000}}
    const next=runEngine(packet(time+5000,[plane('SAS1',200)]),c,edits,first)
    assert.equal(next.flights[0].minimumArrival,time+605000)
    const again=runEngine(packet(time+10000,[plane('SAS1',195)]),c,edits,next)
    assert.equal(again.flights[0].minimumArrival,time+605000)
})
test('wind automatic mode uses fresh METAR data and manual wind remains authoritative',()=>{
    const c=config(),winds={ESSA:{direction:190,speed:20,timestamp:time}}
    assert.equal(windConfig(c,'ESSA',winds,time).surfaceWindSpeed,20)
    c.surfaceWindAuto=false
    assert.equal(windConfig(c,'ESSA',winds,time).surfaceWindSpeed,0)
    c.surfaceWindAuto=true
    assert.equal(windConfig(c,'ESSA',winds,time+3600001).surfaceWindSpeed,0)
    const s=runEngine({...packet(time,[plane('SAS1',1200)]),winds},c,{})
    assert.equal(toJuhaSequence(s,c,{}).wind.sfc_kts,20)
})
test('bounded-turn geometry has correct straight-line and reverse-course limits',()=>{
    assert.ok(Math.abs(dubinsLength(10,0,0,0,1)-10)<1e-8)
    assert.ok(dubinsLength(10,0,Math.PI,0,1)>10)
    const seconds=vectoringSeconds({latitude:59.76,longitude:17.92},180,{latitude:59.66,longitude:17.92,heading:180},10,180,140)
    assert.ok(Math.abs(seconds-6/140*3600)<.01)
})
test('vectoring replaces an obsolete route only with required geometry and enabled eligibility',()=>{
    const c=config();c.unstableSeconds=0
    const p=plane('SAS1',3000,{route:[{name:'ELTOK',seconds:-60}],assignedHeading:180,heading:180,
        latitude:59.76,longitude:17.92,threshold:{latitude:59.66,longitude:17.92,heading:180}})
    const old={state:2}
    assert.equal(correctedPrediction(p,c,old).source,'vectoring')
    assert.ok(correctedPrediction(p,c,old).seconds<300)
    c.vectoringMode=0
    assert.equal(correctedPrediction(p,c,old).seconds,3000)
    c.vectoringMode=1
    assert.equal(correctedPrediction({...p,threshold:undefined},c,old).source,'route')
})
test('delay path exclusion replaces arc with direct distance, not zero-time teleporting',()=>{
    const c=config();c.delayPaths=[{airport:'ESSA',runways:['19R'],feeders:['ELTOK'],points:['A','B','C']}]
    const route=[{name:'ELTOK',seconds:600},{name:'A',seconds:700,latitude:59.9,longitude:17.9},
        {name:'B',seconds:1000,latitude:60,longitude:18},{name:'C',seconds:1300,latitude:59.8,longitude:17.9}]
    const p=plane('SAS1',1800,{route,calculatedRouteIndex:0})
    const prediction=correctedPrediction(p,c)
    assert.equal(prediction.source,'delaypath')
    assert.ok(Math.abs(prediction.seconds-1290)<.01)
    assert.equal(correctedPrediction({...p,calculatedRouteIndex:3},c).seconds,1800)
})
test('starting MASTER with existing final traffic does not invent a ten-minute delay',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('SAS1',120)]),c,{})
    assert.equal(first.flights[0].sta,time+120000)
    assert.equal(first.flights[0].minimumArrival,time)
})


test('explicit unstable reorder keeps its chosen order without pretending its time is stable',()=>{
    const c=config();c.unstableSeconds=0
    const inputs=[plane('A',1200),plane('B',1320),plane('BLUE',3300)]
    const first=runEngine(packet(time,inputs),c,{})
    assert.equal(first.flights.find(f=>f.callsign==='BLUE').state,0)
    const edits=reorderEdits(first,{},'BLUE',time+1250000)
    const changed=runEngine(packet(time+1000,inputs),c,edits,first)
    assert.deepEqual(changed.flights.slice().sort((a,b)=>a.order-b.order).map(f=>f.callsign),['A','BLUE','B'])
    assert.equal(changed.flights.find(f=>f.callsign==='BLUE').state,0)
})

test('dragging a landed flight reinserts it once and retains the plan on refresh',()=>{
    const c=config();c.unstableSeconds=0
    const inputs=[plane('A',1200),plane('B',1440),plane('PINK',-60,{distanceNm:.1,groundspeed:0,altitude:100,route:[{name:'ELTOK',seconds:600}]})]
    const first=runEngine(packet(time,inputs),c,{})
    assert.equal(first.flights.find(f=>f.callsign==='PINK').state,4)
    const edits=reorderEdits(first,{},'PINK',time+1300000)
    validateLockedEdits(first,{},edits)
    const changed=runEngine(packet(time+1000,inputs),c,edits,first)
    assert.deepEqual(changed.flights.slice().sort((a,b)=>a.order-b.order).map(f=>f.callsign),['A','PINK','B'])
    const requeued=changed.flights.find(f=>f.callsign==='PINK')
    assert.equal(requeued.state,1);assert.equal(requeued.issue,'')
    assert.ok(requeued.sta>time)
    const again=runEngine(packet(time+4000,inputs),c,edits,changed)
    assert.equal(again.flights.find(f=>f.callsign==='PINK').sta,requeued.sta)
    assert.equal(again.flights.find(f=>f.callsign==='PINK').state,1)
})


test('a changed leader wake category increases the gap even for a white follower',()=>{
    const c=config();c.unstableSeconds=0
    const first=runEngine(packet(time,[plane('LEADER',900),plane('FOLLOWER',910)]),c,{})
    assert.ok(first.flights.find(f=>f.callsign==='FOLLOWER').state>=2)
    const next=runEngine(packet(time+1000,[plane('LEADER',899,{wake:'H'}),plane('FOLLOWER',909)]),c,{},first)
    const leader=next.flights.find(f=>f.callsign==='LEADER'),follower=next.flights.find(f=>f.callsign==='FOLLOWER')
    assert.ok(follower.sta-leader.sta>=wakeInterval('H','M','ESSA/19R',c)*1000-1)
    assert.equal(follower.spacingConflict,false)
})


test('arrival and departure roles migrate separately and change together at the selected time',()=>{
    const legacy={...config(),active:['ESSA/19R','ESSA/26'],departureRunway:undefined}
    const migrated=validateConfig(legacy)
    assert.deepEqual(migrated.active,['ESSA/19R']);assert.equal(migrated.departureRunway,'ESSA/26')
    migrated.pending={at:time+60000,active:['ESSA/01R'],departureRunway:'ESSA/01L',rates:{...migrated.rates,'ESSA/01R':150}}
    const checked=validateConfig(migrated)
    assert.equal(effectiveConfig(checked,time).departureRunway,'ESSA/26')
    const next=effectiveConfig(checked,time+60000)
    assert.deepEqual(next.active,['ESSA/01R']);assert.equal(next.departureRunway,'ESSA/01L')
    assert.equal(next.rates['ESSA/01R'],150)
    const sequence=runEngine(packet(time+60000,[plane('DEPONLY',1200,{runway:'01L'})]),checked,{})
    assert.match(sequence.flights[0].issue,/not active/)
})

test('reordering two white medium aircraft carries their existing gain/loss into the new slots',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const inputs=[plane('FIN6X',420),plane('DLH2JT',540)]
    const first=runEngine(packet(time,inputs),c,{})
    assert.ok(first.flights.every(f=>f.state>=2))
    assert.ok(first.flights.every(f=>f.delay===0))
    const edits=reorderEdits(first,{},'DLH2JT',time+410000)
    let moved=runEngine(packet(time+1000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-1}))),c,edits,first)
    assert.deepEqual(moved.flights.slice().sort((a,b)=>a.order-b.order).map(f=>f.callsign),['DLH2JT','FIN6X'])
    assert.ok(moved.flights.every(f=>f.delay===0))
    assert.equal(moved.flights.find(f=>f.callsign==='FIN6X').runwayDelay,120)
    assert.equal(moved.flights.find(f=>f.callsign==='DLH2JT').runwayDelay,-120)
    for(let seconds=2;seconds<20;seconds++){
        moved=runEngine(packet(time+seconds*1000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-seconds}))),c,edits,moved)
        assert.ok(moved.flights.every(f=>f.delay===0))
    }
    assert.ok(toJuhaSequence(moved,c,edits).sequence.every(f=>f.ttlttg_ff===0))
    c.slots=[{id:'close',runway:'ESSA/19R',begin:time+400000,end:time+500000}]
    const closed=runEngine(packet(time+20000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-20}))),c,edits,moved)
    assert.ok(closed.flights.some(f=>f.delay>0),'closure delays remain visible')
})

test('a white heavy reorder adds only the required extra wake spacing to its current gain/loss',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const inputs=[plane('MEDIUM',420),plane('HEAVY',535,{wake:'H'})]
    const first=runEngine(packet(time,inputs),c,{})
    const edits=reorderEdits(first,{},'HEAVY',time+410000)
    const next=runEngine(packet(time+1000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-1}))),c,edits,first)
    assert.equal(next.flights.find(f=>f.callsign==='HEAVY').delay,0)
    assert.equal(next.flights.find(f=>f.callsign==='MEDIUM').delay,Math.round(wakeInterval('H','M','ESSA/19R',c)-115))
})


test('stable runway and feeder slots do not move with minute-resolution route updates',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('LEAD',1200),plane('GREEN',1260)]),c,{})
    const again=runEngine(packet(time+35000,[plane('LEAD',1140),plane('GREEN',1200)]),c,{},first)
    for(const f of again.flights){const old=first.flights.find(o=>o.callsign===f.callsign);assert.equal(f.sta,old.sta);assert.equal(f.staFf,old.staFf);assert.equal(f.order,old.order)}
    const changed=runEngine(packet(time+40000,[plane('LEAD',1500),plane('GREEN',1770)]),c,{},again)
    assert.ok(changed.flights.every(f=>f.state>=1),'stable does not become unstable because route EET increases')
})

test('unconstrained leading minute-resolution jitter is not published as a holding instruction',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('BLX658',1080,{wake:'H',route:[{name:'NILUG',seconds:-60}]})]),c,{})
    const changed=runEngine(packet(time+10000,[plane('BLX658',1020,{wake:'H',route:[{name:'NILUG',seconds:-60}]})]),c,{},first)
    assert.equal(changed.flights[0].runwayDelay,50)
    assert.equal(changed.flights[0].delay,0)
    c.slots=[{id:'closed',runway:'ESSA/19R',begin:time+1000000,end:time+1150000}]
    const closed=runEngine(packet(time+15000,[plane('BLX658',1020,{wake:'H',route:[{name:'NILUG',seconds:-60}]})]),c,{},changed)
    assert.ok(closed.flights[0].delay>0,'actual closure constraints remain instructions')
})

test('heavy/medium wake requirement stays visible even when the runway rate is already larger',()=>{
    const c=config();c.unstableSeconds=0;c.rates['ESSA/19R']=142
    const first=runEngine(packet(time,[plane('BLX658',1080,{wake:'H'}),plane('NYX720',1090)]),c,{})
    const follower=first.flights.find(f=>f.callsign==='NYX720')
    assert.equal(follower.separation.leader,'BLX658');assert.equal(follower.separation.wakeNm,5)
    assert.equal(follower.separation.scheduledSeconds,142)
    assert.ok(follower.separation.wakeSeconds<142)
})


test('removing a closure restores pre-closure white times and gain/loss, including its followers',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const inputs=[plane('WHITE1',420),plane('WHITE2',540)]
    const original=runEngine(packet(time,inputs),c,{})
    c.slots=[{id:'gap',runway:'ESSA/19R',begin:time+400000,end:time+700000}]
    const delayed=runEngine(packet(time+1000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-1}))),c,{},original)
    assert.ok(delayed.flights.every(f=>f.closureDelayMs>0))
    c.slots=[]
    const restored=runEngine(packet(time+2000,inputs.map(f=>({...f,landingSeconds:f.landingSeconds-2}))),c,{},delayed)
    for(const f of restored.flights){const before=original.flights.find(o=>o.callsign===f.callsign);assert.equal(f.sta,before.sta);assert.equal(f.delay,before.delay);assert.equal(f.closureDelayMs,0)}
})


test('post-feeder slots, feeder identity and delay survive oscillating or missing route estimates',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    let s=runEngine(packet(time,[plane('A',420),plane('B',540)]),c,{})
    const accepted=structuredClone(s)
    for(let i=1;i<=30;i++){
        const flights=[plane('A',i%2?1200:180,{route:[],routeProblem:'No route prediction'}),plane('B',i%2?2000:250,{route:[{name:i%2?'ELTOK':'NILUG',seconds:800}]})]
        s=runEngine(packet(time+i*1000,flights),c,{},s)
        for(const f of s.flights){const old=accepted.flights.find(p=>p.callsign===f.callsign);assert.equal(f.sta,old.sta);assert.equal(f.staFf,old.staFf);assert.equal(f.delay,old.delay);assert.equal(f.order,old.order);assert.equal(f.passedFeeder,true);assert.equal(f.issue,'');assert.equal(f.feederId,old.feederId)}
    }
})

test('post-feeder reorder does not create route delay and changing rate does not retime accepted TMA slots',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const inputs=[plane('A',420),plane('B',540)]
    const first=runEngine(packet(time,inputs),c,{})
    const edits=reorderEdits(first,{},'B',time+410000)
    let s=runEngine(packet(time+1000,[plane('A',1200),plane('B',900)]),c,edits,first)
    assert.deepEqual(s.flights.slice().sort((a,b)=>a.order-b.order).map(f=>f.callsign),['B','A'])
    assert.ok(s.flights.every(f=>f.delay===0))
    const slots=s.flights.map(f=>f.sta)
    c.rates['ESSA/19R']=240
    for(let i=2;i<10;i++)s=runEngine(packet(time+i*1000,[plane('A',600+i*60),plane('B',1800-i*60)]),c,edits,s)
    assert.deepEqual(s.flights.map(f=>f.sta),slots);assert.ok(s.flights.every(f=>f.delay===0))
})

test('post-feeder closure and extra wake delays are reversible despite route ETA jitter',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('A',420),plane('B',535)]),c,{})
    let s=runEngine(packet(time+1000,[plane('A',1000,{wake:'H'}),plane('B',1500)]),c,{},first)
    assert.equal(s.flights[0].delay,0);assert.equal(s.flights[1].delay,Math.round(wakeInterval('H','M','ESSA/19R',c)-115))
    c.slots=[{id:'closed',runway:'ESSA/19R',begin:time+400000,end:time+700000}]
    s=runEngine(packet(time+2000,[plane('A',1200,{wake:'H'}),plane('B',700)]),c,{},s)
    assert.ok(s.flights.every(f=>f.delay>0))
    c.slots=[]
    s=runEngine(packet(time+3000,[plane('A',900),plane('B',1800)]),c,{},s)
    for(const f of s.flights){const old=first.flights.find(p=>p.callsign===f.callsign);assert.equal(f.sta,old.sta);assert.equal(f.delay,old.delay)}
})


test('a cleared telemetry inventory removes old tracks immediately and new traffic bootstraps without an old-session minimum',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=600
    const first=runEngine(packet(time,[plane('OLD1',420),plane('OLD2',540)]),c,{})
    const cleared=runEngine(packet(time+1000,[]),c,{},first)
    assert.deepEqual(cleared.flights,[])
    const replaced=runEngine(packet(time+2000,[plane('NEW',120)]),c,{},first)
    assert.deepEqual(replaced.flights.map(f=>f.callsign),['NEW'])
    assert.equal(replaced.flights[0].minimumArrival,time+2000)
    assert.equal(replaced.flights[0].sta,time+122000)
    assert.deepEqual(toJuhaSequence(replaced,c,{}).sequence.map(f=>f.callsign),['NEW'])
})


test('explicit recompute releases a held early slot and discards post-feeder delay anchors',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('SAS44D',1200)]),c,{})
    const later=runEngine(packet(time+1000,[plane('SAS44D',1680)]),c,{},first)
    assert.ok(later.flights[0].delay< -450)
    const edits={SAS44D:{recomputeAt:time+2000,changedAt:time+2000}}
    const recomputed=runEngine(packet(time+2000,[plane('SAS44D',1680)]),c,edits,later)
    assert.equal(recomputed.flights[0].delay,0);assert.equal(recomputed.flights[0].sta,recomputed.flights[0].eta)
    assert.equal(recomputed.flights[0].reorderTiming,undefined);assert.equal(recomputed.flights[0].tmaTiming,undefined)
})


test('Frozen aircraft cannot be dragged or crossed manually, but recompute keeps their order',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('FROZEN',240),plane('WHITE',420),plane('GREEN',1200)]),c,{})
    assert.equal(first.flights[0].state,3)
    assert.throws(()=>reorderEdits(first,{},'FROZEN',time+500000),/Frozen/)
    assert.throws(()=>reorderEdits(first,{},'WHITE',time+230000),/Frozen/)
    assert.throws(()=>validateLockedEdits(first,{}, {FROZEN:{order:1},WHITE:{order:0}}),/Frozen/)
    const edits={FROZEN:{order:0,recomputeAt:time+2000,target:undefined}}
    assert.doesNotThrow(()=>validateLockedEdits(first,{},edits))
    const changed=runEngine(packet(time+2000,[plane('FROZEN',1200),plane('WHITE',418),plane('GREEN',1198)]),c,edits,first)
    assert.equal(changed.flights.find(f=>f.callsign==='FROZEN').state,3)
    assert.equal(changed.flights.find(f=>f.callsign==='FROZEN').order,0)
})

test('Stable order survives existing unstable ETA changes, but accepts newly captured earlier arrivals',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('STABLE',1200),plane('BLUE',2000)]),c,{})
    const changed=runEngine(packet(time+1000,[plane('STABLE',1700),plane('BLUE',1600)]),c,{},first)
    assert.deepEqual(changed.flights.slice().sort((a,b)=>a.order-b.order).map(f=>f.callsign),['STABLE','BLUE'])
    const incoming=runEngine(packet(time+2000,[plane('STABLE',1700),plane('BLUE',1600),plane('NEW',1100)]),c,{},changed)
    assert.ok(incoming.flights.find(f=>f.callsign==='NEW').order<incoming.flights.find(f=>f.callsign==='STABLE').order)
})

test('planned time never marks Landed; touchdown needs sustained low altitude and speed near the airport',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('AIRBORNE',5)]),c,{})
    const next=runEngine(packet(time+10000,[plane('AIRBORNE',120)]),c,{},first)
    assert.notEqual(next.flights[0].state,4)
    const ground=plane('AIRBORNE',0,{distanceNm:.1,groundspeed:40,altitude:180})
    const candidate=runEngine(packet(time+11000,[ground]),c,{},next)
    assert.notEqual(candidate.flights[0].state,4,'one ground-like sample is insufficient')
    const ended=runEngine(packet(time+16000,[ground]),c,{},candidate)
    assert.equal(ended.flights[0].state,4);assert.equal(ended.landings.at(-1).time,time+16000)
    const marked=runEngine(packet(time+11000,[plane('AIRBORNE',0)]),c,{AIRBORNE:{landedAt:time+11000}},next)
    assert.equal(marked.flights[0].state,4,'controller can explicitly confirm landing')
    const far=runEngine(packet(time+17000,[{...ground,distanceNm:20}]),c,{},candidate)
    assert.notEqual(far.flights[0].state,4,'a slow low aircraft away from the airport is not landed')
})


test('VACRA is an ESSA feeder crossing rather than the default synthetic feeder time',()=>{
    const c=config();c.unstableSeconds=0
    const s=runEngine(packet(time,[plane('VACRA1',1500,{route:[{name:'VACRA',seconds:400}]})]),c,{})
    const f=s.flights[0]
    assert.equal(f.ff,'VACRA');assert.equal(f.feeder,'VACRA');assert.equal(f.feederId,'V')
    assert.equal(f.etaFf,time+400000);assert.equal(f.passedFeeder,false)
    const passed=runEngine(packet(time+1000,[plane('VACRA1',1499,{route:[{name:'VACRA',seconds:-60}]})]),c,{},s)
    assert.equal(passed.flights[0].passedFeeder,true)
})


test('timed runway and rate changes survive together and apply chronologically to the active arrival runway',()=>{
    const c=config();c.pending={at:time+600000,active:['ESSA/01R'],departureRunway:'ESSA/01L',rates:{...c.rates,'ESSA/01R':180},applyRate:true}
    c.pendingRate={at:time+900000,seconds:150}
    const checked=validateConfig(c)
    assert.equal(checked.pendingRate.seconds,150);assert.equal(checked.pending.at,time+600000)
    assert.equal(effectiveConfig(checked,time).rates['ESSA/19R'],115)
    const afterRunway=effectiveConfig(checked,time+600000)
    assert.deepEqual(afterRunway.active,['ESSA/01R']);assert.equal(afterRunway.rates['ESSA/01R'],180)
    const afterRate=effectiveConfig(checked,time+900000)
    assert.equal(afterRate.rates['ESSA/01R'],150);assert.equal(afterRate.rates['ESSA/19R'],115)
    checked.pendingRate.at=time+300000
    assert.equal(effectiveConfig(checked,time+300000).rates['ESSA/19R'],150)
    assert.equal(effectiveConfig(checked,time+600000).rates['ESSA/19R'],150,'runway changes cannot overwrite unrelated rate history')
    checked.pendingRate.at=checked.pending.at
    assert.equal(effectiveConfig(checked,checked.pending.at).rates['ESSA/01R'],150,'explicit rate wins when both changes have the same time')
})

test('a runway-only configuration change cannot reset a separately planned rate',()=>{
    const c=config();c.pending={at:time+600000,active:['ESSA/19R'],departureRunway:'ESSA/01L',rates:{...c.rates},applyRate:false};c.pendingRate={at:time+300000,seconds:170}
    assert.equal(effectiveConfig(validateConfig(c),time+600000).rates['ESSA/19R'],170)
    assert.equal(effectiveConfig(validateConfig({...c,pending:undefined}),time+600000).rates['ESSA/19R'],170)
    assert.equal(effectiveConfig(validateConfig({...c,pendingRate:undefined}),time+600000).rates['ESSA/19R'],115)
    assert.throws(()=>validateConfig({...c,pendingRate:{at:time,seconds:10}}),/rate change/)
})


test('older timed rate-only records migrate out of the runway configuration slot',()=>{
    const c=config();c.pending={at:time+600000,active:[...c.active],departureRunway:c.departureRunway,rates:{...c.rates,'ESSA/19R':170}}
    const migrated=validateConfig(c)
    assert.equal(migrated.pending,undefined);assert.deepEqual(migrated.pendingRate,{at:time+600000,seconds:170})
    assert.equal(effectiveConfig(migrated,time+600000).rates['ESSA/19R'],170)
})

test('invalid ESSB runway data does not produce diagnostics or block valid ESSA arrivals',()=>{
    const c=config(),input=packet(time,[plane('ESSA1',1200),{callsign:'DEMAB',arrival:'ESSB',runway:'',route:null}])
    const valid=validateTelemetry(input,time)
    assert.deepEqual(valid.flights.map(f=>f.callsign),['ESSA1'])
    const s=runEngine(input,c,{})
    assert.deepEqual(s.flights.map(f=>f.callsign),['ESSA1']);assert.deepEqual(s.diagnostics,[])
    const old={...s,flights:[...s.flights,{...s.flights[0],callsign:'OLDESSB',arrival:'ESSB',runway:'30',state:4,sta:time}],landings:[{callsign:'OLDESSB',runway:'ESSB/30',time}]}
    const next=runEngine(packet(time+1000,[plane('ESSA1',1199)]),c,{},old)
    assert.equal(next.flights.some(f=>f.arrival==='ESSB'),false);assert.equal(next.landings.some(l=>l.runway.startsWith('ESSB/')),false)
    const native=toJuhaSequence(old,c,{})
    assert.deepEqual(native.airports.map(a=>a.icao),['ESSA']);assert.equal(native.sequence.some(f=>f.ades==='ESSB'),false)
})

const vectorRoute=[{name:'ELTOK',seconds:-1,latitude:59.824444,longitude:16.989917},{name:'FI01L',seconds:180,latitude:59.516028,longitude:17.869592},{name:'SA01L',seconds:300,latitude:59.637253,longitude:17.913222},{name:'ESSA',seconds:360,latitude:59.651944,longitude:17.918611}]
const vectorPlane=(extra={})=>plane('VECTOR1',1200,{runway:'01L',route:vectorRoute,latitude:59.57,longitude:17.889,heading:10.4,assignedHeading:0,calculatedRouteIndex:1,...extra})
const vectorConfig=()=>({...config(),active:['ESSA/01L'],departureRunway:'ESSA/01R',minimumNewSeconds:0,unstableSeconds:0})
test('final approach detection uses named runway geometry and observed speed without an assigned heading',()=>{
    const c=vectorConfig(),s=runEngine(packet(time,[vectorPlane({groundspeed:180})]),c,{})
    const f=s.flights[0]
    assert.equal(f.predictionSource,'vectoring');assert.equal(f.vectorDetection,'final')
    assert.ok(f.eta-time>60000&&f.eta-time<120000,'final estimate uses distance to the runway threshold, not the airport centre or stale STAR EET')
    assert.equal(f.state,3)
    const next=runEngine(packet(time+5000,[vectorPlane({groundspeed:100})]),c,{},s)
    assert.ok(next.flights[0].eta>f.eta)
    assert.equal(next.flights[0].sta,f.sta,'a changed forecast cannot silently move a Frozen slot')
    const edits={VECTOR1:{order:f.order,recomputeAt:time+6000,changedAt:time+6000}}
    const refreshed=runEngine(packet(time+6000,[vectorPlane({groundspeed:100})]),c,edits,next)
    assert.ok(refreshed.flights[0].sta>f.sta,'explicit recompute adopts the latest physical prediction')
    assert.equal(refreshed.flights[0].order,f.order)
})
test('off-route vector detection requires persistent fresh geometry and does not classify a matching direct-to as vectoring',()=>{
    const c=vectorConfig();c.frozenMinutes=0
    const p=vectorPlane({latitude:59.6,longitude:17.8,heading:90})
    let s=runEngine(packet(time,[p]),c,{})
    assert.equal(s.flights[0].predictionSource,'route')
    s=runEngine(packet(time+3000,[p]),c,{},s);assert.equal(s.flights[0].predictionSource,'route')
    s=runEngine(packet(time+6000,[p]),c,{},s);assert.equal(s.flights[0].vectorDetection,'off-route')
    const stale=runEngine(packet(time+7000,[{...p,positionAgeSeconds:20}]),c,{},s)
    assert.equal(stale.flights[0].predictionSource,'route')
    const d={...p,direct:'SA01L',heading:57}
    let direct=runEngine(packet(time,[d]),c,{})
    direct=runEngine(packet(time+10000,[d]),c,{},direct)
    assert.equal(direct.flights[0].vectorDetection,undefined,'a flight tracking its instructed direct remains route-based')
})

test('Stable dragging assigns both lose and gain times without exchanging unrelated slots',()=>{
    const c=config();c.unstableSeconds=0;c.stableMinutes=60;c.superStableMinutes=0;c.frozenMinutes=0;c.minimumNewSeconds=0
    const input=packet(time,[plane('FIRST',1200),plane('VKG2565',2400),plane('LAST',3600)])
    const first=runEngine(input,c,{})
    assert.equal(first.flights.find(f=>f.callsign==='VKG2565').state,1)
    for(const delta of [-120000,120000]){
        const edits=retimeEdits(first,{},'VKG2565',time+2400000+delta,'Runway',c)
        const next=runEngine(packet(time+1000,input.flights.map(f=>({...f,landingSeconds:f.landingSeconds-1}))),c,edits,first)
        const f=next.flights.find(f=>f.callsign==='VKG2565')
        assert.equal(f.sta,time+2400000+delta);assert.equal(f.delay,delta/1000)
        assert.equal(next.flights.find(f=>f.callsign==='LAST').sta,first.flights.find(f=>f.callsign==='LAST').sta)
        const repeated=runEngine(packet(time+5000,input.flights.map(f=>({...f,landingSeconds:f.landingSeconds-5}))),c,edits,next)
        assert.equal(repeated.flights.find(f=>f.callsign==='VKG2565').sta,f.sta)
    }
    const f=first.flights.find(f=>f.callsign==='VKG2565'),acc=retimeEdits(first,{},f.callsign,f.staFf+120000,'ACC',c)
    assert.equal(acc[f.callsign].target,f.sta+120000)
})
test('unconstrained Stable estimate drift does not create a lose minute, but a manual target does',()=>{
    const c=config();c.unstableSeconds=0;c.stableMinutes=60;c.superStableMinutes=0;c.frozenMinutes=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('LEADER',600),plane('VKG2565',2400)]),c,{})
    const input=packet(time+5000,[plane('LEADER',595),plane('VKG2565',2330)])
    const drift=runEngine(input,c,{},first),f=drift.flights.find(f=>f.callsign==='VKG2565')
    assert.equal(f.runwayDelay,65);assert.equal(f.delay,0);assert.equal(f.sta,first.flights.find(f=>f.callsign==='VKG2565').sta)
    const ss=runEngine({...input,timestamp:time+5001,flights:input.flights.map(p=>p.callsign==='VKG2565'?{...p,route:[{name:'ELTOK',seconds:600}]}:p)},{...c,superStableMinutes:12},{},drift)
    assert.equal(ss.flights.find(p=>p.callsign==='VKG2565').state,2);assert.equal(ss.flights.find(p=>p.callsign==='VKG2565').delay,0,'the unrequested lose cannot reappear on entering Super Stable')
    const edits=retimeEdits(drift,{},f.callsign,f.eta+120000,'Runway',c)
    const manual=runEngine({...input,timestamp:time+5001},c,edits,drift)
    assert.ok(manual.flights.find(p=>p.callsign===f.callsign).delay>=119)
})

test('Super Stable before the feeder holds instructions through ETA changes and cleans up legacy unsolicited gains',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0
    const first=runEngine(packet(time,[plane('FIN3EJ',1000)]),c,{})
    assert.equal(first.flights[0].state,2);assert.equal(first.flights[0].passedFeeder,false)
    const old={...first,flights:first.flights.map(f=>({...f,delay:-110,runwayDelay:-110}))}
    const changed=runEngine(packet(time+5000,[plane('FIN3EJ',1200)]),c,{},old)
    assert.equal(changed.flights[0].delay,0);assert.equal(changed.flights[0].sta,first.flights[0].sta)
    const again=runEngine(packet(time+10000,[plane('FIN3EJ',1250)]),c,{},changed)
    assert.equal(again.flights[0].delay,0);assert.equal(again.flights[0].tmaTiming.instructionSource,'none')
})
test('a Stable manual gain remains assigned on entering Super Stable',()=>{
    const c=config();c.unstableSeconds=0;c.stableMinutes=60;c.superStableMinutes=0;c.minimumNewSeconds=0;c.frozenMinutes=0
    const first=runEngine(packet(time,[plane('VKG2565',2400)]),c,{})
    const edits=retimeEdits(first,{},'VKG2565',time+2280000,'Runway',c)
    const manual=runEngine(packet(time+1000,[plane('VKG2565',2399)]),c,edits,first)
    assert.equal(manual.flights[0].delay,-120)
    const ss=runEngine(packet(time+2000,[plane('VKG2565',2398,{route:[{name:'ELTOK',seconds:200}]})]),{...c,superStableMinutes:5},edits,manual)
    assert.equal(ss.flights[0].state,2);assert.equal(ss.flights[0].delay,-120);assert.equal(ss.flights[0].tmaTiming.instructionSource,'manual')
})

test('resumed missed approaches remain movable while the old near-runway prediction persists, then arm freezing for a fresh approach',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=600
    const first=runEngine(packet(time,[plane('GOAROUND',180)]),c,{})
    assert.equal(first.flights[0].state,3)
    const missed=runEngine(packet(time+1000,[plane('GOAROUND',0,{altitude:100,groundspeed:40,distanceNm:.1})]),c,{GOAROUND:{mode:'missed'}},first)
    const edits={GOAROUND:{mode:'sequenced',recomputeAt:time+2000,changedAt:time+2000}}
    let resumed=runEngine(packet(time+2000,[plane('GOAROUND',-60,{altitude:100,groundspeed:40,distanceNm:.1})]),c,edits,missed)
    assert.equal(resumed.flights[0].state,2);assert.equal(resumed.flights[0].missedRecovery,true);assert.equal(resumed.flights[0].delay,0)
    resumed=runEngine(packet(time+6000,[plane('GOAROUND',0,{altitude:500,groundspeed:150})]),c,edits,resumed)
    assert.equal(resumed.flights[0].state,2)
    assert.doesNotThrow(()=>reorderEdits(resumed,edits,'GOAROUND',time+900000,'Runway',c))
    const fresh=runEngine(packet(time+10000,[plane('GOAROUND',900,{altitude:1500,groundspeed:180})]),c,edits,resumed)
    assert.equal(fresh.flights[0].missedRecovery,false);assert.equal(fresh.flights[0].state,2)
    const final=runEngine(packet(time+12000,[plane('GOAROUND',240,{altitude:1000,groundspeed:150})]),c,edits,fresh)
    assert.equal(final.flights[0].state,3,'Frozen returns normally on the next approach')
})

test('NSZ38K gains Super Stable status without inventing five lose minutes from its held estimate',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0;c.frozenMinutes=0;c.stableMinutes=30
    const first=runEngine(packet(time,[plane('NSZ38K',1800)]),c,{})
    assert.equal(first.flights[0].state,1)
    const next=runEngine(packet(time+5000,[plane('NSZ38K',1495,{route:[{name:'ELTOK',seconds:200}]})]),c,{},first)
    assert.equal(next.flights[0].state,2);assert.equal(next.flights[0].sta,first.flights[0].sta)
    assert.equal(next.flights[0].runwayDelay,300);assert.equal(next.flights[0].delay,0)
})

test('NSZ38K keeps its assigned two-minute lose instruction when manually inserted into the minute-52 slot',()=>{
    const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0;c.stableMinutes=60;c.superStableMinutes=0;c.frozenMinutes=0
    const clock=time+40*60000,input=packet(clock,[plane('EWG89W',12*60),plane('NSZ38K',12*60)])
    const first=runEngine(input,c,{})
    const manual=retimeEdits(first,{},'NSZ38K',time+54*60000,'Runway',c)
    const assigned=runEngine(packet(clock+1000,input.flights.map(p=>({...p,landingSeconds:p.landingSeconds-1}))),c,manual,first)
    assert.equal(assigned.flights.find(f=>f.callsign==='NSZ38K').delay,120)
    const ssConfig={...c,superStableMinutes:5}
    const ss=runEngine(packet(clock+2000,input.flights.map(p=>({...p,landingSeconds:p.landingSeconds-2,route:[{name:'ELTOK',seconds:200}]}))),ssConfig,manual,assigned)
    const swap=reorderEdits(ss,manual,'NSZ38K',time+52*60000-1,'Runway',ssConfig)
    const moved=runEngine(packet(clock+3000,input.flights.map(p=>({...p,landingSeconds:p.landingSeconds-3,route:[{name:'ELTOK',seconds:199}]}))),ssConfig,swap,ss)
    const nsz=moved.flights.find(f=>f.callsign==='NSZ38K')
    assert.equal(new Date(nsz.sta).getUTCMinutes(),52)
    assert.equal(nsz.delay,120);assert.equal(delayLabel(nsz.delay),'2')
    assert.equal(nsz.tmaTiming.instructionSource,'manual')
    assert.equal(toJuhaSequence(moved,ssConfig,swap).sequence.find(f=>f.callsign==='NSZ38K').ttlttg_ff,120)
})


test('SAS898 moving from minute 24 to 22 satisfies its old two-minute lose instruction inside the TMA',()=>{
 const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0;c.frozenMinutes=0;c.rates['ESSA/19R']=120
 const input=packet(time,[plane('SAS035',1320,{route:[{name:'ELTOK',seconds:-1}]}),plane('SAS898',1320,{route:[{name:'ELTOK',seconds:-1}]})])
 const seed=runEngine(input,c,{})
 assert.equal(seed.flights.find(f=>f.callsign==='SAS898').delay,120)
 assert.equal(new Date(seed.flights.find(f=>f.callsign==='SAS898').sta).getUTCMinutes(),24)
 const edits=reorderEdits(seed,{},'SAS898',time+1320000-1,'Runway',c)
 let moved=runEngine(packet(time+1000,input.flights.map(f=>({...f,landingSeconds:f.landingSeconds-1}))),c,edits,seed)
 const leading=moved.flights.find(f=>f.callsign==='SAS898')
 assert.equal(new Date(leading.sta).getUTCMinutes(),22);assert.equal(leading.delay,0)
 assert.equal(moved.flights.find(f=>f.callsign==='SAS035').delay,0)
 for(let seconds=2;seconds<10;seconds++){
  moved=runEngine(packet(time+seconds*1000,input.flights.map(f=>({...f,landingSeconds:f.landingSeconds-seconds}))),c,edits,moved)
  assert.equal(moved.flights.find(f=>f.callsign==='SAS898').delay,0)
 }
})
test('EuroScope gain/lose stops 12 NM after the feeder, not 12 NM before it, and stays suppressed after turning back',()=>{
 const c=config();c.unstableSeconds=0;c.minimumNewSeconds=0;c.frozenMinutes=0
 const fix={latitude:59.824444,longitude:16.989917}
 const p=plane('TTLTEST',1400,{route:[{name:'ELTOK',seconds:-1}],latitude:fix.latitude-.18,longitude:fix.longitude})
 const first=runEngine(packet(time,[p]),c,{})
 const seed={...first,flights:first.flights.map(f=>({...f,delay:120,tmaTiming:{delay:120,rateSeconds:115,instructionSource:'manual'}}))}
 const near=runEngine(packet(time+1000,[{...p,landingSeconds:1399}]),c,{},seed)
 assert.ok(near.flights[0].feederDistanceNm<12);assert.equal(euroscopeInstruction(near.flights[0]),120)
 const far=runEngine(packet(time+2000,[{...p,latitude:fix.latitude-.21,landingSeconds:1398}]),c,{},near)
 assert.ok(far.flights[0].feederDistanceNm>=12);assert.equal(far.flights[0].delay,120)
 assert.equal(euroscopeInstruction(far.flights[0]),0);assert.equal(toJuhaSequence(far,c,{}).sequence[0].ttlttg_ff,0)
 const back=runEngine(packet(time+3000,[{...p,landingSeconds:1397}]),c,{},far)
 assert.equal(euroscopeInstruction(back.flights[0]),0)
 const before=runEngine(packet(time,[{...p,latitude:fix.latitude+.4,route:[{name:'ELTOK',seconds:700}]}]),c,{})
 assert.equal(before.flights[0].passedFeeder,false);assert.equal(before.flights[0].line0Suppressed,false)
 assert.equal(euroscopeInstruction({...before.flights[0],delay:120}),120)
})
