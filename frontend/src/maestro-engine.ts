// Independent implementation of the documented MAESTRO data model.
// All absolute times are Unix milliseconds internally; route EET inputs are seconds.
import { finalPosition, headingDifference, bearingBetween, vectoringSeconds, vectoringDistance, type GeoPoint, type RunwayGeometry } from './maestro-geometry'
import {starPrediction,starTravelSeconds,STAR_RUNWAYS,STAR_FEEDERS,distanceNm} from './maestro-star-prediction'
export const FEEDERS = [
    { name: 'NILUG', id: 'N', airport: 'ESSA', fixes: ['NILUG'] },
    { name: 'XILAN', id: 'X', airport: 'ESSA', fixes: ['XILAN'] },
    { name: 'ELTOK', id: 'E', airport: 'ESSA', fixes: ['ELTOK'] },
    { name: 'VACRA', id: 'V', airport: 'ESSA', fixes: ['VACRA'] },
    { name: 'TRS', id: 'T', airport: 'ESSB', fixes: ['TRS'] },
    { name: 'ALOLA TINKA XILAN', id: 'T', airport: 'ESSB', fixes: ['ALOLA', 'TINKA', 'XILAN'] },
    { name: 'ARS HMR', id: 'A', airport: 'ESSB', fixes: ['ARS', 'HMR'] },
] as const
export const RUNWAYS = ['ESSA/01L', 'ESSA/01R', 'ESSA/08', 'ESSA/19L', 'ESSA/19R', 'ESSA/26', 'ESSB/12', 'ESSB/30']
export const STATE_NAMES = ['UNSTABLE', 'STABLE', 'SUPERSTABLE', 'FROZEN', 'LANDED'] as const
export const STATE_COLORS = ['#16417c', '#96d796', '#ffffff', '#40e0d0', '#dc7daf']
export interface EngineConfig {
    displayPreferences?:{labels:{type:boolean;feeder:boolean;totalDelay:boolean;currentDelay:boolean;runway:boolean};panels:{winds:boolean;rates:boolean;tracks:boolean}}
    predictionMode?:'star'|'euroscope'
    starDistanceMethod?:'vectors'|'ese'|'shortest'
    starApproachSpeed?:number;starBaseSpeed?:number;starFinalNm?:number;starBaseNm?:number;starEntryAltitude?:number;starDescentRate?:number;starCruiseSpeed?:number;starClimbRate?:number
    active: string[]
    departureRunway?: string
    rates: Record<string, number>
    stableMinutes: number
    superStableMinutes: number
    frozenMinutes: number
    unstableSeconds: number
    minimumNewSeconds: number
    landingSpeedKnots: number
    surfaceWindDirection: number
    surfaceWindSpeed: number
    surfaceWindAuto?: boolean
    stableBufferMinutes?: number
    superStableBufferMinutes?: number
    defaultFeederMinutes?: number
    maxFinalNm?: number
    vectoringMode?: number
    finalLengths?: Record<string,number>
    delayPaths?: { airport:string; runways:string[]; feeders:string[]; points:string[] }[]
    slots: { id: string; runway: string; begin: number; end: number }[]
    pending?: { at: number; active: string[]; rates: Record<string, number>; departureRunway?:string; applyRate?:boolean }
    pendingRate?: {at:number;seconds:number}
    manualFlights?: { callsign:string; runway:string; aircraft:string; wake:string; feeder:string; eta:number }[]
}
export const DEFAULT_CONFIG: EngineConfig = {
    predictionMode:'star',starDistanceMethod:'vectors',starApproachSpeed:250,starBaseSpeed:180,starFinalNm:10,starBaseNm:20,starEntryAltitude:18000,starDescentRate:1800,starCruiseSpeed:450,starClimbRate:1800,
    active: ['ESSA/19R'], departureRunway:'ESSA/26',
    rates: Object.fromEntries(RUNWAYS.map(r => [r, r.endsWith('/08') ? 166 : r.endsWith('/26') || r.startsWith('ESSB/') ? 142 : 115])),
    stableMinutes: 12, superStableMinutes: 8, frozenMinutes: 5, unstableSeconds: 60,
    minimumNewSeconds: 600, slots: [],
    landingSpeedKnots: 140, surfaceWindDirection: 0, surfaceWindSpeed: 0,
    surfaceWindAuto:true, stableBufferMinutes:5, superStableBufferMinutes:5, defaultFeederMinutes:15, maxFinalNm:15, vectoringMode:1,
    finalLengths:Object.fromEntries(RUNWAYS.map(r=>[r,r==='ESSA/01R'?14:10])), delayPaths:[],
    manualFlights: [],
}
export interface RoutePrediction { name: string; seconds: number; latitude?:number; longitude?:number }
export interface TelemetryFlight {
    callsign: string; aircraft: string; wake: string; departure: string; arrival: string; runway: string
    route: RoutePrediction[]; landingSeconds: number; distanceNm: number; groundspeed: number; altitude: number
    star?:string;routeText?:string;verticalSpeed?:number;assignedSpeed?:number;arrivalProfile?:string
    heading?: number; assignedHeading?: number; direct?: string; routeProblem?: string
    latitude?:number; longitude?:number; threshold?:RunwayGeometry
    positionAgeSeconds?:number; calculatedRouteIndex?:number
}
export interface Telemetry { source: string; timestamp: number; flights: TelemetryFlight[]; winds?:Record<string,{direction:number;speed:number;timestamp:number}>; runways?:Record<string,RunwayGeometry> }
export interface FlightEdit {
    arrivalProfile?:string
    runway?: string; mode?: 'sequenced' | 'desequenced' | 'removed' | 'missed'
    slotBefore?: number; slotAfter?: number; order?: number; recomputeAt?: number; changedAt?: number
    closurePosition?:{id:string;side:'before'|'after'}
    target?: number
    // A deliberate swap may hold a slot; ordinary reorder has no timestamp.
    swapAt?:number
    requeueAt?:number
    landedAt?:number
}
export interface EngineFlight extends TelemetryFlight {
    closurePosition?:FlightEdit['closurePosition']
    firstSeen: number; lastSeen: number; initialEta: number; initialEtaFf?:number; eta: number; etaFf: number; sta: number; staFf: number
    feeder: string; feederId: string; ff: string; passedFeeder: boolean; state: number; mode: string
    delay: number; totalDelay: number; order: number; lost: boolean; issue: string; minimumArrival: number
    slotBefore: number; slotAfter: number; recomputedAt: number
    lastTrustedEta: number
    closureDelayMs?:number
    groundCandidateSince?:number
    missedRecovery?:boolean
    wakeDelayMs?:number
    rateDelayMs?:number
    feederDelayMs?:number
    feederDistanceNm?:number
    line0Suppressed?:boolean
    tmaTiming?:{delay:number;rateSeconds:number;instructionSource?:'manual'|'constraint'|'none'}
    separation?:{leader:string;wakeNm:number;wakeSeconds:number;rateSeconds:number;scheduledSeconds:number}
    runwayDelay?:number
    reorderTiming?:{eta:number;scheduled:number;delay:number}
    spacingConflict?: boolean
    predictionSource?: 'route' | 'vectoring' | 'delaypath' | 'star-distance' | 'vector-profile' | 'final-position' | 'unavailable'
    distanceProfile?:{id:string;procedure:string;runway:string;method:string;fullNm:number;remainingNm:number;beforeFeederNm:number;sourceRange:string;shortcut:boolean;workbookSha256:string}
    runwaySource?:'manual'|'filed'|'active'
    vectorCandidateSince?:number
    vectorDetection?:'final'|'heading'|'off-route'
    scheduledBeforeLanding?:number
    originalLandingSeconds?:number
    finalAlongNm?:number
    planKey?:string
}
export interface EngineSnapshot { timestamp: number; source: string; flights: EngineFlight[]; diagnostics: string[]; slotsKey?: string; wind?:{direction:number;speed:number;auto:boolean}; winds?:Telemetry['winds']; landings?:{callsign:string;runway:string;time:number}[] }
const ms = (seconds: number) => seconds * 1000

