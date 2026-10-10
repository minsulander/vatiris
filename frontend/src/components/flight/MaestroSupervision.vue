<script setup lang="ts">
import {computed,ref,watch} from 'vue'


import {STATE_NAMES,STATE_COLORS,effectiveConfig,euroscopeInstruction,type EngineSnapshot,type EngineConfig,type FlightEdit} from '@/maestro-engine'
import {observeSnapshot,type SupervisionEvent} from '@/maestro-supervision'
const props=defineProps<{snapshot:EngineSnapshot|null;config:EngineConfig;edits:Record<string,FlightEdit>;now:number;revision:number;masterCid:number|null;error:string}>()

const search=ref(''),selected=ref(''),events=ref<SupervisionEvent[]>([])
let previous:EngineSnapshot|null=null
watch(()=>props.snapshot,next=>{
    if(!next)return
    if(previous&&next.timestamp<previous.timestamp)return
    events.value=[...observeSnapshot(previous,next),...(previous?.source===next.source?events.value:[])].slice(0,1000)
    previous=next
},{immediate:true})
const snapshot=computed(()=>props.snapshot)
const flights=computed(()=>[...(snapshot.value?.flights??[])].filter(f=>f.callsign.toLowerCase().includes(search.value.toLowerCase())).sort((a,b)=>a.sta-b.sta))
const current=computed(()=>snapshot.value?.flights.find(f=>f.callsign===selected.value))
const history=computed(()=>events.value.filter(e=>(!selected.value||e.callsign===selected.value)&&e.callsign.toLowerCase().includes(search.value.toLowerCase())))
const active=computed(()=>effectiveConfig(props.config,snapshot.value?.timestamp??props.now))
const stale=computed(()=>!props.snapshot||props.now-props.snapshot.timestamp>15000)
function utc(value?:number){return value===undefined||!Number.isFinite(value)?'—':new Date(value).toISOString().slice(11,19)}
function seconds(value?:number){return value===undefined||!Number.isFinite(value)?'—':`${Math.round(value)} s`}
function remaining(value:number){return seconds((value-(snapshot.value?.timestamp??props.now))/1000)}
function exportData(){
    const blob=new Blob([JSON.stringify({snapshot:snapshot.value,config:props.config,edits:props.edits,revision:props.revision,events:events.value},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ESSA-AMAN-supervision.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>
<template>

<section class="supervision">
    <header><strong>{{stale?'STALE DATA':'LIVE'}} · {{snapshot?.source||'Waiting for data'}}</strong><span>Snapshot {{utc(snapshot?.timestamp)}} UTC · age {{snapshot?seconds((now-snapshot.timestamp)/1000):'—'}} · revision {{revision}} · MASTER {{masterCid??'none'}}</span></header>
    <p v-if="error" class="warning">{{error}}</p>
    <nav><input v-model="search" aria-label="Filter supervision callsigns" placeholder="Search callsign"><button @click="exportData">Export snapshot + history</button><button @click="selected=''">All aircraft history</button></nav>
    <p class="note">Read-only · updates with the AMAN snapshot (normally every 3 seconds). History records changes observed while this supervision page is open; latest 1,000 events. Positive instruction = lose, negative = gain.</p>
    <div class="table-scroll"><table><thead><tr><th>Aircraft</th><th>State / mode</th><th>Feeder</th><th>ETA feeder</th><th>STA feeder</th><th>ETA landing</th><th>STA landing</th><th>Instruction</th><th>Prediction</th></tr></thead><tbody>
    <tr v-for="f in flights" :key="f.callsign" :class="{selected:selected===f.callsign}" @click="selected=f.callsign"><td><button @click.stop="selected=f.callsign" :style="{color:STATE_COLORS[f.state]}">{{f.callsign}} {{f.wake}}</button></td><td :style="{color:STATE_COLORS[f.state]}">{{STATE_NAMES[f.state]}}<small>{{f.mode}}{{f.lost?' · stale track':''}}</small></td><td>{{f.ff}}{{f.passedFeeder?' · passed':''}}</td><td>{{utc(f.etaFf)}}</td><td>{{utc(f.staFf)}}</td><td>{{utc(f.eta)}}</td><td>{{utc(f.sta)}}</td><td>{{seconds(f.delay)}}</td><td>{{f.predictionSource}}<small>{{f.issue}}</small></td></tr>
    <tr v-if="!flights.length"><td colspan="9">No matching aircraft in this snapshot.</td></tr></tbody></table></div>
    <div class="details"><article v-if="current"><h3>{{current.callsign}} · calculation details</h3><dl>
        <dt>Track input</dt><dd>{{current.aircraft}}/{{current.wake}} · {{current.groundspeed}} kt GS · {{current.altitude}} ft · heading {{current.heading??'—'}}° · age {{seconds(current.positionAgeSeconds)}}</dd>
        <dt>Position / clearance</dt><dd>{{current.latitude??'—'}}, {{current.longitude??'—'}} · assigned heading {{current.assignedHeading??'—'}}° · assigned speed {{current.assignedSpeed??'—'}} kt · direct {{current.direct||'—'}}</dd>
        <dt>Runway / feeder</dt><dd>{{current.arrival}}/{{current.runway}} ({{current.runwaySource||'unknown'}}) · {{current.ff}} · {{current.passedFeeder?'passed':'before fix'}} · distance {{current.feederDistanceNm?.toFixed(1)??'—'}} NM</dd>
        <dt>Prediction / vector detection</dt><dd>{{current.predictionSource}} · {{current.vectorDetection||'none'}} · vector candidate {{utc(current.vectorCandidateSince)}}</dd>
        <template v-if="current.distanceProfile"><dt>Workbook path</dt><dd>{{current.distanceProfile.procedure}} · {{current.distanceProfile.method}} · {{current.distanceProfile.fullNm}} NM · {{current.distanceProfile.sourceRange}}</dd><dt>Distance remaining</dt><dd>{{current.distanceProfile.beforeFeederNm.toFixed(1)}} NM before feeder + {{current.distanceProfile.remainingNm.toFixed(1)}} NM after feeder{{current.distanceProfile.shortcut?' · shortcut':''}}</dd></template>
        <dt>State inputs</dt><dd>Known for {{seconds(((snapshot?.timestamp??now)-current.firstSeen)/1000)}} · ETA feeder in {{remaining(current.etaFf)}} · ETA runway in {{remaining(current.eta)}} · missed recovery {{current.missedRecovery?'yes':'no'}} · ground candidate {{utc(current.groundCandidateSince)}}</dd>
        <dt>Configured phase horizons</dt><dd>Initial observation {{config.unstableSeconds}} s · Stable {{config.stableMinutes}} min to feeder · Superstable {{config.superStableMinutes}} min to feeder · Frozen {{config.frozenMinutes}} min to landing. Established states are retained until promotion or explicit recompute/recovery.</dd>
        <dt>Timing comparison</dt><dd>Initial ETA {{utc(current.initialEta)}} · current ETA {{utc(current.eta)}} · assigned landing {{utc(current.sta)}} · STA − ETA {{seconds(current.runwayDelay)}} · published instruction {{seconds(current.delay)}}</dd>
        <dt>Spacing leader</dt><dd>{{current.separation?.leader||'None'}}<template v-if="current.separation"> · {{seconds(current.separation.scheduledSeconds)}} scheduled · {{seconds(current.separation.rateSeconds)}} rate · {{seconds(current.separation.wakeSeconds)}} wake ({{current.separation.wakeNm}} NM)</template></dd>
        <dt>Engine constraint fields</dt><dd>Feeder {{seconds((current.feederDelayMs??0)/1000)}} · closure {{seconds((current.closureDelayMs??0)/1000)}} · protected wake {{seconds((current.wakeDelayMs??0)/1000)}} · protected rate {{seconds((current.rateDelayMs??0)/1000)}}. These fields can overlap; they are not an additive delay breakdown.</dd>
        <dt>Protected TMA instruction</dt><dd>{{current.tmaTiming?seconds(current.tmaTiming.delay)+' · '+(current.tmaTiming.instructionSource||'unknown source'):'Not active'}}</dd>
        <dt>EuroScope line 0</dt><dd>{{seconds(euroscopeInstruction(current))}} · {{current.line0Suppressed?'suppressed after feeder cutoff / landing':'available to TopSky'}}</dd>
        <dt>Controller edit</dt><dd><pre>{{JSON.stringify(edits[current.callsign]??{},null,2)}}</pre></dd>
        <dt>Issue</dt><dd>{{current.issue||'None'}}{{current.spacingConflict?' · spacing conflict':''}}</dd>
    </dl></article><article v-else><h3>Select an aircraft above</h3><p>Its live inputs, timing model and spacing constraints appear here.</p><p>Active arrival {{active.active.join(', ')}} · distance model {{active.starDistanceMethod}}</p></article>
    <article><h3>{{selected||'All aircraft'}} · observed changes</h3><p v-if="!history.length">No observed changes yet.</p><ol><li v-for="(e,i) in history" :key="i"><time>{{utc(e.time)}}</time> <strong>{{e.callsign}} · {{e.kind}}</strong><br>{{e.detail}}</li></ol></article></div>
</section>
</template>
<style scoped>
.supervision{height:100%;overflow:auto;background:#495055;color:#edf2f5;font:14px Arial,sans-serif;padding:12px;box-sizing:border-box}.supervision header{display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid #96a5af;padding-bottom:10px}.supervision nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.supervision button,.supervision input{font:inherit;border:1px solid #9daeb9;border-radius:7px;padding:6px 9px;background:#687e8b;color:#fff}.supervision button{cursor:pointer}.supervision .note{color:#c8d3da;font-size:13px}.warning{color:#ffd569}.table-scroll{max-height:260px;overflow:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}th{position:sticky;top:0;background:#5b707c;text-align:left}td,th{padding:8px;border-bottom:1px solid #6c7a83}td small{display:block;color:#d2dbe0}tr.selected{background:#354957}td button{background:transparent;border:0;font-weight:bold;padding:0}.details{display:grid;grid-template-columns:minmax(300px,2fr) minmax(240px,1fr);gap:20px}h3{font-size:16px}dl{display:grid;grid-template-columns:170px 1fr;gap:10px}dt{color:#c4d2db}dd{margin:0;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit;margin:0}ol{list-style:none;padding:0;max-height:500px;overflow:auto}li{border-bottom:1px solid #71818b;padding:8px 0}time{color:#b6c9d5}@media(max-width:750px){.details{grid-template-columns:1fr}}
</style>
