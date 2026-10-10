import {test} from 'node:test'
import assert from 'node:assert/strict'
import {STAR_PROFILES,STAR_FEEDERS,STAR_RUNWAYS,STAR_SOURCE,starPrediction,starTravelSeconds,iasToTas,canonicalFeeder,preFeederSeconds} from '../src/maestro-star-prediction.ts'
import {DEFAULT_CONFIG,runEngine} from '../src/maestro-engine.ts'
const now=Date.UTC(2026,9,10,10)
const config=()=>({...structuredClone(DEFAULT_CONFIG),active:['ESSA/01L'],minimumNewSeconds:0,unstableSeconds:0})
const ff=STAR_FEEDERS.ELTOK,threshold=STAR_RUNWAYS['01L']
const before={latitude:ff.latitude+.3,longitude:ff.longitude-.3}
const point=(name,p,seconds=900)=>({name,...p,seconds})
const flight=(extra={})=>({callsign:'TEST',aircraft:'A320',wake:'M',departure:'EKCH',arrival:'ESSA',runway:'01L',star:'ELTOK8M',route:[point('BEFORE',before),point('ELTOK',ff),point('SA01L',threshold)],landingSeconds:2000,distanceNm:60,groundspeed:400,altitude:18000,...before,...extra})
const packet=(flights,timestamp=now)=>({source:'ESSA_C_APP',timestamp,flights})