export function validateConfig(value: any): EngineConfig {
    if (!value || !Array.isArray(value.active) || !value.active.length || value.active.length > 8 ||
        value.active.some((r: string) => !RUNWAYS.includes(r)) || new Set(value.active).size !== value.active.length)
        throw new Error('Select at least one valid arrival runway')
    const essa=value.active.filter((r:string)=>r.startsWith('ESSA/'))
    const active=value.active.filter((r:string)=>!r.startsWith('ESSA/')||r===essa[0])
    const departureRunway=value.departureRunway??essa[1]??DEFAULT_CONFIG.departureRunway
    if(!RUNWAYS.includes(departureRunway)||!departureRunway.startsWith('ESSA/'))throw new Error('Select a valid departure runway')
    const rates: Record<string, number> = {}
    for (const r of RUNWAYS) {
        const rate = value.rates?.[r]
        if (!Number.isFinite(rate) || rate < 1 || rate > 600) throw new Error('Runway rates must be 1–600 seconds')
        rates[r] = rate
    }
    for (const key of ['stableMinutes', 'superStableMinutes', 'frozenMinutes', 'unstableSeconds', 'minimumNewSeconds'])
        if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 3600) throw new Error('Invalid state threshold')
    if (value.superStableMinutes > value.stableMinutes) throw new Error('Superstable must be inside the stable horizon')
    if (!Array.isArray(value.slots) || value.slots.length > 100) throw new Error('Invalid slots')
    const slots = value.slots.map((s: any) => {
        if (!s || typeof s.id !== 'string' || s.id.length > 60 || !RUNWAYS.includes(s.runway) ||
            !Number.isFinite(s.begin) || !Number.isFinite(s.end) || s.end <= s.begin || s.end - s.begin > 86400000)
            throw new Error('Invalid runway slot')
        return { id: s.id, runway: s.runway, begin: s.begin, end: s.end }
    })
    const landingSpeedKnots = value.landingSpeedKnots ?? 140
    const surfaceWindDirection = value.surfaceWindDirection ?? 0
    const surfaceWindSpeed = value.surfaceWindSpeed ?? 0
    if (!Number.isFinite(landingSpeedKnots) || landingSpeedKnots < 50 || landingSpeedKnots > 200 ||
        !Number.isFinite(surfaceWindDirection) || surfaceWindDirection < 0 || surfaceWindDirection > 360 ||
        !Number.isFinite(surfaceWindSpeed) || surfaceWindSpeed < 0 || surfaceWindSpeed > 100) throw new Error('Invalid wind or landing speed')
    let pending: EngineConfig['pending']
    if (value.pending) {
        if(value.pending.applyRate!==undefined&&typeof value.pending.applyRate!=='boolean')throw new Error('Invalid runway rate flag')
        if (!Number.isFinite(value.pending.at) || value.pending.at < 0) throw new Error('Invalid runway change time')
        const next = validateConfig({ ...value, pending: undefined, active: value.pending.active, rates: value.pending.rates, departureRunway:value.pending.departureRunway??departureRunway })
        pending = { at: value.pending.at, active: next.active, rates: next.rates, departureRunway:next.departureRunway,applyRate:value.pending.applyRate!==false }
    }
    let pendingRate:EngineConfig['pendingRate']
    if(value.pendingRate){
        if(!Number.isFinite(value.pendingRate.at)||value.pendingRate.at<0||!Number.isFinite(value.pendingRate.seconds)||value.pendingRate.seconds<30||value.pendingRate.seconds>600)throw new Error('Invalid rate change')
        pendingRate={at:value.pendingRate.at,seconds:value.pendingRate.seconds}
    }
    const arrivalRunway=active.find((r:string)=>r.startsWith('ESSA/'))??active[0]
    if(pending && !pendingRate && value.pending.applyRate===undefined && JSON.stringify(pending.active)===JSON.stringify(active) && pending.departureRunway===departureRunway && pending.rates[arrivalRunway]!==rates[arrivalRunway]){
        // Older clients stored a rate-only change in the runway plan slot.
        pendingRate={at:pending.at,seconds:pending.rates[arrivalRunway]}
        pending=undefined
    }
    const manualFlights=value.manualFlights || []
    if(!Array.isArray(manualFlights)||manualFlights.length>500||manualFlights.some((f:any)=>
        !f || !/^[A-Z0-9_-]{2,16}$/.test(f.callsign)||!RUNWAYS.includes(f.runway)||typeof f.aircraft!=='string'||f.aircraft.length>12||
        !['L','M','H','J','?'].includes(f.wake)||typeof f.feeder!=='string'||f.feeder.length>40||!Number.isFinite(f.eta)||f.eta<0))throw new Error('Invalid manual flight')
    const extras={predictionMode:value.predictionMode??'star',starDistanceMethod:value.starDistanceMethod??'vectors',starApproachSpeed:value.starApproachSpeed??250,starBaseSpeed:value.starBaseSpeed??180,starFinalNm:value.starFinalNm??10,starBaseNm:value.starBaseNm??20,starEntryAltitude:value.starEntryAltitude??18000,starDescentRate:value.starDescentRate??1800,starCruiseSpeed:value.starCruiseSpeed??450,starClimbRate:value.starClimbRate??1800,surfaceWindAuto:value.surfaceWindAuto!==false,stableBufferMinutes:value.stableBufferMinutes??5,superStableBufferMinutes:value.superStableBufferMinutes??5,
        defaultFeederMinutes:value.defaultFeederMinutes??15,maxFinalNm:value.maxFinalNm??15,vectoringMode:value.vectoringMode??1,finalLengths:value.finalLengths??DEFAULT_CONFIG.finalLengths!,delayPaths:value.delayPaths??[]}
    if(!['star','euroscope'].includes(extras.predictionMode)||!['vectors','ese','shortest'].includes(extras.starDistanceMethod))throw new Error('Invalid STAR model')
    for(const [key,min,max] of [['starApproachSpeed',100,350],['starBaseSpeed',80,250],['starFinalNm',1,20],['starBaseNm',2,40],['starEntryAltitude',3000,25000],['starDescentRate',500,5000],['starCruiseSpeed',250,600],['starClimbRate',500,5000]] as const)if(!Number.isFinite(extras[key])||extras[key]<min||extras[key]>max)throw new Error('Invalid STAR speed profile')
    if(extras.starBaseNm<=extras.starFinalNm)throw new Error('Base profile distance must exceed final distance')
    for(const key of ['stableBufferMinutes','superStableBufferMinutes','defaultFeederMinutes','maxFinalNm','vectoringMode'] as const)
        if(!Number.isFinite(extras[key])||extras[key]<0||extras[key]>(key==='vectoringMode'?2:600))throw new Error('Invalid prediction setting')
    if(!Number.isInteger(extras.vectoringMode)||RUNWAYS.some(r=>!Number.isFinite(extras.finalLengths[r])||extras.finalLengths[r]<1||extras.finalLengths[r]>100))throw new Error('Invalid final approach setting')
    if(!Array.isArray(extras.delayPaths)||extras.delayPaths.length>100||extras.delayPaths.some((p:any)=>!p||!['ESSA','ESSB'].includes(p.airport)||
        !Array.isArray(p.runways)||!Array.isArray(p.feeders)||!Array.isArray(p.points)||p.points.length<2||p.points.length>100||
        [...p.runways,...p.feeders,...p.points].some((v:any)=>typeof v!=='string'||v.length>40)))throw new Error('Invalid delay path')
    const displayPreferences=value.displayPreferences??{labels:{type:false,feeder:false,totalDelay:false,currentDelay:true,runway:false},panels:{winds:false,rates:false,tracks:true}}
    for(const [group,keys] of [['labels',['type','feeder','totalDelay','currentDelay','runway']],['panels',['winds','rates','tracks']]] as const)
        if(!displayPreferences[group]||Object.keys(displayPreferences[group]).some(k=>!(keys as readonly string[]).includes(k))||keys.some(k=>typeof displayPreferences[group][k]!=='boolean'))throw new Error('Invalid display preferences')
    return { ...extras, displayPreferences, active, departureRunway, rates, slots, pending, pendingRate, manualFlights, landingSpeedKnots, surfaceWindDirection, surfaceWindSpeed, stableMinutes: value.stableMinutes,
        superStableMinutes: value.superStableMinutes, frozenMinutes: value.frozenMinutes,
        unstableSeconds: value.unstableSeconds, minimumNewSeconds: value.minimumNewSeconds }
}
export function validateTelemetry(value: any, now = Date.now()): Telemetry {
    if (!value || typeof value.source !== 'string' || value.source.length > 32 || !Number.isFinite(value.timestamp) ||
        Math.abs(now - value.timestamp) > 30000 || !Array.isArray(value.flights) || value.flights.length > 1000)
        throw new Error('Missing or stale EuroScope predictions')
    const flights=value.flights.filter((p:any)=>p?.arrival!=='ESSB')
    const seen = new Set()
    for (const p of flights) {
        if (!p || !/^[A-Z0-9_-]{2,16}$/.test(p.callsign) || seen.has(p.callsign) ||
            !['ESSA', 'ESSB'].includes(p.arrival) || !Number.isFinite(p.landingSeconds) ||
            !Number.isFinite(p.distanceNm) || !Number.isFinite(p.groundspeed) || !Number.isFinite(p.altitude) ||
            !Array.isArray(p.route) || p.route.length > 1000 || p.route.some((r: any) =>
                typeof r.name !== 'string' || r.name.length > 40 || !Number.isFinite(r.seconds)))
            throw new Error('Invalid EuroScope flight prediction')
        if(p.star!==undefined&&(typeof p.star!=='string'||p.star.length>100)||p.routeText!==undefined&&(typeof p.routeText!=='string'||p.routeText.length>4096)||p.assignedSpeed!==undefined&&(!Number.isFinite(p.assignedSpeed)||p.assignedSpeed<0||p.assignedSpeed>600))throw new Error('Invalid STAR or speed data')
        seen.add(p.callsign)
        for(const key of ['latitude','longitude','heading','assignedHeading','positionAgeSeconds','calculatedRouteIndex','verticalSpeed'] as const)
            if(p[key]!==undefined&&!Number.isFinite(p[key]))throw new Error('Invalid aircraft geometry')
        if(p.latitude!==undefined&&Math.abs(p.latitude)>90||p.longitude!==undefined&&Math.abs(p.longitude)>180)throw new Error('Invalid aircraft position')
        if(p.threshold&&(!Number.isFinite(p.threshold.latitude)||Math.abs(p.threshold.latitude)>90||!Number.isFinite(p.threshold.longitude)||Math.abs(p.threshold.longitude)>180||!Number.isFinite(p.threshold.heading)))throw new Error('Invalid runway geometry')
    }
    for(const w of Object.values(value.winds||{}) as any[])if(!w||!Number.isFinite(w.direction)||w.direction<0||w.direction>360||!Number.isFinite(w.speed)||w.speed<0||w.speed>100||!Number.isFinite(w.timestamp))throw new Error('Invalid surface wind')
    for(const [key,g] of Object.entries(value.runways||{}) as [string,RunwayGeometry][])if(!RUNWAYS.includes(key)||!g||!Number.isFinite(g.latitude)||Math.abs(g.latitude)>90||!Number.isFinite(g.longitude)||Math.abs(g.longitude)>180||!Number.isFinite(g.heading))throw new Error('Invalid runway geometry')
    return {...value,flights}
}
export function validateEdits(value: any): Record<string, FlightEdit> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 1000) throw new Error('Invalid flight edits')
    const result: Record<string, FlightEdit> = {}
    for (const [callsign, raw] of Object.entries(value)) {
        const e = raw as FlightEdit
        if (!/^[A-Z0-9_-]{2,16}$/.test(callsign) || !e || typeof e !== 'object' ||
            (e.runway !== undefined && !RUNWAYS.includes(e.runway)) ||
            (e.mode !== undefined && !['sequenced', 'desequenced', 'removed', 'missed'].includes(e.mode))) throw new Error('Invalid flight edit')
        for (const key of ['slotBefore', 'slotAfter', 'order', 'recomputeAt', 'changedAt', 'target','swapAt','requeueAt','landedAt'] as const)
            if (e[key] !== undefined && (!Number.isFinite(e[key]) || e[key]! < 0)) throw new Error('Invalid flight edit')
        if ((e.slotBefore || 0) > 999 || (e.slotAfter || 0) > 999) throw new Error('Flight slot too large')
        if(e.closurePosition&&(!e.closurePosition.id||typeof e.closurePosition.id!=='string'||!['before','after'].includes(e.closurePosition.side)))throw new Error('Invalid closure position')
        if(e.arrivalProfile!==undefined&&(typeof e.arrivalProfile!=='string'||e.arrivalProfile.length>100))throw new Error('Invalid arrival profile')
        result[callsign] = { ...e }
    }
    return result
}
export function effectiveConfig(config: EngineConfig, time: number): EngineConfig {
    const current={...config,active:[...config.active],rates:{...config.rates}}
    const events=[...(config.pending?[{kind:'configuration',at:config.pending.at}]:[]),...(config.pendingRate?[{kind:'rate',at:config.pendingRate.at}]:[])].sort((a,b)=>a.at-b.at||(a.kind==='configuration'?-1:1))
    for(const event of events){
        if(event.at>time)continue
        if(event.kind==='configuration'){
            current.active=[...config.pending!.active]
            current.departureRunway=config.pending!.departureRunway??current.departureRunway
            // A runway configuration owns its selected arrival rate, not a
            // stale snapshot of all other runways' rates.
            if(config.pending!.applyRate!==false)for(const runway of current.active)current.rates[runway]=config.pending!.rates[runway]
        }else{
            const runway=current.active.find(r=>r.startsWith('ESSA/'))??current.active[0]
            current.rates[runway]=config.pendingRate!.seconds
        }
    }
    const essa=current.active.filter(r=>r.startsWith('ESSA/'))
    return {...current,active:current.active.filter(r=>!r.startsWith('ESSA/')||r===essa[0]),departureRunway:current.departureRunway??essa[1]??DEFAULT_CONFIG.departureRunway}
}
export function rateDistanceNm(seconds: number, runway: string, config: EngineConfig) {
    const heading = ({'01L':10,'01R':10.4,'08':75.9,'19L':190.4,'19R':190,'26':255.9,'12':120,'30':300} as Record<string,number>)[runway.split('/')[1]] || 0
    const headwind = config.surfaceWindDirection===0?0:config.surfaceWindSpeed * Math.cos((config.surfaceWindDirection-heading)*Math.PI/180)
    return seconds / 3600 * Math.max(50,config.landingSpeedKnots-headwind)
}
export function validateLockedEdits(snapshot: EngineSnapshot | null, previous: Record<string,FlightEdit>, next: Record<string,FlightEdit>, config?:EngineConfig) {
    for(const frozen of snapshot?.flights.filter(f=>f.state===3&&f.mode==='sequenced')||[]){
        const before=previous[frozen.callsign]||{},after=next[frozen.callsign]||{}
        if((after.mode||'sequenced')!=='sequenced')continue
        if(before.order!==after.order && after.order!==frozen.order)throw new Error(`${frozen.callsign} is Frozen; its sequence cannot be changed manually`)
        const runway=after.runway||`${frozen.arrival}/${frozen.runway}`
        for(const other of snapshot?.flights||[]){
            if(other.callsign===frozen.callsign||other.mode!=='sequenced'||other.state===4||(next[other.callsign]?.mode||'sequenced')!=='sequenced')continue
            if((next[other.callsign]?.runway||`${other.arrival}/${other.runway}`)!==runway)continue
            if((previous[other.callsign]?.order!==next[other.callsign]?.order || before.order!==after.order) &&
                (other.order<frozen.order)!==((next[other.callsign]?.order??other.order)<(after.order??frozen.order)))
                throw new Error(`${frozen.callsign} is Frozen; aircraft cannot be manually moved across it`)
        }
    }
    for (const f of snapshot?.flights || []) {
        if (f.state < 2 || f.state > 3 || f.mode !== 'sequenced') continue
        const before = previous[f.callsign] || {}, after = next[f.callsign] || {}
        if(before.target!==after.target && after.target!==undefined && !config?.slots.some(s=>s.id===after.closurePosition?.id&&s.runway===(after.runway||`${f.arrival}/${f.runway}`)) && before.order===after.order && !snapshot?.flights.some(other=>
            other.callsign!==f.callsign && other.mode==='sequenced' && (next[other.callsign]?.runway || previous[other.callsign]?.runway || `${other.arrival}/${other.runway}`)===(after.runway || before.runway || `${f.arrival}/${f.runway}`) && Math.abs(other.sta-after.target!)<1000))
            throw new Error(`${f.callsign} is locked; insert it between aircraft or use a closure gap`)
        // Explicit Recompute, runway changes and relative gaps are controller
        // actions, not plugin-initiated resequencing. The manual permits them.
    }
}
function chooseState(old: EngineFlight | undefined, ffSeconds: number, landingSeconds: number, age: number, config: EngineConfig) {
    if (old && old.state>=1 && old.state<=3) {
        if(landingSeconds<=config.frozenMinutes*60)return 3
        if(ffSeconds<=config.superStableMinutes*60)return Math.max(2,old.state)
        return old.state
    }
    if (age < config.unstableSeconds) return 0
    if (landingSeconds <= config.frozenMinutes * 60) return 3
    if (ffSeconds <= config.superStableMinutes * 60 || ((old?.state || 0)>=2 && ffSeconds <= (config.superStableMinutes + (config.superStableBufferMinutes??5)) * 60)) return 2
    if (ffSeconds <= config.stableMinutes * 60 || ((old?.state || 0) >= 1 && ffSeconds <= (config.stableMinutes + (config.stableBufferMinutes??5)) * 60)) return 1
    return 0
}
function afterSlots(time: number, runway: string, config: EngineConfig): number {
    for (const s of [...config.slots].filter(s => s.runway === runway).sort((a, b) => a.begin - b.begin))
        if (time >= s.begin && time < s.end) time = s.end
    return time
}
export function wakeDistanceNm(leader:string,follower:string) {
    return leader === 'J' ? ({ H: 6, M: 7, L: 8 }[follower] || 3) : leader === 'H' ? ({ H: 4, M: 5, L: 6 }[follower] || 3) : leader === 'M' && follower === 'L' ? 5 : 3
}
export function wakeInterval(leader: string, follower: string, runway: string, config: EngineConfig) {
    // ICAO distance planning matrix; not RECAT. Source: EUROCONTROL RECAT-EU ed.2, table 1.
    const nm = wakeDistanceNm(leader,follower)
    const heading = ({ '01L': 10, '01R': 10.4, '08': 75.9, '19L': 190.4, '19R': 190, '26': 255.9, '12': 120, '30': 300 } as Record<string, number>)[runway.split('/')[1]] || 0
    const headwind = config.surfaceWindDirection===0?0:config.surfaceWindSpeed * Math.cos((config.surfaceWindDirection - heading) * Math.PI / 180)
    return nm / Math.max(50, config.landingSpeedKnots - headwind) * 3600
}
export function windConfig(config:EngineConfig,airport:string,winds:Telemetry['winds'],now:number):EngineConfig {
    const wind=winds?.[airport]
    return config.surfaceWindAuto!==false && wind && now-wind.timestamp<3600000 && now>=wind.timestamp-30000 ?
        {...config,surfaceWindDirection:wind.direction,surfaceWindSpeed:wind.speed}:config
}
export function routeRunwayGeometry(p:TelemetryFlight):RunwayGeometry|undefined {
    if(p.arrival!=='ESSA')return undefined
    const threshold=p.route.find(r=>r.name===`SA${p.runway}`),final=p.route.find(r=>r.name===`FI${p.runway}`)
    if(!threshold||!final||![threshold.latitude,threshold.longitude,final.latitude,final.longitude].every(Number.isFinite))return undefined
    const a={latitude:final.latitude!,longitude:final.longitude!},b={latitude:threshold.latitude!,longitude:threshold.longitude!},heading=bearingBetween(a,b)
    const relative=finalPosition(a,{...b,heading}),distance=Math.hypot(relative.along,relative.cross)
    const nominal=Number(p.runway.slice(0,2))*10%360
    if(distance<1||distance>25||headingDifference(heading,nominal)>20)return undefined
    return {...b,heading}
}
export function correctedPrediction(p:TelemetryFlight,config:EngineConfig,old?:EngineFlight,timestamp=Date.now()) {
    const distance=config.predictionMode!=='euroscope'?starPrediction(p,config,old):undefined
    let seconds=distance?.seconds??p.landingSeconds, source:EngineFlight['predictionSource']=distance?(distance.error?'unavailable':'star-distance'):'route'
    const group=FEEDERS.find(g=>g.airport===p.arrival && p.route.some(r=>g.fixes.some(f=>f===r.name)))
    for(const path of distance?[]:config.delayPaths||[]) {
        if(path.airport!==p.arrival||!path.runways.some(r=>r==='*'||r===p.runway)||!path.feeders.some(f=>f==='*'||f===group?.name))continue
        const start=p.route.findIndex((r,i)=>r.name===path.points[0]&&path.points.every((name,j)=>p.route[i+j]?.name===name))
        if(start<0)continue
        const end=start+path.points.length-1
        const calculated=p.calculatedRouteIndex??-1
        const next=calculated>=start?calculated+1:start
        if(next>=end)continue
        const a=p.route[next],b=p.route[end]
        // A shortcut replaces the remaining arc between its endpoints. Their
        // coordinates are required: removing all elapsed time would teleport.
        if([a.latitude,a.longitude,b.latitude,b.longitude].every(v=>Number.isFinite(v))) {
            const pos=finalPosition({latitude:a.latitude!,longitude:a.longitude!},{latitude:b.latitude!,longitude:b.longitude!,heading:0})
            const direct=Math.hypot(pos.along,pos.cross)/Math.max(100,p.groundspeed)*3600
            seconds-=Math.max(0,b.seconds-a.seconds-direct);source='delaypath'
        }
    }
    const passed=distance?.passedFeeder??(old?.passedFeeder||!!group&&!p.route.some(r=>group.fixes.some(f=>f===r.name)&&r.seconds>=0))
    const mode=config.vectoringMode??1,threshold=p.threshold??routeRunwayGeometry(p)??(distance?STAR_RUNWAYS[p.runway]:undefined)
    const eligible=(old?.state||0)>=2 || (distance?.feederSeconds!==undefined?distance.feederSeconds<=config.superStableMinutes*60:p.route.some(r=>group?.fixes.some(f=>f===r.name)&&r.seconds<=config.superStableMinutes*60))
    let vectorDetection:EngineFlight['vectorDetection'],vectorCandidateSince:number|undefined
    const fresh=(p.positionAgeSeconds??0)<=15
    if(mode>0&&eligible&&(mode===2||passed)&&fresh&&threshold&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Number.isFinite(p.heading)&&p.groundspeed>=60){
        const point=p as GeoPoint,final=finalPosition(point,threshold)
        const onFinal=final.along>=0&&final.along<=(config.maxFinalNm??15)&&Math.abs(final.cross)<=.35&&headingDifference(p.heading!,threshold.heading)<=15
        const explicit=(p.assignedHeading??0)>0&&(p.assignedHeading??0)<=360
        const index=p.calculatedRouteIndex??-1,a=p.route[index],b=p.route[index+1]
        let offRoute=false
        if(a&&b&&[a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite)){
            const heading=bearingBetween(a as GeoPoint,b as GeoPoint),relative=finalPosition(point,{latitude:b.latitude!,longitude:b.longitude!,heading})
            offRoute=Math.abs(relative.cross)>2.5||(Math.abs(relative.cross)>1&&headingDifference(p.heading!,heading)>40)
        }
        const direct=p.direct&&p.route.find(r=>r.name===p.direct&&Number.isFinite(r.latitude)&&Number.isFinite(r.longitude))
        if(direct&&headingDifference(p.heading!,bearingBetween(point,direct as GeoPoint))<=25)offRoute=false
        vectorCandidateSince=offRoute?old?.vectorCandidateSince??timestamp:undefined
        if(onFinal)vectorDetection='final'
        else if(explicit)vectorDetection='heading'
        else if(offRoute&&timestamp-vectorCandidateSince!>=6000)vectorDetection='off-route'
        if(vectorDetection){
            const headwind=config.surfaceWindDirection===0?0:config.surfaceWindSpeed*Math.cos((config.surfaceWindDirection-threshold.heading)*Math.PI/180)
            seconds=vectoringSeconds(point,p.heading!,threshold,config.finalLengths?.[`${p.arrival}/${p.runway}`]??10,p.groundspeed,vectorDetection==='final'?p.groundspeed:config.landingSpeedKnots-headwind)
            if(distance){
                const path=vectoringDistance(point,p.heading!,threshold,config.finalLengths?.[`${p.arrival}/${p.runway}`]??10,p.groundspeed)
                if(vectorDetection==='final'){
                    const end=Math.min(p.groundspeed,Math.max(50,config.landingSpeedKnots-headwind));let elapsed=0
                    for(let remaining=path.finalNm;remaining>1e-7;){const step=Math.min(1,remaining),fraction=(remaining-step/2)/Math.max(.01,path.finalNm);elapsed+=step/Math.max(50,end+(p.groundspeed-end)*fraction)*3600;remaining-=step}seconds=elapsed;source='final-position'
                }else{seconds=starTravelSeconds(path.turnNm+path.finalNm,p.altitude,threshold.heading,config,p.assignedSpeed,p.wake);source='vector-profile'}
                if(distance.distanceProfile)distance.distanceProfile.remainingNm=path.turnNm+path.finalNm
            }else source='vectoring'
        }
    }
    return {seconds:Math.max(0,seconds),source,vectorDetection,vectorCandidateSince,distanceProfile:distance?.distanceProfile,feederSeconds:distance?.feederSeconds,feeder:distance?.feeder,passedFeeder:distance?.passedFeeder,error:source==='unavailable'?distance?.error:undefined}

}
export function reorderEdits(snapshot:EngineSnapshot,edits:Record<string,FlightEdit>,callsign:string,displayTime:number,view='Runway',config?:EngineConfig,closurePosition?:FlightEdit['closurePosition']) {
    const flight=snapshot.flights.find(f=>f.callsign===callsign)
    if(flight?.state===3)throw new Error(`${callsign} is Frozen; its sequence cannot be changed manually`)
    if(!flight||flight.lost||flight.issue||flight.mode!=='sequenced')throw new Error('Only available aircraft can be reordered')
    const runway=edits[callsign]?.runway||`${flight.arrival}/${flight.runway}`
    const original=snapshot.flights.filter(f=>!f.lost&&!f.issue&&f.mode==='sequenced'&&f.state!==4&&
        (edits[f.callsign]?.runway||`${f.arrival}/${f.runway}`)===runway).sort((a,b)=>a.order-b.order)
    const queue=original.filter(f=>f.callsign!==callsign)
    // The original confirms a move before the first strictly later slot.
    // Equality must cross the neighbouring slot instead of undoing the drag.
    const position=queue.findIndex(f=>(view==='ACC'?f.staFf:f.sta)>displayTime)
    queue.splice(position<0?queue.length:position,0,flight)
    const changes:Record<string,FlightEdit>=JSON.parse(JSON.stringify(edits))
    // Move aircraft between committed runway slots. The pointer selects an
    // insertion position, not a new arrival time or a fresh ETA-based queue.
    queue.forEach((f,i)=>{
        if(f.callsign===original[i]?.callsign)return
        const slot=original[i]
        const target=slot?.sta ?? Math.max(snapshot.timestamp,original.at(-1)?.sta??displayTime)+115000
        changes[f.callsign]={...changes[f.callsign],order:slot?.order??(original.at(-1)?.order??-1)+1,target,swapAt:undefined,changedAt:snapshot.timestamp,
            ...(f.callsign===callsign&&flight.state===4?{requeueAt:snapshot.timestamp,recomputeAt:snapshot.timestamp,landedAt:undefined}: {})}
    })
    // Preserve ordinary slot insertion; only a deliberate closure-side drop
    // changes which side of the blocked interval this flight occupies.
    changes[callsign]={...changes[callsign],closurePosition}
    if(closurePosition&&config?.slots.some(s=>s.id===closurePosition.id&&s.runway===runway)){
        changes[callsign]={...changes[callsign],order:queue.findIndex(f=>f.callsign===callsign),changedAt:snapshot.timestamp}
    }
    validateLockedEdits(snapshot,edits,changes,config)
    return changes
}
// One-way dependency: raw route ETA -> runway schedule -> feeder schedule -> delay.
function sequenceCandidates(flights:EngineFlight[]){
    const lanes=new Map<string,EngineFlight[]>()
    for(const flight of flights){
        const key=flight.distanceProfile&&!flight.passedFeeder?`feeder:${flight.ff}`:`flight:${flight.callsign}`
        const lane=lanes.get(key)||[];lane.push(flight);lanes.set(key,lane)
    }
    for(const lane of lanes.values())lane.sort((a,b)=>a.etaFf-b.etaFf||a.eta-b.eta||a.callsign.localeCompare(b.callsign))
    const result:EngineFlight[]=[]
    while(lanes.size){
        const head=[...lanes.entries()].sort((a,b)=>a[1][0].eta-b[1][0].eta||a[1][0].callsign.localeCompare(b[1][0].callsign))[0]
        result.push(head[1].shift()!);if(!head[1].length)lanes.delete(head[0])
    }
    return result
}
export function retimeEdits(snapshot:EngineSnapshot,edits:Record<string,FlightEdit>,callsign:string,displayTime:number,view='Runway',config?:EngineConfig){
    const flight=snapshot.flights.find(f=>f.callsign===callsign)
    if(!flight||flight.state!==1)throw new Error('Only Stable aircraft can receive a manual time by dragging')
    const target=view==='ACC'?flight.sta+(displayTime-flight.staFf):displayTime
    if(!Number.isFinite(target)||target<=snapshot.timestamp)throw new Error('Choose a future time')
    const changes=reorderEdits(snapshot,edits,callsign,displayTime,view,config)
    // Changing a Stable time does not exchange the other flights' time slots.
    for(const peer of snapshot.flights){
        if(peer.callsign!==callsign&&changes[peer.callsign]?.changedAt===snapshot.timestamp&&changes[peer.callsign]?.order!==edits[peer.callsign]?.order)
            changes[peer.callsign].target=edits[peer.callsign]?.target??peer.sta
    }
    changes[callsign]={...changes[callsign],order:changes[callsign]?.order??flight.order,target,changedAt:snapshot.timestamp,closurePosition:undefined,swapAt:undefined}
    validateLockedEdits(snapshot,edits,changes,config)
    return changes
}
// Scheduled times and old delays are NEVER fed back into the input ETA.
export function runEngine(input: Telemetry, config: EngineConfig, edits: Record<string, FlightEdit>, previous?: EngineSnapshot): EngineSnapshot {
    if (previous && input.timestamp <= previous.timestamp) return previous
    const now = input.timestamp
    const currentConfig = effectiveConfig(config, now)
    const slotsKey = JSON.stringify(config.slots)
    const closuresChanged = !!previous && previous.slotsKey !== slotsKey
    const oldByCallsign = new Map(previous?.flights.map(f => [f.callsign, f]) || [])
    const winds=input.winds??previous?.winds
    const traffic=input.flights.filter(f=>f.arrival==='ESSA')
    const present = new Set(traffic.map(f => f.callsign))
    const manual=(config.manualFlights || []).filter(f=>f.runway.startsWith('ESSA/')&&!present.has(f.callsign))
    const manualCalls=new Set(manual.map(f=>f.callsign))
    const predictions:TelemetryFlight[]=[...traffic,...manual.map(f=>({callsign:f.callsign,aircraft:f.aircraft,wake:f.wake,departure:'----',arrival:f.runway.split('/')[0],runway:f.runway.split('/')[1],
        route:f.feeder==='OTHER'?[]:[{name:f.feeder,seconds:(f.eta-now)/1000-(config.defaultFeederMinutes??15)*60}],landingSeconds:(f.eta-now)/1000,distanceNm:100,groundspeed:140,altitude:10000}))]
    manual.forEach(f=>present.add(f.callsign))
    const flights: EngineFlight[] = []
    const diagnostics: string[] = []
    for (const p of predictions) {
        const old = oldByCallsign.get(p.callsign)
        const e = edits[p.callsign] || {}
        const modelRebase=config.predictionMode!=='euroscope'&&old&&old.state<=1&&e.target===undefined&&!['star-distance','vector-profile','final-position'].includes(old.predictionSource??'')&&input.source!=='DEMO'&&!manualCalls.has(p.callsign)
        const recompute = !!modelRebase || (e.recomputeAt || 0) > (old?.recomputedAt || 0)
        const resumed=!!old && old.mode!=='sequenced' && (e.mode||'sequenced')==='sequenced'
        const firstSeen = old?.firstSeen ?? now
        const runway = e.runway || (p.runway?`${p.arrival}/${p.runway}`:currentConfig.active.find(r=>r.startsWith('ESSA/'))||`${p.arrival}/`)
        const predictionConfig=windConfig({...currentConfig,predictionMode:input.source==='DEMO'||manualCalls.has(p.callsign)?'euroscope':currentConfig.predictionMode??'star'},p.arrival,winds,now)
        const threshold=input.runways?.[runway]??(runway===`${p.arrival}/${p.runway}`?p.threshold:undefined)??routeRunwayGeometry({...p,runway:runway.split('/')[1]})??(predictionConfig.predictionMode==='star'?STAR_RUNWAYS[runway.split('/')[1]]:undefined)
        const requeued=!!e.requeueAt && ((old?.state!==4?old?.sta:undefined)??e.target??0)>now && (e.recomputeAt||0)<=e.requeueAt
        const prediction=correctedPrediction({...p,arrivalProfile:e.arrivalProfile??p.arrivalProfile,runway:runway.split('/')[1],threshold},predictionConfig,old,now)
        const eta = now + ms(prediction.seconds)
        const resumedMissed=resumed&&old?.mode==='missed'
        const freshNewApproach=prediction.seconds>(config.frozenMinutes*60+60)&&p.groundspeed>=60&&p.altitude>=350&&(p.positionAgeSeconds??0)<=15
        const missedRecovery=!!resumedMissed||!!old?.missedRecovery&&!freshNewApproach
        const group = prediction.feeder?FEEDERS.find(g=>g.airport===p.arrival&&g.name===prediction.feeder):(!recompute && !resumed && old?.passedFeeder ? FEEDERS.find(g=>g.airport===p.arrival&&g.id===old.feederId) : undefined) ?? FEEDERS.find(g => g.airport === p.arrival && p.route.some(r => g.fixes.some(f => f === r.name)))
        const feederPoint = prediction.feederSeconds!==undefined?(prediction.passedFeeder?undefined:{name:prediction.feeder!,seconds:prediction.feederSeconds}):group && p.route.find(r => group.fixes.some(f => f === r.name) && r.seconds >= 0)
        const passed = prediction.passedFeeder??((!recompute && !requeued && !resumed && old?.passedFeeder) || !!group && !feederPoint)
        const ffSeconds = prediction.feederSeconds??feederPoint?.seconds ?? (passed ? -1 : prediction.seconds - (config.defaultFeederMinutes??15)*60)
        const etaFf = passed && old ? old.etaFf : now + ms(ffSeconds)
        const protectedTma=!!old && passed && !recompute && !requeued && old.mode==='sequenced'
        const independent=predictionConfig.predictionMode==='star'
        let issue = prediction.error || (independent||protectedTma||prediction.source==='vectoring'?'':p.routeProblem||'')
        if (!RUNWAYS.includes(runway)) issue = 'No valid assigned arrival runway'
        else if (!effectiveConfig(config, e.target ?? eta).active.includes(runway)) issue = 'Assigned runway is not active at its planned arrival time'
        else if (!independent && ((!missedRecovery && !requeued && !protectedTma && p.landingSeconds < 0) || (!protectedTma && p.landingSeconds > 14400))) issue = 'Invalid destination route prediction'
        else if (!independent && !missedRecovery && !requeued && !protectedTma && feederPoint && feederPoint.seconds > p.landingSeconds) issue = 'Feeder prediction is after destination'
        else if (old && !missedRecovery && !recompute && !protectedTma && prediction.source==='route' && eta - (old.lastTrustedEta ?? old.eta) > 600000) issue = 'Route ETA jumped by more than 10 minutes; review route and Recompute'
        const groundCandidate=p.distanceNm>=0 && p.distanceNm<1 && p.groundspeed>=0 && p.groundspeed<60 && p.altitude>=-100 && p.altitude<(p.arrival==='ESSA'?350:250) && (p.positionAgeSeconds??0)<=15
        const groundCandidateSince=groundCandidate ? old?.groundCandidateSince??now : undefined
        const physicalLanded=groundCandidate && (now-groundCandidateSince!>=5000 || (!old && p.groundspeed<5))
        const landed=!requeued && (e.mode||'sequenced')!=='missed' && (!!e.landedAt || (!missedRecovery&&physicalLanded) || (old?.state===4 && !recompute && !resumed))
        if (landed) issue = ''
        const state = issue ? 0 : landed ? 4 : missedRecovery ? 2 : (requeued || manualCalls.has(p.callsign)) ? 1 : chooseState(recompute&&old?.state!==3?undefined:old, ffSeconds, prediction.seconds, (now - firstSeen) / 1000, config)
        const final=threshold&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)?finalPosition(p as GeoPoint,threshold):undefined
        const onFinal=!!final && final.along>=0 && final.along<=(config.maxFinalNm??15) && Math.abs(final.cross)<=.4 &&
            Number.isFinite(p.heading)&&headingDifference(p.heading!,threshold!.heading)<=20
        // A bootstrap list is not a stream of newly inserted aircraft. Do not
        // invent ten minutes of delay for final traffic when MASTER starts.
        const established=previous?.flights.some(f=>present.has(f.callsign)&&f.mode==='sequenced'&&!f.lost&&f.state!==4&&
            (edits[f.callsign]?.runway||`${f.arrival}/${f.runway}`)===runway)
        const minimumArrival = resumed && old?.mode==='missed' ? now+ms(config.minimumNewSeconds) :
            recompute ? now : old?.minimumArrival ?? now + ms(established&&!onFinal?config.minimumNewSeconds:0)
        const landingStamp=old?.state===4?old.sta:e.landedAt??(physicalLanded?previous?.landings?.filter(l=>l.callsign===p.callsign).at(-1)?.time:undefined)??now
        flights.push({ ...p, runway:runway.split('/')[1],runwaySource:e.runway?'manual':p.runway?'filed':'active',firstSeen, lastSeen: now, initialEta: recompute ? eta : old?.initialEta ?? eta, initialEtaFf:recompute?etaFf:old?.initialEtaFf??etaFf, eta, etaFf,
            sta: landed ? landingStamp : eta, staFf: landed ? old?.staFf ?? etaFf : etaFf, feeder: group?.name || 'OTHER', feederId: group?.id || '-', ff: feederPoint?.name || (group?.airport==='ESSA'?group.fixes[0]:old?.ff) || p.route.find(r=>group?.fixes.some(f=>f===r.name))?.name || '-',
            passedFeeder: passed, groundCandidateSince, missedRecovery, state, mode: e.mode || 'sequenced', delay: 0, totalDelay: 0,
            order: recompute && !modelRebase && !resumed && old?.state===3 ? old.order : (recompute&&!modelRebase) || resumed ? (requeued ? e.order ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER) : e.order ?? old?.order ?? Number.MAX_SAFE_INTEGER,
            lost: state!==4 && (p.positionAgeSeconds??0)>15, issue, minimumArrival, slotBefore: e.slotBefore || 0, slotAfter: e.slotAfter || 0,
            recomputedAt: e.recomputeAt || old?.recomputedAt || 0, lastTrustedEta: issue ? old?.lastTrustedEta ?? old?.eta ?? eta : eta,
            distanceProfile:prediction.distanceProfile,scheduledBeforeLanding:landed?old?.scheduledBeforeLanding??(old?.state!==4?old?.sta:undefined):undefined,vectorDetection:prediction.vectorDetection,vectorCandidateSince:prediction.vectorCandidateSince,predictionSource:prediction.source,originalLandingSeconds:p.landingSeconds,finalAlongNm:onFinal?final?.along:undefined })
        const emitted=flights.at(-1)!,fix=STAR_FEEDERS[emitted.ff]
        if(fix&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&(p.positionAgeSeconds??0)<=15)
            emitted.feederDistanceNm=distanceNm(p as GeoPoint,fix)
        emitted.line0Suppressed=landed || !!passed && ((emitted.feederDistanceNm??0)>=12 || !!old?.line0Suppressed&&old.ff===emitted.ff&&!resumed&&!requeued)
        if (issue) diagnostics.push(`${p.callsign}: ${issue}`)
    }
    // Confirmed landings remain as pink history for five minutes, even when
    // EuroScope removes their track. Missing airborne aircraft still disappear.
    for(const old of previous?.flights||[]){
        const edit=edits[old.callsign]||{}
        if(old.arrival==='ESSA'&&!present.has(old.callsign)&&old.state===4&&now-old.sta<300000&&old.mode==='sequenced'&&
            (!edit.mode||edit.mode==='sequenced')&&(edit.recomputeAt||0)<=old.recomputedAt&&!(edit.requeueAt&&edit.requeueAt>=old.sta))
            flights.push({...old,lost:false,issue:''})
    }
    // Each telemetry packet is the complete current inventory. Aircraft absent
    // from it are removed immediately rather than retained as grey history.
    for (const runway of [...new Set([...currentConfig.active,...(config.pending?.active || [])])]) {
        const queue = flights.filter(f => !f.lost && !f.issue && f.mode === 'sequenced' && f.state !== 4 &&
            (edits[f.callsign]?.runway || `${f.arrival}/${f.runway}`) === runway)
        const fixed = queue.filter(f => (f.state >= 1 || edits[f.callsign]?.order!==undefined) && f.order !== Number.MAX_SAFE_INTEGER).sort((a, b) => a.order - b.order)
        const moving = sequenceCandidates(queue.filter(f => !fixed.includes(f)))
        for (const f of moving) {
            // Ordinary newly captured flights cannot displace an established superstable/frozen group.
            let index = fixed.findIndex(p => p.eta > f.eta)
            if (index < 0) index = fixed.length
            if(f.distanceProfile&&!f.passedFeeder){
                const preceding=fixed.reduce((boundary,p,i)=>p.ff===f.ff&&!p.passedFeeder&&p.etaFf<=f.etaFf?i+1:boundary,0)
                index=Math.max(index,preceding)
            }
            const old=oldByCallsign.get(f.callsign)
            const explicit=old?.mode==='sequenced' && (edits[f.callsign]?.recomputeAt||0)>(old?.recomputedAt||0)
            const missed=old?.mode==='missed'
            if(old?.state===0 && !explicit && old.mode==='sequenced'){
                // A known unstable prediction may move among unstable peers,
                // but cannot reshuffle an already committed Stable sequence.
                const preceding=fixed.reduce((boundary,p,i)=>p.state>=1&&(oldByCallsign.get(p.callsign)?.order??Infinity)<old.order?i+1:boundary,0)
                const following=fixed.findIndex(p=>p.state>=1&&(oldByCallsign.get(p.callsign)?.order??-1)>old.order)
                index=Math.max(preceding,Math.min(index,following<0?fixed.length:following))
            }
            const protectedEnd = fixed.reduce((last, p, i) => p.state >= (missed?3:2) ? i + 1 : last, 0)
            if ((!old||old.state===0||old.mode!=='sequenced')&&!explicit) index = Math.max(index, protectedEnd)
            fixed.splice(index, 0, f)
        }
        // Super Stable and Frozen order stays committed until a permitted
        // controller action; final-position updates never reshuffle the queue.
        let last: EngineFlight | undefined
        const feederLeaders=new Map<string,EngineFlight>()
        for (let i = 0; i < fixed.length; i++) {
            const f = fixed[i]
            const old = oldByCallsign.get(f.callsign)
            const recomputed=!!old && (edits[f.callsign]?.recomputeAt || 0)>old.recomputedAt
            const arrivalConfig = windConfig(effectiveConfig(config, edits[f.callsign]?.target ?? old?.sta ?? f.eta),f.arrival,winds,now)
            const planKey=JSON.stringify([runway,arrivalConfig.rates[runway],config.slots,f.slotBefore,f.slotAfter])
            const planChanged=!!old && old.planKey!==planKey
            const preserveTarget = f.state >= 1 && old && old.sta > now &&
                (edits[f.callsign]?.recomputeAt || 0) <= old.recomputedAt && old.order === f.order && !planChanged
            const reference = edits[f.callsign]?.target ?? (preserveTarget ? Math.min(f.eta, old.sta) : f.eta)
            const closurePosition=edits[f.callsign]?.closurePosition
            const selectedClosure=config.slots.find(s=>s.id===closurePosition?.id&&s.runway===runway)
            const closureMoved=!!old&&JSON.stringify(edits[f.callsign]?.closurePosition)!==JSON.stringify(old.closurePosition)
            const explicitlyReordered=!!old && ((edits[f.callsign]?.order!==undefined&&edits[f.callsign]?.order!==old.order)||(closureMoved&&(edits[f.callsign]?.changedAt||0)>previous!.timestamp-1))
            const finalReordered=!!old && f.state===3 && old.order!==i && f.finalAlongNm!==undefined
            const predecessorChanged=!!old && previous?.flights.find(p=>p.mode==='sequenced'&&p.order===old.order-1&&(edits[p.callsign]?.runway||`${p.arrival}/${p.runway}`)===runway)?.callsign!==last?.callsign
            const oldPlan=old?.planKey?JSON.parse(old.planKey):undefined
            const nonClosurePlanChanged=!!oldPlan && (oldPlan[0]!==runway || oldPlan[1]!==arrivalConfig.rates[runway] || oldPlan[3]!==f.slotBefore || oldPlan[4]!==f.slotAfter)
            const protectedBase=old && old.state>=1 && f.state>=1 && !recomputed && (!nonClosurePlanChanged || f.passedFeeder)
            const tmaProtected=(f.passedFeeder||f.state>=2) && !!old && !recomputed && old.mode==='sequenced'
            const acceptedRate=f.passedFeeder && tmaProtected && !explicitlyReordered ? old.tmaTiming?.rateSeconds??oldPlan?.[1]??arrivalConfig.rates[runway] : arrivalConfig.rates[runway]
            const gap=ms(Math.max(acceptedRate,last?wakeInterval(last.wake,f.wake,runway,arrivalConfig):0))+ms(((last?.slotAfter||0)+f.slotBefore)*60)
            const beforeClosure=old ? old.sta-(old.closureDelayMs||0)-(tmaProtected ? (old.wakeDelayMs||0)+(old.rateDelayMs||0) : 0) : f.eta
            let anchor=tmaProtected && !explicitlyReordered ? beforeClosure : edits[f.callsign]?.target ?? (protectedBase?beforeClosure:reference)
            if((explicitlyReordered||finalReordered||(predecessorChanged&&f.state===0))&&edits[f.callsign]?.target===undefined)anchor=f.eta
            if(['star-distance','vector-profile','final-position'].includes(f.predictionSource??'')&&f.state===1&&edits[f.callsign]?.target===undefined)anchor=f.eta
            if(selectedClosure&&closurePosition?.side==='before')anchor=Math.min(anchor,selectedClosure.begin-1)
            const rateGap=ms(acceptedRate)+ms(((last?.slotAfter||0)+f.slotBefore)*60)
            const transfer = Math.max(0, f.eta - f.etaFf)
            const feederLeader=f.distanceProfile&&!f.passedFeeder?feederLeaders.get(f.ff):undefined
            const feederMinimum=feederLeader?feederLeader.staFf+rateGap+transfer:-Infinity
            const unconstrainedBase=Math.max(anchor,f.minimumArrival,last?last.sta-(last.closureDelayMs||0)-(tmaProtected?last.wakeDelayMs||0:0)+(tmaProtected?rateGap:gap):-Infinity)
            const baseSta=Math.max(unconstrainedBase,feederMinimum)
            f.feederDelayMs=Math.max(0,feederMinimum-unconstrainedBase)
            const wakeSta=Math.max(baseSta,last?last.sta-(last.closureDelayMs||0)+gap:-Infinity)
            f.wakeDelayMs=tmaProtected?wakeSta-baseSta:0
            f.rateDelayMs=tmaProtected?Math.max(0,baseSta-Math.max(anchor,f.minimumArrival)):0
            f.sta=afterSlots(Math.max(wakeSta,last?last.sta+gap:-Infinity,selectedClosure&&closurePosition?.side==='after'?selectedClosure.end:-Infinity),runway,config)
            f.closurePosition=selectedClosure?closurePosition:undefined
            f.closureDelayMs=f.sta-wakeSta
            f.spacingConflict=!!last && f.sta<last.sta+gap-1
            f.staFf = f.passedFeeder ? old?.staFf ?? f.etaFf : f.distanceProfile ? f.sta-transfer : old && old.state>=1 && f.state>=1 && !recomputed && !nonClosurePlanChanged ? old.staFf+(f.sta-old.sta) : f.sta - transfer
            if(f.distanceProfile&&!f.passedFeeder)feederLeaders.set(f.ff,f)
            f.runwayDelay = Math.round((f.sta - f.eta) / 1000)
            // A controller's protected sequence change carries existing work
            // into the new slot. Only subsequent prediction/spacing changes
            // become additional gain/loss, rather than the slot exchange itself.
            f.reorderTiming = !recomputed && old?.runway===f.runway ? old.reorderTiming : undefined
            if(f.state>=2 && old && explicitlyReordered && edits[f.callsign]?.target!==undefined)
                f.reorderTiming={eta:f.eta,scheduled:edits[f.callsign].target!,delay:old.delay}
            f.delay = f.reorderTiming ? Math.round(f.reorderTiming.delay + (f.sta-f.reorderTiming.scheduled-f.eta+f.reorderTiming.eta)/1000) : f.runwayDelay
            // Once the feeder has been crossed, route/vector ETA updates are
            // observation only. Preserve the accepted instruction through a
            // sequence edit; publish only closure and extra wake constraints.
            if(tmaProtected){
                const priorBase=old.delay-Math.round(((old.closureDelayMs||0)+(old.wakeDelayMs||0)+(old.rateDelayMs||0))/1000)
                const manual=edits[f.callsign]?.target!==undefined
                const binding=old.minimumArrival>old.eta||!!old.feederDelayMs||!!old.separation&&old.separation.scheduledSeconds<=Math.max(old.separation.rateSeconds,old.separation.wakeSeconds)+1
                const source=old.tmaTiming?.instructionSource??(manual?'manual':priorBase>0&&binding?'constraint':'none')
                let baseline=old.tmaTiming?.instructionSource?old.tmaTiming.delay:manual?priorBase:priorBase>0&&binding?priorBase:0
                // An earlier TMA slot can satisfy an existing lose instruction.
                // Moving later within committed slots does not invent new work;
                // actual closure/wake/rate constraints are calculated separately.
                if(f.passedFeeder&&explicitlyReordered&&edits[f.callsign]?.target!==undefined&&!selectedClosure&&baseline>0)
                    baseline=Math.max(0,baseline+Math.min(0,Math.round((edits[f.callsign].target!-beforeClosure)/1000)))
                f.tmaTiming={delay:baseline,rateSeconds:acceptedRate,instructionSource:baseline===0?'none':source}
                f.delay=f.tmaTiming.delay+Math.round(((f.closureDelayMs||0)+(f.wakeDelayMs||0)+(f.rateDelayMs||0))/1000)
            }
            // EuroScope route EET is minute-resolution. A sub-minute first-slot
            // difference without a constraint is uncertainty, not a holding instruction.
            if(!tmaProtected && !last && !f.closureDelayMs && pMinuteResolution(f) && Math.abs(f.delay)<60 && edits[f.callsign]?.target===undefined &&
                f.minimumArrival<=f.eta && !f.slotBefore && !config.slots.some(s=>s.runway===runway&&s.end>f.eta&&s.begin<=f.sta)) f.delay=0
            // A held Stable estimate is not a controller-issued lose
            // instruction when no current constraint requires the difference.
            if(!tmaProtected&&f.state>=1&&f.delay>0&&edits[f.callsign]?.target===undefined&&!f.closureDelayMs&&!f.feederDelayMs&&!f.slotBefore&&
                f.minimumArrival<=f.eta&&(!last||last.sta+gap<=f.eta))f.delay=0
            if(f.missedRecovery)f.delay=Math.round(((f.closureDelayMs||0)+(f.wakeDelayMs||0)+(f.rateDelayMs||0))/1000)
            f.separation=last?{leader:last.callsign,wakeNm:wakeDistanceNm(last.wake,f.wake),wakeSeconds:wakeInterval(last.wake,f.wake,runway,arrivalConfig),rateSeconds:acceptedRate,scheduledSeconds:(f.sta-last.sta)/1000}:undefined
            f.totalDelay = Math.round((f.sta - f.initialEta) / 1000)
            f.order = i
            f.planKey=planKey
            last = f
        }
    }
    const landings=(previous?.landings||[]).filter(l=>l.runway.startsWith('ESSA/')&&now-l.time<=1800000)
    for(const f of flights)if(f.state===4&&oldByCallsign.get(f.callsign)?.state!==4 && !landings.some(l=>l.callsign===f.callsign&&(now-l.time<600000||l.time===Math.min(now,f.sta))))
        landings.push({callsign:f.callsign,runway:edits[f.callsign]?.runway||`${f.arrival}/${f.runway}`,time:Math.min(now,f.sta)})
    const wind=windConfig(currentConfig,'ESSA',winds,now)
    return { timestamp: now, source: input.source, flights:flights.filter(f=>f.state!==4||now-f.sta<300000), diagnostics, slotsKey, winds,
        wind:{direction:wind.surfaceWindDirection,speed:wind.surfaceWindSpeed,auto:config.surfaceWindAuto!==false},landings }
}

