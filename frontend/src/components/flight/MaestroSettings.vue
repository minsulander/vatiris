<script setup lang="ts">
import {ref,computed} from 'vue'
import {validateConfig,type EngineConfig} from '@/maestro-engine'
import {sharedSettings} from '@/maestro-settings'
const props=defineProps<{config:EngineConfig;revision:number;busy:boolean}>()
const emit=defineEmits<{save:[revision:number,settings:Record<string,unknown>]}>()
const draft=ref<EngineConfig|null>(null),base=ref(-1),error=ref('')
const fields:{group:string;key:keyof EngineConfig;label:string;min:number;max:number}[]=[
    {group:'Surface wind',key:'surfaceWindDirection',label:'Direction (degrees)',min:0,max:360},
    {group:'Surface wind',key:'surfaceWindSpeed',label:'Speed (kt)',min:0,max:100},
    {group:'Sequence settings',key:'unstableSeconds',label:'Initial observation (seconds)',min:0,max:3600},
    {group:'Sequence settings',key:'stableMinutes',label:'Stable: minutes to feeder',min:0,max:60},
    {group:'Sequence settings',key:'superStableMinutes',label:'Superstable: minutes to feeder',min:0,max:60},
    {group:'Sequence settings',key:'frozenMinutes',label:'Frozen: minutes to landing',min:0,max:30},
    {group:'Sequence settings',key:'minimumNewSeconds',label:'Minimum time for new arrivals (seconds)',min:0,max:3600},
    {group:'STAR timing model',key:'starApproachSpeed',label:'Approach IAS (kt)',min:100,max:350},
    {group:'STAR timing model',key:'starBaseSpeed',label:'Base IAS (kt)',min:80,max:250},
    {group:'STAR timing model',key:'landingSpeedKnots',label:'Final IAS (kt)',min:50,max:200},
    {group:'STAR timing model',key:'starBaseNm',label:'Base begins (NM to go)',min:2,max:40},
    {group:'STAR timing model',key:'starFinalNm',label:'Final begins (NM to go)',min:1,max:20},
    {group:'STAR timing model',key:'starEntryAltitude',label:'Feeder altitude (ft)',min:3000,max:25000},
    {group:'STAR timing model',key:'starDescentRate',label:'Descent rate (ft/min)',min:500,max:5000},
    {group:'STAR timing model',key:'starClimbRate',label:'Climb rate (ft/min)',min:500,max:5000},
    {group:'STAR timing model',key:'starCruiseSpeed',label:'Cruise ground speed (kt)',min:250,max:600}]
const groups=['Surface wind','Sequence settings','STAR timing model']
const labels={type:'Aircraft type',feeder:'Feeder fix',totalDelay:'Total delay',currentDelay:'Current instruction',runway:'Runway'}
const panels={winds:'Winds',rates:'Actual rates',tracks:'TMA / TOT'}
const current=computed(()=>validateConfig(props.config))
function edit(){draft.value=structuredClone(JSON.parse(JSON.stringify(current.value)));base.value=props.revision;error.value=''}
function number(key:keyof EngineConfig,event:Event){if(draft.value)(draft.value as any)[key]=Number((event.target as HTMLInputElement).value)}
function save(){try{if(draft.value)emit('save',base.value,sharedSettings(draft.value))}catch(e:any){error.value=e.message}}
defineExpose({saved:()=>{draft.value=null;error.value=''}})
</script>
<template><section class="settings"><h2>Shared supervisory settings</h2><p>Saved settings apply to every controller. Runway configuration, rates and sequencing remain in the normal AMAN.</p>
<button v-if="!draft" @click="edit">Edit shared settings</button>
<template v-if="draft"><p v-if="base!==revision" class="warning">The shared plan changed while you were editing. Reload settings before saving.</p>
<div class="groups"><fieldset v-for="group in groups" :key="group"><legend>{{group}}</legend>
<label v-if="group==='Surface wind'"><input type="checkbox" v-model="draft.surfaceWindAuto">Auto wind from EuroScope METAR</label>
<label v-for="field in fields.filter(f=>f.group===group)" :key="field.key">{{field.label}}<input type="number" :value="draft[field.key]" @input="number(field.key,$event)" :min="field.min" :max="field.max"></label>
<label v-if="group==='Sequence settings'">Vector detection<select v-model.number="draft.vectoringMode"><option :value="0">Off</option><option :value="1">After feeder</option><option :value="2">All Superstable</option></select></label>
<label v-if="group==='STAR timing model'">Distance method<select v-model="draft.starDistanceMethod"><option value="vectors">Vectors</option><option value="ese">ESE</option><option value="shortest">Shortest</option></select></label>
</fieldset><fieldset v-if="draft.displayPreferences"><legend>Shared labels and panels</legend><label v-for="(name,key) in labels" :key="key"><input type="checkbox" v-model="draft.displayPreferences.labels[key]">{{name}}</label><label v-for="(name,key) in panels" :key="key"><input type="checkbox" v-model="draft.displayPreferences.panels[key]">{{name}}</label></fieldset></div>
<p v-if="error" class="warning">{{error}}</p><button @click="save" :disabled="busy||base!==revision">Save for everyone</button><button @click="edit" :disabled="busy">Reload settings</button><button @click="draft=null" :disabled="busy">Cancel</button>
</template><p v-else>Wind {{current.surfaceWindAuto?'automatic':`${current.surfaceWindDirection}° / ${current.surfaceWindSpeed} kt`}} · feeder horizons {{current.stableMinutes}} / {{current.superStableMinutes}} min · Frozen {{current.frozenMinutes}} min · {{current.starDistanceMethod}} distance model.</p>
</section></template>
<style scoped>.settings{padding:16px;background:#5b6b75;color:#fff;font:14px Arial,sans-serif}.settings h2{font-size:18px}.groups{display:flex;flex-wrap:wrap;gap:16px}fieldset{flex:1;min-width:220px;border:1px solid #9bafb9}label{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:9px 0}input[type=number]{width:85px}input,select,button{font:inherit;padding:5px;border-radius:5px;border:1px solid #adbfc9}button{margin:6px 8px 0 0;cursor:pointer}.warning{color:#ffdf6a}button:disabled{opacity:.5}</style>