test('latest workbook contains 24 STARs and eight RNP profiles, with vectors as default',()=>{
 assert.equal(STAR_PROFILES.filter(p=>p.kind==='star').length,24);assert.equal(STAR_PROFILES.filter(p=>p.kind==='rnp').length,8)
 assert.equal(STAR_SOURCE.sha256,'0ad96dafbb4dcf807ae55d2bc320e7eba1768aeb134c4f442df202a4bd73606e')
 assert.equal(STAR_PROFILES.find(p=>p.runway==='19R'&&p.feeder==='ELTOK'&&p.kind==='star').vectors,48)
 assert.equal(DEFAULT_CONFIG.predictionMode,'star');assert.equal(DEFAULT_CONFIG.starDistanceMethod,'vectors')
})
test('49 NM ELTOK vectors distance is used at the feeder, independently of all EuroScope EETs',()=>{
 const p=flight({...ff}),a=starPrediction(p,config()),b=starPrediction({...p,landingSeconds:-999,route:p.route.map(r=>({...r,seconds:99999}))},config())
 assert.equal(a.error,undefined);assert.equal(a.distanceProfile.fullNm,49);assert.equal(a.distanceProfile.remainingNm,49)
 assert.equal(a.distanceProfile.sourceRange,'A3:E3');assert.deepEqual(a,b)
 assert.equal(a.seconds,starTravelSeconds(49,18000,/* course checked via same model */ Math.atan2(0,1),{...config(),surfaceWindSpeed:0}))
})
test('physical position advances the remaining distance without route time changes',()=>{
 const a=starPrediction(flight({...ff}),config()),mid={latitude:(ff.latitude+threshold.latitude)/2,longitude:(ff.longitude+threshold.longitude)/2}
 const b=starPrediction(flight({...mid,altitude:9000}),config())
 assert.ok(b.passedFeeder);assert.ok(b.distanceProfile.remainingNm<a.distanceProfile.remainingNm);assert.ok(b.seconds<a.seconds)
})
test('IAS converts to TAS and speed, wind and descent assumptions affect elapsed time',()=>{
 assert.ok(Math.abs(iasToTas(250,0)-250)<1e-6);assert.ok(iasToTas(250,18000)>250)
 const c=config(),base=starTravelSeconds(49,18000,180,c)
 assert.ok(starTravelSeconds(49,18000,180,c,160)>base)
 assert.ok(starTravelSeconds(49,18000,180,{...c,surfaceWindDirection:180,surfaceWindSpeed:30})>base)
 assert.ok(starTravelSeconds(10,18000,180,{...c,starDescentRate:500})>=2142)
})
test('departing aircraft are forecast to accelerate instead of spending the entire trip at takeoff groundspeed',()=>{
 const p=flight({groundspeed:180,altitude:2000,verticalSpeed:1800})
 assert.ok(preFeederSeconds(300,p,config())<300/180*3600)
})
test('legacy HMR coordinate maps to VACRA, and missing positions have no EuroScope time fallback',()=>{
 assert.equal(canonicalFeeder({name:'HMR',...STAR_FEEDERS.VACRA}),'VACRA')
 assert.match(starPrediction(flight({latitude:undefined}),config()).error,/position/)
 assert.match(starPrediction(flight({star:'',route:[]}),config()).error,/profile/)
})
test('direct-to beyond the feeder shortens the workbook path independently of EETs',()=>{
 const p=flight(),a=starPrediction(p,config()),b=starPrediction({...p,direct:'SA01L'},config())
 assert.ok(b.distanceProfile.shortcut);assert.ok(b.seconds<a.seconds)
})
test('live engine ignores unreliable route times and infers the active ESSA runway if unset',()=>{
 const p=flight({runway:''}),a=runEngine(packet([p]),config(),{}),b=runEngine(packet([{...p,landingSeconds:-1000,route:p.route.map(r=>({...r,seconds:99999}))}]),config(),{})
 assert.equal(a.flights[0].runway,'01L');assert.equal(a.flights[0].runwaySource,'active');assert.equal(a.flights[0].predictionSource,'star-distance')
 assert.equal(a.flights[0].eta,b.flights[0].eta);assert.equal(a.flights[0].sta,b.flights[0].sta);assert.equal(a.flights[0].state,b.flights[0].state)
})
test('automatic aircraft from the same feeder retain their order in ACC and Runway',()=>{
 const a=flight({callsign:'NOZ826',groundspeed:400}),b=flight({callsign:'DLH1A',groundspeed:300,wake:'H'})
 const result=runEngine(packet([b,a]),config(),{}).flights
 const noz=result.find(f=>f.callsign==='NOZ826'),dlh=result.find(f=>f.callsign==='DLH1A')
 assert.ok(noz.etaFf<dlh.etaFf);assert.ok(noz.staFf<dlh.staFf);assert.ok(noz.sta<dlh.sta)
 assert.equal(noz.sta-noz.staFf,noz.eta-noz.etaFf)
})
test('wake separation is still applied with workbook predictions',()=>{
 const p=flight(),result=runEngine(packet([{...p,callsign:'HEAVY',wake:'H'},{...p,callsign:'MEDIUM'}]),config(),{}).flights
 const leader=result.find(f=>f.callsign==='HEAVY'),follower=result.find(f=>f.callsign==='MEDIUM')
 assert.ok(follower.sta>leader.sta);assert.ok(follower.separation.wakeNm>=5)
})
test('coincident ELTOK arrivals receive feeder delay even if their landing estimates are far apart',()=>{
 const p=flight(),c=config(),result=runEngine(packet([{...p,callsign:'NOZ826'},{...p,callsign:'DLH1A',groundspeed:395,altitude:30000,wake:'H'}]),c,{}).flights
 const noz=result.find(f=>f.callsign==='NOZ826'),dlh=result.find(f=>f.callsign==='DLH1A')
 assert.ok(Math.abs(dlh.etaFf-noz.etaFf)<30000)
 assert.ok(dlh.staFf-noz.staFf>=c.rates['ESSA/01L']*1000)
 assert.ok(dlh.delay>=80,'the feeder constraint must publish lose minutes, rather than being cleared because runway spacing was already sufficient')
 assert.ok(dlh.feederDelayMs>0)
})
test('a shorter predicted approach cannot automatically overtake its feeder predecessor',()=>{
 const p=flight(),result=runEngine(packet([{...p,callsign:'NOZ826',latitude:ff.latitude+.001,longitude:ff.longitude-.001,assignedSpeed:100},{...p,callsign:'DLH1A',groundspeed:400}]),config(),{}).flights
 const noz=result.find(f=>f.callsign==='NOZ826'),dlh=result.find(f=>f.callsign==='DLH1A')
 assert.ok(noz.etaFf<dlh.etaFf);assert.ok(noz.eta>dlh.eta)
 assert.ok(noz.sta<dlh.sta);assert.ok(noz.staFf<dlh.staFf)
})