function pMinuteResolution(f:EngineFlight){return f.predictionSource==='route' && f.landingSeconds%60===0 && f.route.every(r=>r.seconds%60===0)}
export function euroscopeInstruction(f:EngineFlight){return f.line0Suppressed||f.state===4?0:f.delay}
export function delayLabel(seconds: number) {
    const minutes=Math.round(Math.abs(seconds)/60)
    return minutes===0?'':`${seconds<0?'-':''}${minutes}`
}
export function toJuhaSequence(snapshot: EngineSnapshot, config: EngineConfig, edits: Record<string, FlightEdit>) {
    config = windConfig(effectiveConfig(config,snapshot.timestamp),'ESSA',snapshot.winds,snapshot.timestamp)
    const sec = (time: number) => Math.round(time / 1000)
    return {
        data: { icao: 'ESSA', source: snapshot.source, timestamp: sec(snapshot.timestamp) },
        wind: { '10k_deg': -1, '10k_kts': -1, sfc_deg: config.surfaceWindDirection, sfc_kts: config.surfaceWindSpeed, sfc_auto: config.surfaceWindAuto!==false },
        airports: ['ESSA'].map(icao => ({ icao, color: '13158600' })),
        runways: RUNWAYS.filter(r=>r.startsWith('ESSA/')).map(r => ({ icao: r.split('/')[0], id: r.split('/')[1], active: config.active.includes(r),
            rate: config.rates[r], color: 13158600, slots: config.slots.filter(s => s.runway === r).map(s => ({ begin: sec(s.begin), end: sec(s.end) })) })),
        feeders: FEEDERS.filter(f=>f.airport==='ESSA').map(f => ({ icao: f.airport, name: f.name, id: f.id, fixes: [...f.fixes], color: 13158600 })),
        sequence: snapshot.flights.filter(f => f.arrival==='ESSA' && f.mode === 'sequenced' && !f.issue && !f.lost).map(f => ({
            callsign: f.callsign, atyp: f.aircraft, wtc: f.wake, adep: f.departure, ades: f.arrival,
            initial_eta: sec(f.initialEta), rwy: (edits[f.callsign]?.runway || `${f.arrival}/${f.runway}`).split('/')[1],
            rwy_seq: f.order, feeder_group: f.feeder, ff: f.ff, sta_ff: sec(f.staFf), ttlttg_ff: euroscopeInstruction(f),
            eet_ff: (f.etaFf - snapshot.timestamp) / 60000, eet_rwy: (f.sta - snapshot.timestamp) / 1000,
            eet_ff_to_rwy: Math.max(0, (f.eta - f.etaFf) / 1000), eet_ades: (f.eta - snapshot.timestamp) / 1000,
            state: f.state, delay_total: f.totalDelay, lost: f.lost, slot_before: f.slotBefore, slot_after: f.slotAfter,
        })),
    }
}
