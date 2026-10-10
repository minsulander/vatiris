<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import axios from 'axios'
import {sharedSettings} from '@/maestro-settings'

import {STAR_PROFILES,STAR_SOURCE} from '@/maestro-star-prediction'
import {scrollingLabelPositions} from '@/maestro-label-layout'
import { useAuthStore, backendBaseUrl } from '@/stores/auth'
import { DEFAULT_CONFIG, RUNWAYS, STATE_NAMES, STATE_COLORS, delayLabel, runEngine, toJuhaSequence, effectiveConfig, rateDistanceNm, validateLockedEdits, windConfig, reorderEdits, retimeEdits, euroscopeInstruction,
    type EngineConfig, type EngineSnapshot, type EngineFlight, type FlightEdit, type Telemetry } from '@/maestro-engine'
const auth = useAuthStore()
const applicationBuild='v4.31'
const engineMismatch=ref(false)
const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && (window as any).__AMAN_LOCAL_TEST__ === true
const apiBase = localPreview ? location.origin : backendBaseUrl
const config = ref<EngineConfig>(structuredClone(DEFAULT_CONFIG))
const edits = ref<Record<string, FlightEdit>>({})
const sequence = ref<EngineSnapshot | null>(null)

const now = ref(Date.now())
const demo = ref(false)
const view = ref('Runway')
const revision = ref(-1)
const masterCid = ref<number | null>(null)
const busy = ref(false)
const polling = ref(false)
const error = ref('')
const menu = ref('')
const selected = ref('')
const recomputeSelection=ref<string[]>([])
const selectionDrag=ref<{startX:number;startY:number;x:number;y:number;left:number;right:number;moved:boolean}|null>(null)
const selectionBox=computed(()=>{
    const a=selectionDrag.value,root=rootElement.value?.getBoundingClientRect();if(!a?.moved||!root)return null
    return {left:`${a.left-root.left}px`,top:`${Math.min(a.startY,a.y)-root.top}px`,width:`${a.right-a.left}px`,height:`${Math.abs(a.y-a.startY)}px`}
})
const arrivalProfileDraft=ref('')
const dialog = ref('')
const dialogPosition=ref<{x:number;y:number}|null>(null)
const dialogDrag=ref<{startX:number;startY:number;x:number;y:number;width:number;height:number}|null>(null)
const movableDialog=computed(()=>dialog.value==='rates'||dialog.value==='configuration')
const dialogStyle=computed(()=>movableDialog.value&&dialogPosition.value?{position:'absolute' as const,left:`${dialogPosition.value.x}px`,top:`${dialogPosition.value.y}px`}:{})
function startDialogDrag(event:PointerEvent){
    if(!movableDialog.value||event.button!==0||(event.target as HTMLElement).closest('button'))return
    const panel=(event.currentTarget as HTMLElement).parentElement!,rect=panel.getBoundingClientRect(),root=rootElement.value!.getBoundingClientRect()
    event.preventDefault();event.stopPropagation()
    try{(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}catch{ /* Synthetic pointers have no capture. */ }
    dialogPosition.value={x:rect.left-root.left,y:rect.top-root.top}
    dialogDrag.value={startX:event.clientX,startY:event.clientY,...dialogPosition.value,width:rect.width,height:rect.height}
}

const clockOffset = ref(0)
const scrollingTime=ref(false)
let scrollAnimationTimer:ReturnType<typeof setTimeout>
watch(clockOffset,()=>{scrollingTime.value=true;clearTimeout(scrollAnimationTimer);scrollAnimationTimer=setTimeout(()=>scrollingTime.value=false,300)},{flush:'sync'})
const timeScroll=ref<{startY:number;offset:number;minutesPerPixel:number}|null>(null)
const overviewFlights=computed(()=>visibleFlights.value.filter(f=>!f.lost&&groups.value.some(g=>g.id===groupOf(f))&&overviewPercent(displayedTime(f))>=0&&overviewPercent(displayedTime(f))<=100))
const overviewWindow=computed(()=>({top:`${overviewPercent(referenceTime.value+60*60000)}%`,height:`${65/242*100}%`}))
function overviewPercent(time:number){return (now.value+180*60000-time)/(242*60000)*100}
function startTimeScroll(event:PointerEvent){
    if(event.button!==0)return
    event.preventDefault()
    const element=event.currentTarget as HTMLElement,rect=element.getBoundingClientRect()
    if((event.target as HTMLElement).classList.contains('overview-window')===false){
        clockOffset.value=Math.max(-60,Math.min(120,Math.round(180-(event.clientY-rect.top)/rect.height*242-27.5)))
    }
    try{element.setPointerCapture(event.pointerId)}catch{ /* Synthetic pointer events have no capture. */ }
    timeScroll.value={startY:event.clientY,offset:clockOffset.value,minutesPerPixel:242/Math.max(1,rect.height)}
}
function scrollTimeKey(event:KeyboardEvent){
    const offsets:Record<string,number>={ArrowUp:1,ArrowDown:-1,PageUp:60,PageDown:-60}
    if(event.key in offsets){event.preventDefault();clockOffset.value=Math.max(-60,Math.min(120,clockOffset.value+offsets[event.key]))}
    else if(event.key==='Home'){event.preventDefault();clockOffset.value=0}
    else if(event.key==='End'){event.preventDefault();clockOffset.value=120}
}
const displayElement = ref<HTMLElement>()
const rootElement = ref<HTMLElement>()
const scrollElement = ref<HTMLElement>()
const plotHeight = ref(470)
const plotWidth = ref(740)
const horizontalPosition = ref(0)
const popupPosition = reactive({ x: 10, y: 80 })
const applyMinutes=ref(0)
const applyBaseTime=ref(Math.floor(Date.now()/60000)*60000)
const applyAt=computed(()=>applyBaseTime.value+applyMinutes.value*60000)
const draftRateSeconds=ref(115)
const draftApplyRate=ref(false)
const rateRunway=computed(()=>dialog.value==='configuration'?draftArrival.value:(effectiveConfig(config.value,applyMinutes.value>0?applyAt.value:now.value).active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R'))
const nextConfiguration=computed(()=>config.value.pending&&config.value.pending.at>now.value?config.value.pending:null)
const nextRate=computed(()=>{
    const currentRunway=currentConfig.value.active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R'
    for(const at of [config.value.pending?.at,config.value.pendingRate?.at].filter((t):t is number=>t!==undefined&&t>now.value).sort((a,b)=>a-b)){
        const planned=effectiveConfig(config.value,at),runway=planned.active.find(r=>r.startsWith('ESSA/'))||currentRunway
        if(runway!==currentRunway||planned.rates[runway]!==currentConfig.value.rates[currentRunway]||at===config.value.pendingRate?.at)return {at,runway,seconds:planned.rates[runway]}
    }
    return null
})
const changeMarkers=computed(()=>{
    const markers:{kind:string;at:number;runway:string;preview?:boolean}[]=[]
    if(dialog.value!=='configuration'&&config.value.pending&&config.value.pending.at>now.value)markers.push({kind:'configuration',at:config.value.pending.at,runway:config.value.pending.active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R'})
    if(dialog.value!=='rates'&&config.value.pendingRate&&config.value.pendingRate.at>now.value)markers.push({kind:'rate',at:config.value.pendingRate.at,runway:effectiveConfig(config.value,config.value.pendingRate.at).active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R'})
    if(['rates','configuration'].includes(dialog.value)&&applyMinutes.value>0)markers.push({kind:dialog.value==='rates'?'rate':'configuration',at:applyAt.value,runway:rateRunway.value,preview:true})
    return markers
})
const dragGuide = ref<number | null>(null)
function dragTime(moving:NonNullable<typeof drag.value>,clientY:number){return Math.round((moving.time-(clientY-moving.startY)/moving.scale*60000)/15000)*15000}
const dragHint=computed(()=>drag.value&&all.value.find(f=>f.callsign===drag.value!.callsign)?.state===1?`${utc(dragTime(drag.value,drag.value.pointerY),true)} UTC`:'Insert here')
let resizeObserver: ResizeObserver
const labels = computed(()=>config.value.displayPreferences?.labels??{ type: false, feeder: false, totalDelay: false, currentDelay: true, runway: false })
const columnWidth = computed(() => Math.max(view.value === 'Runway' ? 360 : 320, plotWidth.value / 3))
const panels = computed(()=>config.value.displayPreferences?.panels??{ winds: false, rates: false, tracks: true })
const draft = ref<EngineConfig>(structuredClone(DEFAULT_CONFIG))
const draftArrival = computed({get:()=>draft.value.active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R',set:(r:string)=>draft.value.active=[...draft.value.active.filter(a=>!a.startsWith('ESSA/')),r]})
const listSelection = ref<string[]>([])
const slotDraft = reactive({ id: '', runway: 'ESSA/19R', start: '', duration: 2 })
const flightSlots = reactive({ before: 0, after: 0 })
const insertCallsign = ref('')
const manualAircraft=ref('UNKN')
const manualWake=ref('?')
const manualFeeder=ref('NILUG')
const bridge = ref(false)
const bridgeStatus = ref('')
const drag = ref<{ callsign: string; startX: number; startY: number; time: number; labelStart:number; scale: number; moved: boolean; pointerY:number } | null>(null)
const settling = ref<{callsign:string;top:number}|null>(null)
const gapDrag=ref<{id:string;part:'begin'|'end'|'move';startY:number;scale:number;originalBegin:number;originalEnd:number;begin:number;end:number;moved:boolean}|null>(null)
const gapSettling=ref<{id:string;begin:number;end:number}|null>(null)
const displayedGaps=computed(()=>config.value.slots.map(s=>{
    const preview=gapDrag.value?.id===s.id?gapDrag.value:gapSettling.value?.id===s.id?gapSettling.value:null
    return preview?{...s,begin:preview.begin,end:preview.end}:s
}))
let suppressGapClick=false
let suppressClick = false
let timer: ReturnType<typeof setInterval>
let pollingTimer: ReturnType<typeof setInterval>
let demoEpoch = Date.now()
const isMaster = computed(() => demo.value || (localPreview && masterCid.value === 0) || masterCid.value === Number(auth.user?.cid))
const stale = computed(() => !sequence.value || now.value - sequence.value.timestamp > 30000)
const editable = computed(() => isMaster.value && !busy.value && !stale.value)
const all = computed(() => (sequence.value?.flights || []).filter(f=>f.arrival==='ESSA'))
const diagnosticFlights=computed(()=>all.value.filter(f=>f.issue))
const sequenced = computed(() => all.value.filter(f => f.mode === 'sequenced' && !f.issue && !f.lost && f.state !== 4))
const current = computed(() => all.value.find(f => f.callsign === selected.value))
const unsequenced = computed(() => all.value.filter(f => f.mode === 'desequenced' || f.mode === 'missed').sort((a,b)=>(edits.value[a.callsign]?.changedAt||0)-(edits.value[b.callsign]?.changedAt||0)))
const currentConfig = computed(() => windConfig(effectiveConfig(config.value,now.value),'ESSA',sequence.value?.winds,now.value))
const entryPoints=['NILUG','ELTOK','VACRA','XILAN']
const visibleFlights = computed(() => all.value.filter(f=>f.mode==='sequenced'))
const flightLabels=computed(()=>scrollingLabelPositions(visibleFlights.value.map(f=>({id:f.callsign,y:y(displayedTime(f)),side:`${groupOf(f)}-${rightSide(f)}`})),23,view.value==='Runway'?displayedGaps.value.map(s=>({side:`${groups.value.find(g=>g.runways.includes(s.runway))?.id}-${groups.value.find(g=>g.runways.includes(s.runway))?.runways[1]===s.runway}`,top:y(s.end)-18,bottom:y(s.begin)+18})):[]))
function labelY(f:EngineFlight){return flightLabels.value[f.callsign]??y(displayedTime(f))}
const referenceTime = computed(() => now.value + clockOffset.value * 60000)
const groups = computed<{id:string;name:string;runways:string[];fix:string}[]>(() => view.value === 'Runway' ? [
    {id:'19',name:'19L / 19R',runways:['ESSA/19L','ESSA/19R'],fix:''},
    {id:'08-26',name:'26 / 08',runways:['ESSA/26','ESSA/08'],fix:''},
    {id:'01',name:'01L / 01R',runways:['ESSA/01L','ESSA/01R'],fix:''},
] : entryPoints.map(f=>({id:f,name:f,runways:[] as string[],fix:f})))
const ticks = Array.from({ length: 66 }, (_, i) => i-5)
const pixelsPerMinute = computed(()=>plotHeight.value / 65)
const nowBaseline = computed(()=>pixelsPerMinute.value * 60)
const horizontalMax = computed(()=>Math.max(0,groups.value.length*columnWidth.value-plotWidth.value))
const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value))
function rwy(f: EngineFlight) { return edits.value[f.callsign]?.runway || `${f.arrival}/${f.runway}` }
function groupOf(f: EngineFlight) { return view.value === 'Runway' ? groups.value.find(g=>g.runways.includes(rwy(f)))?.id : groups.value.some(g=>g.fix===f.ff) ? f.ff : 'OTHER' }
function rightSide(f:EngineFlight) { return view.value==='Runway' && groups.value.find(g=>g.id===groupOf(f))?.runways[1]===rwy(f) }
function displayedTime(f: EngineFlight) { return f.state===4?f.sta:view.value === 'ACC' ? f.staFf : f.sta }
function movable(f:EngineFlight) { return editable.value && !f.lost && !f.issue && f.mode==='sequenced' && f.state!==3 }
function locked(f:EngineFlight) { return f.state===2 || f.state===3 }
function y(time: number) { return nowBaseline.value - (time - referenceTime.value) / 60000 * pixelsPerMinute.value }
function timeAt(element:HTMLElement,clientY:number) { return referenceTime.value+(nowBaseline.value-(clientY-element.getBoundingClientRect().top))/pixelsPerMinute.value*60000 }
function positionPopup(event:MouseEvent|PointerEvent,atPointer=false) {
    const root=rootElement.value?.getBoundingClientRect(); if(!root)return
    const target=(event.currentTarget as HTMLElement).getBoundingClientRect()
    let x=atPointer?event.clientX-root.left+4:target.right-root.left+5
    if(x+190>root.width)x=target.left-root.left-195
    popupPosition.x=Math.max(4,Math.min(x,root.width-194))
    popupPosition.y=Math.max(4,Math.min(event.clientY-root.top,root.height-220))
}
function scrollHorizontal() { if(scrollElement.value)scrollElement.value.scrollLeft=horizontalPosition.value }
function syncHorizontal() { horizontalPosition.value=scrollElement.value?.scrollLeft || 0 }
function utc(time: number, seconds = false) { return new Date(time).toISOString().slice(11, seconds ? 19 : 16) }
function minutes(time: number) { return new Date(time).getUTCMinutes().toString().padStart(2, '0') }
function delayColor(seconds: number) { return seconds < 0 ? '#29ff28' : Math.round(seconds/60)<3 ? '#f0e129' : '#e11919' }
function stateColor(f: EngineFlight) { return f.lost ? '#606060' : STATE_COLORS[f.state] }
function measuredRate(runway:string) {
    const landed=(sequence.value?.landings||[]).filter(l=>l.runway===runway&&now.value-l.time<=1800000).sort((a,b)=>a.time-b.time)
    return landed.length<2?null:Math.round((landed[landed.length-1].time-landed[0].time)/(landed.length-1)/1000)
}
function demoInput(timestamp: number): Telemetry {
    const elapsed = (timestamp - demoEpoch) / 1000
    const demoRunway=(effectiveConfig(config.value,timestamp).active.find(r=>r.startsWith('ESSA/'))||'ESSA/19R').split('/')[1]
    const sample = [
        ['SAS1015','A320','M',7,'ELTOK'], ['SAS205','A20N','M',9,'NILUG'],
        ['FIN6X','E190','M',20,'XILAN'], ['DLH2JT','A321','M',21.5,'ELTOK'],
        ['SAS904','A333','H',16,'NILUG'], ['NAX431','B738','M',21,'XILAN'],
        ['BAW778','A320','M',28,'ELTOK'], ['RYR8KV','B738','M',55,'NILUG'],
        ['SASLAN','A320','M',-1,'ELTOK'],
    ]
    return { source: 'DEMO', timestamp, flights: sample.map(([callsign, aircraft, wake, arrival, feeder]) => ({
        callsign: String(callsign), aircraft: String(aircraft), wake: String(wake), runway: demoRunway,
        departure: 'EKCH', arrival: 'ESSA', landingSeconds: Number(arrival) * 60 - elapsed,
        route: [{ name: String(feeder), seconds: Number(arrival) * 60 - 600 - elapsed }],
        distanceNm: Math.max(.1, Number(arrival) * 3 - elapsed / 20), groundspeed: Number(arrival)*60-elapsed<0?0:180, altitude: Number(arrival)*60-elapsed<0?100:7000,
    })) }
}
function refreshDemo(force = false) {
    const old = force && sequence.value ? { ...sequence.value, timestamp: now.value - 1 } : sequence.value || undefined
    sequence.value = runEngine(demoInput(now.value), config.value, edits.value, old)
}
function headers() { return localPreview ? {} : { Authorization: `Bearer ${auth.token.access_token}` } }
function receive(data: any) {
    if (data.revision < revision.value) return
    revision.value = data.revision; config.value = data.config; edits.value = data.edits
    sequence.value = data.snapshot; masterCid.value = data.masterCid
}
async function poll() {
    now.value = Date.now()
    if(engineMismatch.value&&!demo.value)return
    if(timeScroll.value||drag.value||settling.value||gapDrag.value||gapSettling.value||selectionDrag.value)return
    if (demo.value) { refreshDemo(); return }
    if (busy.value || polling.value || (!localPreview && !auth.token.access_token)) return
    polling.value = true
    try {
        if (isMaster.value) {
            const local = await fetch('http://127.0.0.1:17777/telemetry', { signal: AbortSignal.timeout(2000) })
            if (!local.ok) throw new Error('No EuroScope predictions. Load the updated plugin and start the bridge.')
            const telemetry = await local.json()
            receive((await axios.post(`${apiBase}/maestro/ESSA/telemetry`, telemetry, { headers: headers(), timeout: 7000 })).data)
        } else receive((await axios.get(`${apiBase}/maestro/ESSA`, { headers: headers(), timeout: 7000 })).data)
        error.value = ''
    } catch (e: any) { error.value = e.response?.data?.error || e.message || 'Shared AMAN unavailable' }
    finally { polling.value = false }
    if (bridge.value) await publishTiming()
}
async function commit(nextEdits = edits.value, nextConfig = config.value) {
    nextConfig={...nextConfig,...sharedSettings(config.value)}
    if (!editable.value) { error.value='Only the active MASTER can edit a fresh sequence'; return }
    try { validateLockedEdits(sequence.value,edits.value,nextEdits,nextConfig) } catch(e:any) {error.value=e.message;return}
    if (demo.value) { edits.value = clone(nextEdits); config.value = clone(nextConfig); refreshDemo(true); error.value='';return }
    busy.value = true
    try {
        receive((await axios.put(`${apiBase}/maestro/ESSA`, { revision: revision.value, config: nextConfig, edits: nextEdits },
            { headers: headers(), timeout: 7000 })).data)
        error.value = ''
    } catch (e: any) { error.value = e.response?.data?.error || 'Change not saved' }
    finally { busy.value = false }
}
async function chooseMode(mode: string) {
    menu.value = ''
    if (mode === 'DEMO') {
        demo.value = true; engineMismatch.value=false;demoEpoch = Date.now(); now.value = demoEpoch
        error.value=''
        edits.value = {}; config.value = structuredClone(DEFAULT_CONFIG)
        const seed = runEngine(demoInput(demoEpoch - 120000), config.value, {})
        sequence.value = runEngine(demoInput(demoEpoch), config.value, {}, seed)
        dialog.value = ''; return
    }
    if (!localPreview && !auth.token.access_token) { auth.login(); return }
    demo.value = false; revision.value = -1
    try {
        if(localPreview){
            const response=await fetch(`${apiBase}/aman-preview-health`,{signal:AbortSignal.timeout(2000)})
            const health=await response.json()
            if(!response.ok||health.applicationBuild!==applicationBuild){engineMismatch.value=true;masterCid.value=null;bridge.value=false;throw new Error('An older AMAN engine is running. Close old AMAN tabs and launcher windows, then run START-AMAN.cmd and use the newly opened page.')}
            engineMismatch.value=false
        }
        if (mode === 'MASTER') receive((await axios.post(`${apiBase}/maestro/ESSA/master`, {}, { headers: headers() })).data)
        else {
            if (isMaster.value) await axios.post(`${apiBase}/maestro/ESSA/master`, { release: true }, { headers: headers() })
            masterCid.value = null
        }
        bridge.value = true; dialog.value = ''; await poll()
    } catch (e: any) { error.value = e.response?.data?.error || (engineMismatch.value?e.message:'Could not change operation mode') }
}
function openDialog(name: string) {
    menu.value = ''; draft.value = clone(currentConfig.value); dialog.value = name;dialogPosition.value=null;dialogDrag.value=null
    applyMinutes.value=0;applyBaseTime.value=Math.floor(now.value/60000)*60000
    const pending=name==='configuration'?nextConfiguration.value:name==='rates'&&config.value.pendingRate&&config.value.pendingRate.at>now.value?config.value.pendingRate:null
    if(name==='configuration'&&nextConfiguration.value){draft.value.active=[...nextConfiguration.value.active];draft.value.departureRunway=nextConfiguration.value.departureRunway;draft.value.rates={...draft.value.rates,...nextConfiguration.value.rates}}
    if(pending)applyMinutes.value=Math.max(0,Math.min(60,Math.round((pending.at-applyBaseTime.value)/60000)))
    draftApplyRate.value=name==='configuration'&&!!nextConfiguration.value&&nextConfiguration.value.applyRate!==false
    draftRateSeconds.value=name==='rates'&&config.value.pendingRate&&config.value.pendingRate.at>now.value?config.value.pendingRate.seconds:draft.value.rates[draftArrival.value]
    if(name==='rates'||name==='configuration'){clockOffset.value=0;focusArrivalColumn(rateRunway.value)}
    if(name==='arrival-profile')arrivalProfileDraft.value=edits.value[selected.value]?.arrivalProfile??''
    if (name === 'flight-slots' && current.value) {
        flightSlots.before = current.value.slotBefore; flightSlots.after = current.value.slotAfter
    }
}
function focusArrivalColumn(runway:string){
    view.value='Runway'
    const index=groups.value.findIndex(g=>g.runways.includes(runway))
    horizontalPosition.value=Math.max(0,Math.min(horizontalMax.value,index*columnWidth.value-(plotWidth.value-columnWidth.value)/2))
    void nextTick(scrollHorizontal)
}
watch(draftArrival,r=>{if(dialog.value==='configuration'){draftRateSeconds.value=draft.value.rates[r];draftApplyRate.value=false;focusArrivalColumn(r)}},{flush:'sync'})
watch(rateRunway,r=>{if(dialog.value==='rates')focusArrivalColumn(r)})
function editFlight(patch: FlightEdit) {
    if (!current.value) return
    const callsign = current.value.callsign
    void commit({ ...edits.value, [callsign]: { ...edits.value[callsign], ...patch, changedAt: now.value } })
    menu.value = ''
}
function flightClick(f: EngineFlight,event:MouseEvent) {
    if(suppressClick){suppressClick=false;return}
    selected.value = f.callsign;positionPopup(event); menu.value = 'flight'
}
function leaveDialogMenu(){if(dialog.value==='runway'||dialog.value==='flight-slots')dialog.value=''}
function closeFieldMenu(){menu.value='';recomputeSelection.value=[]}
function startSelection(event:PointerEvent){
    if(event.button!==0||!editable.value||(event.target as HTMLElement).closest('button,input,.closure-gap,.popup'))return
    event.preventDefault();closeFieldMenu();selected.value='';error.value=''
    try{(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}catch{ /* Synthetic events have no capture. */ }
    const timeline=(event.currentTarget as HTMLElement).getBoundingClientRect(),width=columnWidth.value,total=groups.value.length*width
    const lane=Math.floor((event.clientX-timeline.left-width/2)/width)
    const left=timeline.left+Math.max(0,width/2+lane*width),right=timeline.left+Math.min(total,width/2+(lane+1)*width)
    selectionDrag.value={startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,left,right,moved:false}
}
function updateSelection(event:PointerEvent){
    const area=selectionDrag.value;if(!area)return
    area.x=event.clientX;area.y=event.clientY
    if(Math.hypot(area.x-area.startX,area.y-area.startY)>4)area.moved=true
    if(!area.moved)return
    const left=area.left,right=area.right,top=Math.min(area.startY,area.y),bottom=Math.max(area.startY,area.y)
    recomputeSelection.value=Array.from(rootElement.value?.querySelectorAll<HTMLElement>('.flight[data-callsign]')||[]).filter(el=>{
        const rect=el.getBoundingClientRect(),f=all.value.find(f=>f.callsign===el.dataset.callsign)
        return f&&!f.lost&&rect.right>=left&&rect.left<=right&&rect.bottom>=top&&rect.top<=bottom
    }).map(el=>el.dataset.callsign!)
}
function finishSelection(event:PointerEvent){
    updateSelection(event)
    const moved=selectionDrag.value?.moved;selectionDrag.value=null
    if(!moved||!recomputeSelection.value.length){closeFieldMenu();return}
    const root=rootElement.value?.getBoundingClientRect();if(!root)return
    popupPosition.x=Math.max(4,Math.min(event.clientX-root.left+4,root.width-194))
    popupPosition.y=Math.max(4,Math.min(event.clientY-root.top,root.height-95))
    menu.value='recompute'
}
async function recomputeFlights(callsigns:string[]){
    if(!editable.value)return
    const changes=clone(edits.value)
    for(const callsign of callsigns){
        if(!all.value.some(f=>f.callsign===callsign&&!f.lost))continue
        const stamp=Math.max(now.value,(sequence.value?.timestamp||0)+1,(changes[callsign]?.recomputeAt||0)+1)
        changes[callsign]={...changes[callsign],mode:'sequenced',recomputeAt:stamp,changedAt:stamp,order:all.value.find(f=>f.callsign===callsign)?.state===3?all.value.find(f=>f.callsign===callsign)!.order:undefined,target:undefined,swapAt:undefined,requeueAt:undefined,landedAt:undefined,closurePosition:undefined}
    }
    closeFieldMenu();await commit(changes)
}
function startDrag(f: EngineFlight,event:PointerEvent) {
    if(event.button!==0)return
    if(!movable(f)){error.value=!isMaster.value?'Select MASTER to change the sequence':stale.value?'Waiting for fresh aircraft data':f.state===3?'Frozen aircraft cannot be manually resequenced':'This aircraft cannot currently be moved';return}
    event.preventDefault()
    try{(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}catch{ /* Synthetic pointer events have no capture. */ }
    drag.value={callsign:f.callsign,startX:event.clientX,startY:event.clientY,time:displayedTime(f),labelStart:labelY(f),scale:pixelsPerMinute.value,moved:false,pointerY:event.clientY}
    selected.value=f.callsign;error.value=''
    menu.value=''
}
function startGapDrag(id:string,part:'begin'|'end'|'move',event:PointerEvent) {
    if(event.button!==0 || !editable.value || gapSettling.value)return
    const slot=config.value.slots.find(s=>s.id===id);if(!slot)return
    event.preventDefault();menu.value='';error.value=''
    try{(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}catch{ /* Test pointers have no native capture. */ }
    gapDrag.value={id,part,startY:event.clientY,scale:pixelsPerMinute.value,originalBegin:slot.begin,originalEnd:slot.end,begin:slot.begin,end:slot.end,moved:false}
}
function updateGapDrag(event:PointerEvent) {
    const moving=gapDrag.value;if(!moving)return
    const pixels=event.clientY-moving.startY
    if(Math.abs(pixels)>3)moving.moved=true
    const delta=Math.round(-pixels/moving.scale*60000/15000)*15000
    if(moving.part==='move'){
        const shift=Math.max(-moving.originalBegin,delta)
        moving.begin=moving.originalBegin+shift;moving.end=moving.originalEnd+shift
    }else if(moving.part==='begin')moving.begin=Math.max(0,Math.min(moving.originalEnd-30000,Math.max(moving.originalEnd-86400000,moving.originalBegin+delta)))
    else moving.end=Math.max(moving.originalBegin+30000,Math.min(moving.originalBegin+86400000,moving.originalEnd+delta))
}
function gapStyle(slot:EngineConfig['slots'][number]) {
    const top=Math.max(0,y(slot.end)),bottom=Math.min(plotHeight.value,y(slot.begin))
    return {top:`${top}px`,height:`${Math.max(1,bottom-top)}px`,'--end-caption-top':`${top<18?5:-17}px`,'--begin-caption-bottom':`${bottom>plotHeight.value-18?5:-17}px`}
}
function gapClick(id:string){if(suppressGapClick){suppressGapClick=false;return}openGap(id)}
function finishGapDrag(event:PointerEvent) {
    updateGapDrag(event)
    const moving=gapDrag.value;gapDrag.value=null
    if(!moving?.moved)return
    suppressGapClick=true;setTimeout(()=>suppressGapClick=false,100)
    const next=clone(config.value)
    next.slots=next.slots.map(s=>s.id===moving.id?{...s,begin:moving.begin,end:moving.end}:s)
    gapSettling.value={id:moving.id,begin:moving.begin,end:moving.end}
    void commit(edits.value,next).finally(()=>gapSettling.value=null)
}
function pointerMove(event:PointerEvent) {
    if(dialogDrag.value){
        const moving=dialogDrag.value,root=rootElement.value!.getBoundingClientRect()
        dialogPosition.value={x:Math.max(0,Math.min(Math.max(0,root.width-moving.width),moving.x+event.clientX-moving.startX)),y:Math.max(0,Math.min(Math.max(0,root.height-moving.height),moving.y+event.clientY-moving.startY))};return
    }
    if(timeScroll.value){clockOffset.value=Math.max(-60,Math.min(120,timeScroll.value.offset-(event.clientY-timeScroll.value.startY)*timeScroll.value.minutesPerPixel));return}
    if(selectionDrag.value){updateSelection(event);return}
    if(gapDrag.value){updateGapDrag(event);return}
    if(!drag.value)return
    if(Math.hypot(event.clientX-drag.value.startX,event.clientY-drag.value.startY)>4)drag.value.moved=true
    if(drag.value.moved){
        drag.value.pointerY=event.clientY
        dragGuide.value=insertionGuide(drag.value,event.clientY)
    }
}
function dragPosition(f:EngineFlight) {
    if(settling.value?.callsign===f.callsign)return settling.value.top
    return drag.value?.callsign===f.callsign && drag.value.moved ? drag.value.labelStart+drag.value.pointerY-drag.value.startY : labelY(f)
}
function insertionGuide(moving:NonNullable<typeof drag.value>,clientY:number) {
    const flight=all.value.find(f=>f.callsign===moving.callsign);if(!flight)return null
    const pointerTop=moving.labelStart+clientY-moving.startY
    // Labels are not drop targets. Their occupied vertical band is excluded.
    const peers=all.value.filter(f=>f.callsign!==moving.callsign && f.mode==='sequenced' && f.state!==4 && !f.lost && !f.issue && rwy(f)===rwy(flight))
    if(peers.some(f=>{
        const centre=labelY(f)
        const nearest=Math.min(...peers.filter(p=>p.callsign!==f.callsign).map(p=>Math.abs(labelY(p)-centre)),21)
        return Math.abs(centre-pointerTop)<=Math.min(7,nearest/3)
    }))return null
    if(pointerTop<0 || pointerTop>nowBaseline.value)return null
    const time=referenceTime.value+(nowBaseline.value-pointerTop)/pixelsPerMinute.value*60000
    if(view.value==='Runway'&&displayedGaps.value.some(s=>s.runway===rwy(flight)&&time>=s.begin&&time<s.end))return null
    return pointerTop
}
function pointerCancel(){dialogDrag.value=null;timeScroll.value=null;drag.value=null;dragGuide.value=null;gapDrag.value=null;selectionDrag.value=null;recomputeSelection.value=[]}
function pointerUp(event:PointerEvent) {
    if(dialogDrag.value){pointerMove(event);dialogDrag.value=null;return}
    if(timeScroll.value){timeScroll.value=null;return}
    if(selectionDrag.value){finishSelection(event);return}
    if(gapDrag.value){finishGapDrag(event);return}
    const moving=drag.value;const validDrop=moving&&insertionGuide(moving,event.clientY)!==null;drag.value=null;dragGuide.value=null
    if(!moving || (!moving.moved&&Math.hypot(event.clientX-moving.startX,event.clientY-moving.startY)<=4))return
    suppressClick=true;setTimeout(()=>suppressClick=false,50)
    if(!validDrop){error.value='Drop in a gap between aircraft, above the red NOW line';return}
    const flight=all.value.find(f=>f.callsign===moving.callsign);if(!flight)return
    const pointerTop=moving.labelStart+event.clientY-moving.startY
    const peers=all.value.filter(f=>f.callsign!==flight.callsign&&f.mode==='sequenced'&&f.state!==4&&!f.lost&&!f.issue&&rwy(f)===rwy(flight)&&groupOf(f)===groupOf(flight)).sort((a,b)=>displayedTime(a)-displayedTime(b))
    const index=peers.findIndex(f=>labelY(f)<pointerTop)
    const targetDisplayed=peers.length ? index===0?displayedTime(peers[0])-1:index<0?displayedTime(peers.at(-1)!)+1:(displayedTime(peers[index-1])+displayedTime(peers[index]))/2 : Math.round(moving.time-(event.clientY-moving.startY)/moving.scale*60000)
    const pointerTime=referenceTime.value+(nowBaseline.value-pointerTop)/pixelsPerMinute.value*60000
    const nearbyClosure=view.value==='Runway'?displayedGaps.value.filter(s=>s.runway===rwy(flight)).find(s=>{
        const low=!peers.length||index===0?-Infinity:index<0?displayedTime(peers.at(-1)!):displayedTime(peers[index-1])
        const high=!peers.length||index<0?Infinity:displayedTime(peers[index])
        return s.end>low&&s.begin<high
    }):undefined
    // A closure has two boundaries, never an invisible midpoint drop target.
    if(nearbyClosure&&pointerTime>=nearbyClosure.begin&&pointerTime<nearbyClosure.end){error.value='Drop before the closure start or after its end';return}
    const closurePosition=nearbyClosure?{id:nearbyClosure.id,side:(pointerTime<nearbyClosure.begin?'before':'after') as 'before'|'after'}:undefined
    const insertionTime=closurePosition?pointerTime:targetDisplayed
    // The drop selects a gap in the queue, never a callsign or an exact landing time.
    if(sequence.value){
        settling.value={callsign:flight.callsign,top:pointerTop}
        try{void commit(flight.state===1?retimeEdits(sequence.value,edits.value,flight.callsign,dragTime(moving,event.clientY),view.value,config.value):reorderEdits(sequence.value,edits.value,flight.callsign,insertionTime,view.value,config.value,closurePosition)).finally(()=>settling.value=null)}catch(e:any){settling.value=null;error.value=e.message}
    }
}
function newSlot(group:string,event:MouseEvent) {
    if(!editable.value)return
    const g=groups.value.find(g=>g.id===group);if(!g)return
    const rect=(event.currentTarget as HTMLElement).getBoundingClientRect()
    slotDraft.id='';slotDraft.runway=view.value==='Runway'?g.runways[event.clientX-rect.left>=columnWidth.value/2?1:0]:currentConfig.value.active[0]
    slotDraft.start=utc(timeAt(event.currentTarget as HTMLElement,event.clientY));slotDraft.duration=2
    manualFeeder.value=g.fix || 'NILUG';positionPopup(event,true);menu.value='timeline'
}
function openFlightGap() {
    if(!current.value)return
    slotDraft.id='';slotDraft.runway=rwy(current.value);slotDraft.start=utc(current.value.sta-60000);slotDraft.duration=2
    openDialog('slot')
}
function openGap(id:string) {
    const gap=config.value.slots.find(s=>s.id===id);if(!gap)return
    slotDraft.id=gap.id;slotDraft.runway=gap.runway;slotDraft.start=utc(gap.begin);slotDraft.duration=(gap.end-gap.begin)/60000
    openDialog('slot')
}
function insertFlight() {
    const callsign = insertCallsign.value.trim().toUpperCase()
    const flight = all.value.find(f => f.callsign === callsign)
    if(!/^[A-Z0-9_-]{2,16}$/.test(callsign)){error.value='Enter a valid callsign';return}
    const match = slotDraft.start.match(/^(\d{2}):(\d{2})$/)
    if (!match) return
    const date = new Date(now.value); date.setUTCHours(Number(match[1]), Number(match[2]), 0, 0)
    if (date.getTime() < now.value - 43200000) date.setUTCDate(date.getUTCDate() + 1)
    const queue = sequenced.value.filter(f => rwy(f) === slotDraft.runway && f.callsign !== callsign).sort((a,b)=>a.order-b.order)
    let index = queue.findIndex(f => f.sta >= date.getTime()); if (index < 0) index = queue.length
    const c=clone(config.value)
    if(!flight) {
        c.manualFlights=[...(c.manualFlights || []).filter(f=>f.callsign!==callsign),{callsign,runway:slotDraft.runway,aircraft:manualAircraft.value||'UNKN',wake:manualWake.value,feeder:manualFeeder.value,eta:date.getTime()}]
    }
    if(flight?.state===0){error.value='Wait until the aircraft has a stable prediction';return}
    if(flight?.state===2||flight?.state===3){error.value=flight.state===3?'Frozen aircraft cannot be manually resequenced':'Drag this Super Stable aircraft into a gap between aircraft to change its sequence';return}
    const changes=flight&&sequence.value?reorderEdits(sequence.value,edits.value,callsign,date.getTime()):{...edits.value}
    changes[callsign]={...changes[callsign],mode:'sequenced',runway:slotDraft.runway,target:undefined,swapAt:undefined,changedAt:now.value}
    void commit(changes,c)
    dialog.value=''
}
function saveSlot() {
    const match = slotDraft.start.match(/^(\d{2}):(\d{2})$/)
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || slotDraft.duration <= 0) { error.value = 'Enter a valid UTC start and duration'; return }
    const date = new Date(now.value); date.setUTCHours(Number(match[1]), Number(match[2]), 0, 0)
    if (date.getTime() < now.value - 12 * 3600000) date.setUTCDate(date.getUTCDate() + 1)
    const id = slotDraft.id || `slot-${Date.now()}`
    const c = clone(config.value)
    c.slots = c.slots.filter(s => s.id !== id)
    c.slots.push({ id, runway: slotDraft.runway, begin: date.getTime(), end: date.getTime() + slotDraft.duration * 60000 })
    void commit(edits.value, c); dialog.value = ''
}
async function cancelPlannedChange(){
    const next=clone(config.value)
    if(dialog.value==='configuration')next.pending=undefined
    else next.pendingRate=undefined
    await commit(edits.value,next);if(!error.value)dialog.value=''
}
async function saveRates() {
    try {
        const next=clone(effectiveConfig(config.value,now.value))
        if(next.pending&&next.pending.at<=now.value)next.pending=undefined
        if(next.pendingRate&&next.pendingRate.at<=now.value)next.pendingRate=undefined
        const at=applyAt.value
        if(applyMinutes.value>0&&at<=now.value)throw new Error('Choose a future time with the slider')
        if(dialog.value==='rates'){
            if(applyMinutes.value>0)next.pendingRate={at,seconds:draftRateSeconds.value}
            else{next.pendingRate=undefined;next.rates[rateRunway.value]=draftRateSeconds.value}
        }else{
            const rates={...next.rates,...(draftApplyRate.value?{[draftArrival.value]:draftRateSeconds.value}:{})}
            if(applyMinutes.value>0)next.pending={at,active:[...draft.value.active],rates,departureRunway:draft.value.departureRunway,applyRate:draftApplyRate.value}
            else{next.pending=undefined;next.active=[...draft.value.active];next.departureRunway=draft.value.departureRunway;next.rates=rates}
        }
        await commit(edits.value,next);if(!error.value)dialog.value=''
    }catch(e:any){error.value=e.message}
}
function resumeList(remove = false) {
    const changes = { ...edits.value }
    for (const call of listSelection.value) changes[call] = { ...changes[call], mode: remove ? 'removed' : 'sequenced', recomputeAt: now.value,changedAt:now.value,order:undefined,target:undefined,swapAt:undefined,requeueAt:undefined,landedAt:undefined,closurePosition:undefined }
    void commit(changes); listSelection.value = []
}
async function publishTiming() {
    if (!bridge.value) return
    try {
        const response = await fetch('http://127.0.0.1:17777/timing', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000), body: JSON.stringify({ airport: 'ESSA', generatedAt: Date.now(),
                nativeSequence: !demo.value && !stale.value && sequence.value ? toJuhaSequence(sequence.value, config.value, edits.value) : null,
                flights: demo.value || stale.value ? [] : sequenced.value.filter(f => f.arrival === 'ESSA').map(f => ({
                    callsign: f.callsign, runway: rwy(f).split('/')[1], eta: f.eta, sta: f.sta, deltaSeconds: euroscopeInstruction(f) })) }) })
        if (!response.ok) throw new Error('Bridge error')
        bridgeStatus.value = demo.value ? 'DEMO excluded from EuroScope' : 'EuroScope timing sent'
    } catch { bridgeStatus.value = 'Bridge unavailable' }
}
onMounted(() => {
    void chooseMode(localPreview?'MASTER':'SLAVE')
    timer = setInterval(() => now.value = Date.now(), 1000)
    pollingTimer = setInterval(poll, 3000)
    resizeObserver = new ResizeObserver(entries => {plotHeight.value=Math.max(200,entries[0].contentRect.height-28);plotWidth.value=Math.max(200,entries[0].contentRect.width-17)})
    if (displayElement.value) resizeObserver.observe(displayElement.value)
    window.addEventListener('pointermove',pointerMove,true);window.addEventListener('pointerup',pointerUp,true);window.addEventListener('pointercancel',pointerCancel,true)
})
onUnmounted(() => { clearTimeout(scrollAnimationTimer);clearInterval(timer); clearInterval(pollingTimer); resizeObserver?.disconnect();window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',pointerUp,true);window.removeEventListener('pointercancel',pointerCancel,true) })
</script>

<template>
<section class="juha-aman" ref="rootElement" @contextmenu.prevent>
    <div class="toolbar">
        <button class="configuration-button" data-action="configuration" aria-label="Runway configuration" @click="openDialog('configuration')"><span>{{ currentConfig.active.find(r=>r.startsWith('ESSA/'))?.split('/')[1] }} / {{currentConfig.departureRunway?.split('/')[1]}}<template v-if="nextConfiguration"><em class="pill-arrow">→</em><strong class="pill-next">{{nextConfiguration.active.find(r=>r.startsWith('ESSA/'))?.split('/')[1]}} / {{nextConfiguration.departureRunway?.split('/')[1]}}</strong></template></span><small v-if="nextConfiguration" class="pill-change-time">{{utc(nextConfiguration.at)}} UTC</small></button>
        <button class="rate-button" data-action="rates" aria-label="Arrival rate" @click="openDialog('rates')"><span v-for="r in currentConfig.active" :key="r">{{r.split('/')[1]}} : {{Math.round(3600/currentConfig.rates[r])}} / h<template v-if="nextRate&&r.startsWith('ESSA/')"><em class="pill-arrow">→</em><strong class="pill-next">{{Math.round(3600/nextRate.seconds)}} / h</strong><small class="pill-change-time">{{utc(nextRate.at)}} UTC</small></template><small>{{currentConfig.rates[r]}}s · {{rateDistanceNm(currentConfig.rates[r],r,currentConfig).toFixed(1)}} NM</small></span></button>
        <div v-if="panels.tracks" class="tracks">TMA {{ sequenced.filter(f=>f.passedFeeder).length }}<br>TOT {{sequenced.length}}</div><div v-if="panels.winds" class="tracks">SFC {{currentConfig.surfaceWindDirection}}°<br>{{currentConfig.surfaceWindSpeed}} kt</div><div v-if="panels.rates" class="tracks"><span v-for="r in currentConfig.active" :key="r">{{r.split('/')[1]}} {{measuredRate(r)===null?'—':`${measuredRate(r)}s (${measuredRate(r)!-currentConfig.rates[r]}s)`}}<br></span></div><span class="updated">{{sequence?utc(sequence.timestamp,true):'--:--:--'}}</span>
    </div>
    <nav class="view-buttons">
        <button @click="menu=menu==='maestro'?'':'maestro'">MAESTRO▼</button>
        <button v-for="v in ['ACC','Runway','FLOW']" :key="v" :class="{active:view===v}" @click="view=v;menu='';horizontalPosition=0;scrollHorizontal()">{{v}}</button>
        <button data-action="desequenced" @click="dialog='desequenced';menu=''">Desequenced {{unsequenced.length}}</button><button @click="dialog='missed';menu=''">Missed Approach {{all.filter(f=>f.mode==='missed').length}}</button>
    </nav>
    <div v-if="menu==='maestro'" class="popup global-menu" @mouseleave="closeFieldMenu"><button @click="openDialog('setup')">ESSA · Operation mode</button></div>
    <div class="display" ref="displayElement">
        <div class="time-overview" role="scrollbar" aria-label="Arrival overview — scroll timeline in time" aria-orientation="vertical" aria-controls="aman-timeline" :aria-valuemin="-60" :aria-valuemax="120" :aria-valuenow="clockOffset" :aria-valuetext="`${clockOffset} minutes from now`" tabindex="0" @pointerdown="startTimeScroll" @keydown="scrollTimeKey" @dblclick="clockOffset=0">
            <div class="overview-window" :style="overviewWindow" title="Visible time window — drag to scroll"></div>
            <span v-for="f in overviewFlights" :key="f.callsign" class="overview-flight" :data-overview-callsign="f.callsign" :style="{top:`${overviewPercent(displayedTime(f))}%`,background:stateColor(f)}"></span>
            <i class="overview-now" :style="{top:`${overviewPercent(now)}%`}"></i>
        </div>
        <div class="horizontal-scroll" ref="scrollElement" @scroll="syncHorizontal">
            <div id="aman-timeline" class="timeline-strip" :class="{'scrolling-time':scrollingTime}" @pointerdown="startSelection" :style="{'--column-width':`${columnWidth}px`,'--axis-x':`${columnWidth/2}px`}">
                <div class="now-line" :style="{top:`${y(now)}px`}"><span>{{utc(now)}} NOW</span></div>
                <div v-if="dragGuide!==null" class="drag-guide" :style="{top:`${dragGuide}px`}"><span>{{dragHint}}</span></div>
                <div v-for="g in groups" :key="g.id" class="timeline-column" :data-column="g.id">
                    <div class="column-heading" v-if="view!=='Runway'"><template v-if="view==='Runway'"><span v-for="r in g.runways" :key="r" :class="{inactive:!currentConfig.active.includes(r)}">{{r.split('/')[1]}} {{currentConfig.active.includes(r)?'ARR':currentConfig.departureRunway===r?'DEP':''}}</span></template><span v-else>{{g.name}}</span></div>
                    <div class="time-area" @contextmenu.stop.prevent="newSlot(g.id,$event)">
                        <div class="axis"></div>
                        <div v-for="i in ticks" :key="i" class="tick" :class="{major:Number(minutes(Math.floor(referenceTime/60000)*60000+i*60000))%5===0}" :style="{top:`${y(Math.floor(referenceTime/60000)*60000+i*60000)}px`}"><span v-if="Number(minutes(Math.floor(referenceTime/60000)*60000+i*60000))%5===0">{{minutes(Math.floor(referenceTime/60000)*60000+i*60000)}}</span></div>
                        <svg class="time-anchors" aria-hidden="true"><g v-for="f in visibleFlights.filter(f=>groupOf(f)===g.id&&y(displayedTime(f))>=0&&y(displayedTime(f))<=plotHeight)" :key="f.callsign" :stroke="stateColor(f)"><circle :cx="columnWidth/2+(rightSide(f)?20:-14)" :cy="y(displayedTime(f))" r="2" :fill="stateColor(f)"/><line v-if="Math.abs(labelY(f)-y(displayedTime(f)))>2" :x1="columnWidth/2+(rightSide(f)?20:-14)" :y1="y(displayedTime(f))" :x2="columnWidth/2+(rightSide(f)?27:-20)" :y2="labelY(f)"/></g></svg>
                        <i v-for="marker in changeMarkers.filter(m=>y(m.at)>=0&&y(m.at)<=plotHeight)" :key="marker.kind" class="change-time-marker" :class="[marker.kind,{preview:marker.preview}]" :data-kind="marker.kind" :data-preview="!!marker.preview" :data-time="marker.at" :style="{top:`${y(marker.at)}px`}" :title="`${marker.kind==='rate'?'Rate':'Runway configuration'} change at ${utc(marker.at)} UTC`"></i>
                        <div v-for="s in displayedGaps.filter(s=>view==='Runway'&&g.runways.includes(s.runway)&&y(s.begin)>=0&&y(s.end)<=plotHeight)" :key="s.id" class="closure-gap" :class="{right:s.runway===g.runways[1],adjusting:gapDrag?.id===s.id}" :data-gap="s.id" :style="gapStyle(s)" :title="`${s.runway.split('/')[1]} closed ${utc(s.begin,true)}–${utc(s.end,true)} UTC`">
                            <button v-if="y(s.end)>=0" class="gap-handle end" data-gap-handle="end" :disabled="!editable" :aria-label="`Drag closure end for ${s.runway.split('/')[1]}`" @pointerdown.stop="startGapDrag(s.id,'end',$event)" @click.stop><span>{{utc(s.end,true)}} END</span></button>
                            <button class="gap-body" data-gap-handle="move" :aria-label="`Move closure for ${s.runway.split('/')[1]}`" @pointerdown.stop="startGapDrag(s.id,'move',$event)" @click.stop="gapClick(s.id)"><span>CLOSED <small>{{((s.end-s.begin)/60000).toFixed(1)}}m</small></span></button>
                            <button v-if="y(s.begin)<=plotHeight" class="gap-handle begin" data-gap-handle="begin" :disabled="!editable" :aria-label="`Drag closure start for ${s.runway.split('/')[1]}`" @pointerdown.stop="startGapDrag(s.id,'begin',$event)" @click.stop><span>{{utc(s.begin,true)}} START</span></button>
                        </div>
                        <button v-for="f in visibleFlights.filter(f=>groupOf(f)===g.id&&y(displayedTime(f))>=0&&y(displayedTime(f))<=plotHeight)" :key="f.callsign" class="flight" :class="{right:rightSide(f),boxed:selected===f.callsign||recomputeSelection.includes(f.callsign),movable:movable(f),dragging:drag?.callsign===f.callsign&&drag.moved}" :data-callsign="f.callsign" :data-state="STATE_NAMES[f.state]" :style="{top:`${dragPosition(f)}px`,color:stateColor(f)}" :title="`${f.callsign} · ${STATE_NAMES[f.state]} · ETA ${utc(f.eta)} · STA ${f.state===0?'not stable':utc(f.sta)} · ${f.delay<0?'TTG':'TTL'} ${Math.abs(f.delay)}s`" @click.stop="flightClick(f,$event)" @pointerdown.stop="startDrag(f,$event)">
                            <span v-if="labels.currentDelay&&delayLabel(f.delay)" class="delay" :style="{color:delayColor(f.delay)}">{{delayLabel(f.delay)}}</span><span v-if="labels.totalDelay">{{Math.round(f.totalDelay/60)}}</span><span v-if="labels.type" class="type">{{f.aircraft}}</span><span class="wake" :title="`Wake turbulence category: ${f.wake||'?'}`">{{f.wake||'?'}}</span><span v-if="labels.feeder">{{f.ff}}</span><span v-if="labels.runway">{{rwy(f).split('/')[1]}}</span><strong>{{f.callsign}}</strong><span class="ff-time" :title="f.state===0?'No stable time yet':`${view==='Runway'?'Scheduled landing':'Scheduled feeder crossing'} ${utc(view==='Runway'?f.sta:f.staFf,true)} UTC`">{{f.state===0?'—':minutes(f.state===4||view==='Runway'?f.sta:f.staFf)}}</span><span v-if="f.spacingConflict" class="conflict" title="Check spacing after this sequence change">!</span>
                        </button>
                    </div>
                    <div class="timeline-foot"><span class="foot-left">{{view==='Runway'?g.runways[0].split('/')[1]:g.name}}</span><button class="column-clock" @click="dialog='labels'">{{utc(now,true)}}</button><span class="foot-right">{{view==='Runway'?g.runways[1].split('/')[1]:''}}</span></div>
                </div>
            </div>
        </div>
    </div>
    <div class="horizontal-slider"><span>◀</span><input type="range" v-model.number="horizontalPosition" :max="horizontalMax" min="0" step="1" :disabled="horizontalMax===0" aria-label="Scroll between timeline columns" @input="scrollHorizontal"><span>▶</span></div>
    <footer class="status-line"><button @click="openDialog('setup')">ESSA · {{demo?'DEMO':localPreview?'STANDALONE LIVE':isMaster?'MASTER':'SLAVE'}}</button><span title="Application and live engine build">{{applicationBuild}}</span><span v-if="!demo&&stale">STALE</span><label><input v-model="bridge" type="checkbox" @change="publishTiming">EuroScope</label><span>{{bridgeStatus}}</span></footer>
    <div v-if="error" class="message" role="alert">{{error}} <button @click="error=''">×</button></div><button v-if="diagnosticFlights.length" class="diagnostics" @click="dialog='diagnostics'">{{diagnosticFlights.length}} route prediction issue(s) · review</button>
    <div v-if="selectionBox" class="recompute-box" :style="selectionBox" aria-hidden="true"></div>
    <div v-if="menu==='recompute'" class="popup recompute-menu" @mouseleave="closeFieldMenu" :style="{left:`${popupPosition.x}px`,top:`${popupPosition.y}px`}">
        <div class="menu-title">{{recomputeSelection.length}} aircraft selected<button @click="closeFieldMenu">×</button></div>
        <button data-action="recompute-selection" :disabled="!editable" @click="recomputeFlights(recomputeSelection)">Recompute</button>
    </div>
    <div v-if="menu==='flight'&&current" class="popup flight-menu" @mouseleave="closeFieldMenu" :style="{left:`${popupPosition.x}px`,top:`${popupPosition.y}px`}">
        <div class="menu-title">{{current.callsign}} · {{STATE_NAMES[current.state]}}<button @click="menu=''">×</button></div>
        <button data-menu="information" @click="openDialog('information')">Information</button><button data-menu="recompute" :disabled="!editable" @click="recomputeFlights([current.callsign])">Recompute</button><button data-menu="runway" :disabled="!editable" @click="openDialog('runway')">Change Runway ▸</button><button data-menu="arrival-profile" :disabled="!editable" @click="openDialog('arrival-profile')">Arrival route ▸</button><button data-menu="slot" :disabled="!editable" @click="openDialog('flight-slots')">Insert Slot ▸</button><button data-menu="desequence" :disabled="!editable" @click="editFlight({mode:'desequenced'})">De-sequence</button><button data-menu="missed" :disabled="!editable" @click="editFlight({mode:'missed'})">Missed approach</button><button v-if="current.state!==4" data-menu="landed" :disabled="!editable" @click="editFlight({landedAt:now})">Mark landed</button><button data-menu="remove" :disabled="!editable" @click="editFlight({mode:'removed'})">Remove</button>
        <small v-if="current.missedRecovery">Resumed missed approach · drag to re-sequence</small><small v-else-if="current.state===3">Frozen · manual sequence changes disabled</small><small v-else-if="locked(current)">Super Stable · drag between aircraft to change order</small>
    </div>
    <div v-if="menu==='timeline'" class="popup timeline-menu" @mouseleave="closeFieldMenu" :style="{left:`${popupPosition.x}px`,top:`${popupPosition.y}px`}"><div class="menu-title">{{slotDraft.runway}} · {{slotDraft.start}} UTC<button @click="menu=''">×</button></div><button data-menu="add-flight" @click="insertCallsign='';dialog='insert';menu=''">Manually add flight</button><button data-menu="closure" @click="openDialog('slot')">Add runway closure gap</button></div>
    <div v-if="dialog" class="dialog-shade" :class="{'movable-dialog-shade':movableDialog}" @click.self="dialog=''">
        <div class="native-dialog" :class="{'movable-dialog':movableDialog}" :style="dialogStyle" @mouseleave="leaveDialogMenu" :data-dialog="dialog">
            <div class="dialog-title" @pointerdown="startDialogDrag">{{dialog==='configuration'?'RUNWAY CONFIGURATION':dialog==='information'?current?.callsign:dialog.toUpperCase()}}<button @click="dialog=''">×</button></div>
            <template v-if="dialog==='setup'"><p>Airport <strong>ESSA</strong></p><button @click="chooseMode('DEMO')">Demo</button><button @click="chooseMode('MASTER')">{{localPreview?'Standalone live · EuroScope':'MASTER · Web + Local'}}</button><button v-if="!localPreview" @click="chooseMode('SLAVE')">SLAVE · Web + Local</button><p>{{localPreview?'Local testing is on this PC only.':'Shared sequence is provided by vatIRIS.'}}</p></template>
            <template v-else-if="dialog==='configuration'||dialog==='rates'">
                <template v-if="dialog==='configuration'"><label>Arrival runway <select data-input="arrival-runway" v-model="draftArrival"><option v-for="r in RUNWAYS.filter(r=>r.startsWith('ESSA/'))" :key="r" :value="r">{{r.split('/')[1]}}</option></select></label><label>Departure runway <select data-input="departure-runway" v-model="draft.departureRunway"><option v-for="r in RUNWAYS.filter(r=>r.startsWith('ESSA/'))" :key="r" :value="r">{{r.split('/')[1]}}</option></select></label></template>
                <div class="rate-row"><label>Arrival rate<br>{{rateRunway.split('/')[1]}}</label><input type="range" min="30" max="600" step="1" v-model.number="draftRateSeconds" @input="draftApplyRate=true" :aria-label="`${rateRunway} landing interval`"><output>{{Math.round(3600/draftRateSeconds)}} / h<br>{{draftRateSeconds}} s · {{rateDistanceNm(draftRateSeconds,rateRunway,draft).toFixed(1)}} NM</output></div>
                <div class="apply-row"><label for="aman-apply-slider">{{applyMinutes===0?'Apply now':`Apply at ${utc(applyAt)} UTC`}}</label><input id="aman-apply-slider" data-input="apply-time-slider" aria-label="Change application time" type="range" min="0" max="60" step="1" v-model.number="applyMinutes"><span class="apply-range"><span>Now</span><span>+60 min</span></span></div><p v-if="dialog==='configuration'">Arrival first, departure second. The rate applies to arrivals only.</p><button v-if="dialog==='configuration'?nextConfiguration:config.pendingRate&&config.pendingRate.at>now" data-action="cancel-planned-change" :disabled="!editable" @click="cancelPlannedChange">Cancel scheduled change</button><button data-action="save-rates" :disabled="!editable" @click="saveRates">{{(dialog==='configuration'?nextConfiguration:config.pendingRate&&config.pendingRate.at>now)?'Update change':'Apply'}}</button><button @click="dialog=''">Close</button>
            </template>
            <template v-else-if="dialog==='arrival-profile'&&current"><label>Arrival route <select data-input="arrival-profile" v-model="arrivalProfileDraft"><option value="">Auto from filed STAR / feeder</option><option v-for="profile in STAR_PROFILES.filter(p=>p.runway===rwy(current!).split('/')[1])" :key="profile.id" :value="profile.id">{{profile.procedure}} · {{profile.feeder}}</option></select></label><button data-action="save-arrival-profile" @click="editFlight({arrivalProfile:arrivalProfileDraft||undefined,recomputeAt:now,target:undefined});dialog=''">Apply and recompute</button></template>
            <template v-else-if="dialog==='information'&&current"><table><tbody><tr><th>Flight</th><td>{{current.callsign}} {{current.aircraft}}/{{current.wake}}</td></tr><tr><th>Route</th><td>{{current.departure}} → {{current.arrival}} {{rwy(current)}}{{current.runwaySource==='active'?' · active runway (not filed)':''}}</td></tr><tr><th>Entry point</th><td>{{current.ff}}</td></tr><tr><th>Initial / current ETA</th><td>{{utc(current.initialEta,true)}} / {{utc(current.eta,true)}}</td></tr><tr><th>Current ETA FF / STA FF</th><td>{{utc(current.etaFf,true)}} / {{current.state===0?'—':utc(current.staFf,true)}}</td></tr><tr><th>STA RWY</th><td>{{current.state===0?'No stable time':utc(current.sta,true)}}</td></tr><tr><th>Total / remaining delay</th><td>{{Math.round(current.totalDelay/60)}} / {{Math.round(current.delay/60)}} min</td></tr><tr v-if="current.separation"><th>Spacing behind {{current.separation.leader}}</th><td>{{current.separation.wakeNm}} NM wake · {{Math.round(current.separation.wakeSeconds)}}s required · {{Math.round(current.separation.scheduledSeconds)}}s planned</td></tr><tr v-if="current.feederDelayMs"><th>Feeder spacing</th><td>{{Math.round(current.feederDelayMs/60/1000)}} min required before {{current.ff}}</td></tr><tr><th>Route time difference</th><td>{{Math.round((current.runwayDelay??current.delay)/60)}} min</td></tr><tr v-if="current.state===4&&current.scheduledBeforeLanding"><th>Assigned time before landing</th><td>{{utc(current.scheduledBeforeLanding,true)}}</td></tr><tr v-if="current.state===4"><th>Confirmed landing</th><td>{{utc(current.sta,true)}}</td></tr><tr><th>Initial ETA FF</th><td>{{utc(current.initialEtaFf ?? current.etaFf,true)}}</td></tr><tr><th>Prediction</th><td>{{current.predictionSource || 'route'}}{{current.vectorDetection?` · ${current.vectorDetection}`:''}}</td></tr><tr v-if="current.distanceProfile"><th>Workbook path</th><td>{{current.distanceProfile.procedure}} · {{current.distanceProfile.runway}}<br>{{current.distanceProfile.method}}: {{current.distanceProfile.fullNm}} NM · {{current.distanceProfile.sourceRange}}</td></tr><tr v-if="current.distanceProfile"><th>Remaining distance</th><td>{{current.distanceProfile.beforeFeederNm.toFixed(1)}} NM to feeder + {{current.distanceProfile.remainingNm.toFixed(1)}} NM to runway{{current.distanceProfile.shortcut?' · direct-to':''}}</td></tr><tr v-if="current.distanceProfile"><th>STAR source</th><td>{{STAR_SOURCE.file}}</td></tr><tr><th>State</th><td>{{STATE_NAMES[current.state]}}</td></tr><tr v-if="current.spacingConflict"><th>Spacing</th><td>Check spacing after the sequence change</td></tr></tbody></table></template>
            <template v-else-if="dialog==='runway'&&current"><button v-for="r in RUNWAYS.filter(r=>r.startsWith(current!.arrival+'/'))" :key="r" :disabled="!editable" @click="editFlight({runway:r,arrivalProfile:undefined,recomputeAt:now,target:undefined});dialog=''">{{r.split('/')[1]}}</button></template>
            <template v-else-if="dialog==='flight-slots'"><label>Before flight (min) <input v-model.number="flightSlots.before" type="number" min="0" max="999"></label><label>After flight (min) <input v-model.number="flightSlots.after" type="number" min="0" max="999"></label><button @click="editFlight({slotBefore:flightSlots.before,slotAfter:flightSlots.after});dialog=''">Apply</button><button @click="openFlightGap">Runway closure gap</button></template>
            <template v-else-if="dialog==='insert'"><label>Callsign <input data-input="manual-callsign" v-model="insertCallsign" @keydown.enter="insertFlight" placeholder="SAS123"></label><label>Runway <select v-model="slotDraft.runway"><option v-for="r in RUNWAYS.filter(r=>r.startsWith('ESSA/'))" :key="r">{{r}}</option></select></label><label>Arrival UTC <input type="time" v-model="slotDraft.start"></label><label>Aircraft <input v-model="manualAircraft" placeholder="UNKN"></label><label>Wake <select v-model="manualWake"><option v-for="w in ['?','L','M','H','J']" :key="w">{{w}}</option></select></label><label>Entry point <select v-model="manualFeeder"><option v-for="fix in entryPoints" :key="fix">{{fix}}</option></select></label><button data-action="insert-flight" @click="insertFlight">Add flight</button><button @click="dialog=''">Cancel</button></template>
            <template v-else-if="dialog==='slot'"><label>Runway <select v-model="slotDraft.runway"><option v-for="r in RUNWAYS.filter(r=>r.startsWith('ESSA/'))" :key="r">{{r}}</option></select></label><label>Begin UTC <input data-input="gap-start" type="time" v-model="slotDraft.start"></label><label>Duration (min) <input data-input="gap-duration" v-model.number="slotDraft.duration" type="number" min="1" max="1440"></label><button data-action="save-gap" @click="saveSlot">Apply</button><button v-if="slotDraft.id" data-action="delete-gap" @click="commit(edits,{...config,slots:config.slots.filter(s=>s.id!==slotDraft.id)});dialog=''">Remove gap</button><button @click="dialog=''">Cancel</button></template>
            <template v-else-if="dialog==='desequenced'||dialog==='missed'"><label v-for="f in unsequenced.filter(f=>dialog==='desequenced'||f.mode==='missed')" :key="f.callsign"><input v-model="listSelection" type="checkbox" :value="f.callsign">{{f.callsign}}</label><p v-if="!unsequenced.length">No flights</p><button :disabled="!editable||!listSelection.length" @click="resumeList()">Resume</button><button :disabled="!editable||!listSelection.length" @click="resumeList(true)">Remove</button></template>
            <template v-else-if="dialog==='diagnostics'"><p v-for="f in diagnosticFlights" :key="f.callsign">{{f.callsign}} — {{f.issue}} <button :disabled="!editable" @click="recomputeFlights([f.callsign])">Recompute</button></p></template>
        </div>
    </div>
</section>
</template>

<style scoped>
.juha-aman{background:#495055;color:#c8c8c8;font:10px 'Lucida Console',Consolas,monospace;height:100%;min-height:360px;display:flex;flex-direction:column;position:relative;overflow:hidden}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible{outline:1px solid #ccefff}.toolbar{display:flex;gap:3px;padding:3px;background:#8b9aa4;color:#122129;min-height:49px;border:1px solid #a8b3bb}.toolbar>button{border:1px solid #a3afb5;background:transparent;color:inherit;padding:3px 6px;display:flex;flex-direction:column;gap:4px;text-align:left}.configuration-button{min-width:74px;max-width:135px}.rate-button{flex:1;font-size:10px}.rate-button span{display:inline-block}.tracks{padding:3px;line-height:1.8;white-space:nowrap}.updated{align-self:center;padding:3px;font-size:9px}.pending-change{padding:3px 6px;background:#687780;color:#fff;font-size:9px}.pending-change button{float:right}.view-buttons{display:flex;gap:3px;padding:4px 3px;flex-wrap:wrap}.view-buttons button{border:1px solid #8b9ca7;border-radius:8px;padding:0 6px;min-height:17px;font-size:9px;line-height:12px;background:#8a979e;color:#15252d;white-space:nowrap}.view-buttons button.active{background:#8bb4cf;color:#eef8ff}.display{flex:1;min-height:220px;display:flex;overflow:hidden}.time-overview{width:17px;position:relative;flex:none;border:1px solid #7e8a91;background:#68747b;text-align:center;font-size:8px;padding-top:4px}.time-overview i{position:absolute;left:0;right:0;border-top:2px solid #ff3030}.horizontal-scroll{overflow-x:auto;overflow-y:hidden;flex:1;position:relative;scrollbar-width:none}.horizontal-scroll::-webkit-scrollbar{display:none}.timeline-strip{display:flex;height:100%;position:relative;width:max-content;min-width:100%}.timeline-column{width:var(--column-width);min-width:var(--column-width);position:relative;height:100%;overflow:hidden}.column-heading{position:absolute;top:2px;left:0;right:0;display:flex;justify-content:space-around;font-size:9px;z-index:2;pointer-events:none}.column-heading .inactive{opacity:.35}.time-area{position:relative;height:calc(100% - 28px);overflow:hidden}.axis{position:absolute;width:7px;left:var(--axis-x);top:0;bottom:0;border-left:1px solid #a2abb0;border-right:1px solid #a2abb0;pointer-events:none}.tick{position:absolute;left:var(--axis-x);width:7px;height:0;border-top:1px solid #a2abb0;pointer-events:none}.tick.major{left:calc(var(--axis-x) - 5px);width:12px}.tick span{position:absolute;right:17px;top:-5px;font-size:8px;color:#aab3b9}.flight{position:absolute;right:calc(var(--column-width) / 2 + 3px);transform:translateY(-50%);display:flex;align-items:center;gap:4px;padding:1px 2px;border:1px solid transparent;background:#495055;color:#96d796;white-space:nowrap;font-size:9px;min-height:13px;max-width:calc(var(--column-width) / 2 - 5px);touch-action:none;user-select:none;z-index:3}.flight.right{left:calc(var(--axis-x) + 9px);right:auto}.flight.movable{cursor:grab}.flight.movable:active{cursor:grabbing}.flight strong{font-weight:normal;min-width:43px;text-align:right}.flight .type{font-size:8px;color:#b0b8bb}.flight .ff-time{width:14px;text-align:right}.flight .delay{font-size:8px;min-width:11px}.flight.boxed{border-color:#fffffe}.conflict{color:#ffd769}.timeline-foot{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:5px;color:#aeb7b7;font-size:8px;white-space:nowrap;height:25px}.timeline-foot button{background:#75828a;border:1px solid #a0aab0;color:#d4dfd7;border-radius:4px;padding:3px;font-size:9px}.slot{position:absolute;left:calc(var(--axis-x) - 11px);width:12px;background:#a00000cc;color:#ffc0c0;border:0;padding:0;font-size:6px;z-index:4;cursor:pointer;min-height:5px}.slot.right{left:calc(var(--axis-x) + 8px)}.now-line{position:absolute;left:0;right:0;border-top:2px solid #ff3030;z-index:2;pointer-events:none}.now-line span{position:absolute;right:2px;top:2px;font-size:8px;color:#ff8d8d;background:#495055;padding:0 3px}.drag-guide{position:absolute;left:0;right:0;border-top:1px dashed #fff;z-index:5;pointer-events:none}.horizontal-slider{display:flex;align-items:center;gap:4px;height:18px;padding:0 5px;background:#59646b;border-top:1px solid #89969d;font-size:8px}.horizontal-slider input{width:100%;height:12px;accent-color:#a2b2be;cursor:ew-resize}.status-line{font-size:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:3px 5px;border-top:1px solid #69767d;color:#b4bfc4}.status-line button{background:none;color:inherit;border:0;font-size:9px;padding:0}.status-line label{margin-left:auto}.message,.diagnostics{background:#677078;color:#ffe692;padding:5px;text-align:left;font-size:10px;border:0}.message button{float:right}.popup{position:absolute;z-index:10;background:#667780;border:1px solid #a7b4bd;color:#e5eef4;box-shadow:2px 3px 5px #252c31;width:190px}.global-menu{top:76px;left:4px;width:165px}.popup button{display:block;width:100%;background:none;color:inherit;border:0;text-align:left;padding:5px}.popup button:hover:not(:disabled){background:#387da3}.menu-title{padding:4px;background:#8a9ba7;color:#122631;font-size:9px}.menu-title button{float:right;display:inline;width:auto;padding:0}.popup small{display:block;padding:5px;font-size:8px;opacity:.8}.dialog-shade{position:absolute;inset:0;background:#17202944;z-index:20;display:flex;align-items:flex-start;justify-content:center;padding:50px 7px 7px;overflow:auto}.native-dialog{background:#788792;border:2px solid #909ea9;box-shadow:3px 4px 9px #273138;color:#12242e;max-width:100%;min-width:265px;font-size:11px;padding:7px}.dialog-title{margin:-7px -7px 8px;padding:4px;text-align:center;background:#646469;color:#f5f5f5}.dialog-title button{float:right;padding:0 4px}.native-dialog button{background:#9aa8b3;color:#142630;border:1px solid #c1c9cf;border-radius:5px;padding:3px 8px;margin:3px}.native-dialog label{display:block;margin:5px 0}.native-dialog input:not([type=checkbox]):not([type=radio]):not([type=range]),.native-dialog select{background:#aab8c2;border:1px solid #6a7984;color:#122631;padding:2px;width:100px}.native-dialog p{margin:8px 0;line-height:1.5;max-width:370px}.native-dialog table{border-collapse:collapse;font-size:10px}.native-dialog td,.native-dialog th{border:1px solid #a7b5bf;padding:5px;text-align:left}.rate-row{display:flex;gap:8px;align-items:center;margin:8px 0}.rate-row label{width:60px;white-space:nowrap}.rate-row input[type=range]{width:135px;accent-color:#bed6e4}.rate-row output{width:115px;white-space:nowrap}.apply-row{margin-top:13px;border-top:1px solid #b6c3cb;padding-top:5px}.apply-row label{display:flex;align-items:center;gap:5px}
</style>

<style scoped>
.juha-aman{font-size:13px}
.flight{font-size:13px;min-height:18px;padding:1px 3px;gap:5px;line-height:15px}
.flight strong{min-width:62px}.flight .type,.flight .delay{font-size:11px}.flight .ff-time{width:20px}
.drag-guide span{position:absolute;right:5px;top:-17px;background:#495055;padding:1px 4px;font-size:12px;color:#fff}.flight{transition:top 240ms ease-out}.flight.dragging{transition:none;z-index:8;box-shadow:0 2px 5px #17202999;cursor:grabbing}.flight .wake{font-size:12px;font-weight:bold;min-width:10px}.flight.boxed{z-index:6}.flight strong,.flight span{pointer-events:none}
.rate-button,.view-buttons button,.status-line,.status-line button,.column-heading,.menu-title{font-size:12px}
.view-buttons button{min-height:23px;line-height:19px}.updated,.pending-change,.timeline-foot,.tick span,.now-line span,.popup small{font-size:11px}
.popup{width:235px;font-size:13px}.popup button{padding:7px 8px}
.native-dialog{font-size:13px}.native-dialog table{font-size:12px}
.time-overview input{position:absolute;left:1px;top:25px;height:calc(100% - 55px);width:13px;writing-mode:vertical-lr;direction:rtl;accent-color:#a2b2be;opacity:.75;cursor:ns-resize}.time-overview span,.time-overview i{pointer-events:none}
</style>

<style scoped>
/* Compact native AMAN styling, with ESSA's single arrival/departure row. */
.juha-aman{background:#50585e;color:#d5dcdf;border:1px solid #738088;border-radius:5px;font-family:Consolas,'Lucida Console',monospace}
.toolbar{background:#8797a2;border:0;border-bottom:1px solid #a2b0b8;padding:0;gap:0;min-height:52px;color:#182c37;box-shadow:inset 0 1px #b3bec5;border-radius:4px 4px 0 0}
.toolbar>button{border:0;border-right:1px solid #aebbc3;border-radius:0;padding:8px 12px;justify-content:center;gap:4px}
.toolbar>button:hover{background:#96a7b2}.toolbar>button b{font-size:10px;letter-spacing:1px;color:#314955}
.configuration-button{min-width:112px;max-width:150px}.configuration-button span{font-size:15px;font-weight:bold}
.rate-button{flex:1;font-size:14px}.rate-button span{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.rate-button small{font-size:11px;color:#2d4858}
.toolbar .tracks{font-size:11px;border-right:1px solid #a9b6be;min-width:56px;padding:7px 9px;line-height:1.55}.updated{padding:8px;color:#334e5e;font-size:11px}
.view-buttons{background:#50585e;padding:5px 4px;gap:4px;border-top:1px solid #647078}
.view-buttons button{background:#84939d;border:1px solid #a4b0b8;border-radius:9px;font-size:11px;min-height:21px;line-height:17px;padding:0 9px;box-shadow:inset 0 1px #bbc5cb;color:#152b38}
.view-buttons button.active{background:#87a9bd;color:#eff8fc;border-color:#bad0dc}.view-buttons button:hover{filter:brightness(1.1)}
.time-area,.flight{background:#50585e}.axis{background:#64727b33;border-color:#a8b5bd}.tick{border-color:#a8b5bd}.tick span{color:#bbc6cb;font-size:10px}.column-heading{font-size:11px;color:#d0dbe1;letter-spacing:.4px}.column-heading .inactive{opacity:.45}
.time-overview{background:#5e6c76;border-color:#8799a4;border-radius:3px;width:19px}.timeline-foot{color:#c0cbd0;border-top:1px solid #68777f;font-size:10px}.timeline-foot button{background:#75858f;border-color:#9cabb4;border-radius:4px;color:#e4ecef;padding:3px 5px;font-size:11px}
.now-line{border-color:#f04f57}.now-line span{background:#50585e;color:#ffb1b6}.status-line{background:#48545c;font-size:10px;border-color:#6d7f89;padding:4px 6px}.horizontal-slider{background:#5b6973;border-color:#7e909b}
.popup{background:#697e8a;border-color:#a8bdc8;border-radius:3px;box-shadow:3px 5px 12px #17202970}.menu-title{background:#92a6b2;padding:6px;font-size:12px}.native-dialog{background:#859aa7;border-color:#adbec8;border-radius:4px}.dialog-title{background:#5d7482;color:#f1f6f8;padding:6px}
.closure-gap{position:absolute;left:calc(var(--axis-x) - 113px);width:104px;background:repeating-linear-gradient(135deg,#a8515140 0 5px,#d5797938 5px 10px);border-left:2px solid #db8b83;border-right:1px solid #b97470;border-radius:2px;z-index:7;touch-action:none;user-select:none}
.closure-gap.right{left:calc(var(--axis-x) + 12px)}.closure-gap.adjusting{box-shadow:0 0 0 1px #f4c3a8;z-index:9}
.gap-body{position:absolute;inset:0;width:100%;height:100%;background:transparent;border:0;color:#ffe1d5;padding:0;display:flex;align-items:center;justify-content:center;gap:6px;cursor:grab;touch-action:none;font-size:10px;font-weight:bold}
.gap-body>span{position:absolute;left:calc(100% + 5px);top:50%;transform:translateY(-50%);background:#654746;border:1px solid #c98b7d;border-radius:3px;padding:3px 5px;white-space:nowrap;box-shadow:1px 2px 4px #1a232744}.gap-body:active{cursor:grabbing}.gap-body small{font-size:9px;font-weight:normal}.gap-handle{position:absolute;left:-2px;width:calc(100% + 3px);height:9px;border:0;border-top:2px solid #efad96;background:transparent;cursor:ns-resize;touch-action:none;z-index:2;padding:0}
.gap-handle.end{top:-4px}.gap-handle.begin{bottom:-5px}.gap-handle span{position:absolute;right:0;white-space:nowrap;background:#50585eed;border-radius:2px;padding:1px 3px;color:#efc4b4;font-size:10px;pointer-events:none}.gap-handle.end span{bottom:9px}.gap-handle.begin span{top:5px}
.gap-handle:hover{border-color:#ffe5c9;background:#edb39766}.gap-body:hover{background:#b9666633}.gap-handle:disabled{cursor:default}
@media(max-width:600px){.toolbar>button{padding:7px 8px}.configuration-button{min-width:100px}.rate-button span{gap:4px}.toolbar .tracks{min-width:42px;padding:6px}.updated{display:none}}
</style>

<style scoped>
.time-anchors{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2}.time-anchors line{stroke-width:1;opacity:.8}
</style>

<style scoped>
/* Rounded boxes; retain the existing blue-grey palette. */
.toolbar{padding:4px;gap:4px;border-radius:7px 7px 0 0}.toolbar>button{border:2px solid #aebbc3;border-radius:10px;padding:7px 10px;box-shadow:none}.toolbar .tracks{border:2px solid #a9b6be;border-radius:10px;min-width:56px;padding:6px 8px}.updated{border:2px solid #a9b6be;border-radius:10px;padding:12px 8px;align-self:stretch;display:flex;align-items:center}.view-buttons{gap:7px;padding:6px 4px}.view-buttons button{border-width:2px;border-radius:9px;min-height:28px;line-height:22px;padding:0 10px;font-size:13px}.flight{z-index:10}.flight.boxed{z-index:11}.flight.dragging{z-index:12}
</style>

<style scoped>
.timeline-strip{touch-action:none;user-select:none}
.recompute-box{position:absolute;z-index:13;border:1px dashed #e5eef4;background:#8797a233;pointer-events:none}
</style>

<style scoped>
.change-time-marker{position:absolute;left:calc(var(--axis-x) - 26px);width:32px;height:2px;background:#f0e129;z-index:6;pointer-events:none;transform:translateY(-50%)}
.rate-row output{width:auto;min-width:125px;line-height:1.5}
.apply-row input[type=range]{width:100%;accent-color:#f0e129;cursor:ew-resize}
.apply-range{display:flex;justify-content:space-between;font-size:11px}
</style>

<style scoped>
.time-overview{padding:0;border-radius:8px;overflow:hidden;touch-action:none;cursor:ns-resize;user-select:none}
.time-overview:focus-visible{outline:1px solid #ccefff;outline-offset:-2px}
.overview-window{position:absolute;left:0;right:0;border:1px solid #aebbc3;border-radius:5px;background:#a2b2be44;z-index:1;cursor:grab;min-height:14px}
.overview-window:active{cursor:grabbing}
.overview-flight{position:absolute;left:2px;right:2px;height:1px;z-index:2;transform:translateY(-50%);pointer-events:none}
.time-overview .overview-now{border-top:2px solid #ff3030;z-index:3;pointer-events:none}
</style>

<style scoped>
.configuration-button{max-width:none;min-width:140px}
.pill-arrow{font-style:normal;font-size:17px;margin:0 6px;color:#f0e129}
.pill-next{font-weight:normal;white-space:nowrap}
.pill-change-time{font-size:11px;white-space:nowrap;margin-left:6px}
.configuration-button .pill-change-time{margin-left:0}
.change-time-marker.rate{height:0;background:none;border-top:2px dashed #f0e129}
</style>

<style scoped>
/* Keep all closure captions within their own runway half-column. */
.gap-body>span{left:50%;top:50%;transform:translate(-50%,-50%);max-width:calc(100% - 8px);white-space:normal;text-align:center;box-sizing:border-box;font-size:10px;padding:3px}
.gap-handle span{right:2px;max-width:calc(100% - 4px);box-sizing:border-box;font-size:9px;padding:1px;white-space:nowrap}
.gap-handle.end span{bottom:auto;top:var(--end-caption-top)}.gap-handle.begin span{top:auto;bottom:var(--begin-caption-bottom)}
</style>

<style scoped>
/* Stronger aircraft lettering, matching the reference's compact bold labels. */
.flight{font-family:Arial,Tahoma,sans-serif;font-size:14px;font-weight:600;line-height:17px;min-height:19px;padding:1px 3px;gap:5px}
.flight strong{font-size:14px;font-weight:700;min-width:65px;letter-spacing:.15px}
.flight .ff-time{font-size:14px;font-weight:700;width:21px;font-variant-numeric:tabular-nums}
.flight .wake{font-size:13px;font-weight:700}
.flight .delay,.flight .type{font-size:12px;font-weight:700}
</style>

<style scoped>
/* Use one readable type treatment throughout the AMAN, including controls. */
.juha-aman,.juha-aman :deep(*){font-family:Arial,Tahoma,sans-serif!important;font-size:14px!important;font-weight:700!important;line-height:1.25!important}
.toolbar .tracks{min-width:88px}.toolbar>button b{letter-spacing:.3px}
.tick span{top:-9px}.horizontal-slider{height:23px}.timeline-foot{height:28px}
.closure-gap{width:130px;left:calc(var(--axis-x) - 139px)}.closure-gap.right{left:calc(var(--axis-x) + 12px)}
.gap-body>span{padding:2px 3px}.gap-handle span{padding:1px 2px}
.rate-row label{width:80px}.rate-row output{min-width:145px}
.native-dialog{min-width:300px}.native-dialog table{max-width:100%}
</style>

<style scoped>
.axis{width:12px;left:calc(var(--axis-x) - 3px);background:#76838c33;border-color:#b3c0c8}
.tick{left:calc(var(--axis-x) - 3px);width:12px}.tick.major{left:calc(var(--axis-x) - 6px);width:18px}
.timeline-foot{justify-content:center;gap:7px;border-top:0}
.timeline-foot .column-clock{width:96px;min-height:25px;border:2px solid #aebbc3;border-radius:7px;background:#75858f;box-shadow:inset 0 1px #bec9cf;padding:1px 3px;font-variant-numeric:tabular-nums}
.foot-left,.foot-right{width:55px}.foot-left{text-align:right}.foot-right{text-align:left}
.movable-dialog-shade{background:transparent;pointer-events:none}.movable-dialog{pointer-events:auto}
.movable-dialog .dialog-title{cursor:move;touch-action:none;user-select:none}
</style>

<style scoped>
/* A readable ladder, with minute numbers inside its two rails. */
.axis{width:34px;left:calc(var(--axis-x) - 14px)}
.tick,.tick.major{left:calc(var(--axis-x) - 14px);width:34px}
.tick.major{border-top:0}.tick.major::before,.tick.major::after{content:'';position:absolute;top:0;width:5px;border-top:1px solid #b3c0c8}.tick.major::before{left:0}.tick.major::after{right:0}
.tick span{left:0;right:0;top:-9px;width:34px;text-align:center}
.flight{right:calc(var(--column-width) / 2 + 20px);max-width:calc(var(--column-width) / 2 - 25px)}
.flight.right{left:calc(var(--axis-x) + 27px);right:auto}
.flight,.flight:hover,.flight:focus,.flight.dragging{background:transparent!important;border-color:transparent!important;box-shadow:none!important}
.flight.boxed strong{text-decoration:underline;text-underline-offset:3px}
.scrolling-time .flight{transition:none!important}
.change-time-marker{left:calc(var(--axis-x) - 14px);width:34px}
.closure-gap{left:calc(var(--axis-x) - 151px)}.closure-gap.right{left:calc(var(--axis-x) + 27px)}
</style>

<style scoped>
.change-time-marker,.change-time-marker.rate{height:4px;background:#f0e129;border:0}
.change-time-marker.preview,.change-time-marker.rate.preview{height:0;background:none;border-top:4px dotted #f0e129}
.native-dialog select[data-input=arrival-profile]{width:100%;max-width:360px}.native-dialog td{overflow-wrap:anywhere}
</style>
