<script setup lang="ts">
import {ref,watch,onUnmounted} from 'vue'
import axios from 'axios'
import {useAuthStore,backendBaseUrl} from '@/stores/auth'
import {DEFAULT_CONFIG,type EngineConfig,type EngineSnapshot,type FlightEdit} from '@/maestro-engine'
import MaestroSupervision from '@/components/flight/MaestroSupervision.vue'
import MaestroSettings from '@/components/flight/MaestroSettings.vue'
const auth=useAuthStore()
const localPreview=['localhost','127.0.0.1'].includes(location.hostname)&&(window as any).__AMAN_LOCAL_TEST__===true
const apiBase=localPreview?location.origin:backendBaseUrl
const authorized=ref(false),checked=ref(false),error=ref(''),busy=ref(false),polling=ref(false),now=ref(Date.now())
const snapshot=ref<EngineSnapshot|null>(null),config=ref<EngineConfig>(structuredClone(DEFAULT_CONFIG)),edits=ref<Record<string,FlightEdit>>({}),revision=ref(-1),masterCid=ref<number|null>(null)
const settings=ref<InstanceType<typeof MaestroSettings>>()
function headers(){return localPreview?{}:{Authorization:`Bearer ${auth.token.access_token}`}}
function receive(data:any){if(data.revision<revision.value)return;config.value=data.config;edits.value=data.edits;snapshot.value=data.snapshot;revision.value=data.revision;masterCid.value=data.masterCid}
async function poll(){
    now.value=Date.now()
    if(polling.value||busy.value||(!localPreview&&!auth.token.access_token))return
    polling.value=true
    const token=auth.token.access_token
    try{const data=(await axios.get(`${apiBase}/maestro/ESSA/supervision`,{headers:headers(),timeout:7000})).data;if(token!==auth.token.access_token)return;receive(data);authorized.value=true;checked.value=true;error.value=''}
    catch(e:any){const status=e.response?.status;if(status===401||status===403){authorized.value=false;snapshot.value=null;config.value=structuredClone(DEFAULT_CONFIG);edits.value={};revision.value=-1;checked.value=true}error.value=e.response?.data?.error||e.message||'Supervision unavailable'}
    finally{polling.value=false}
}
async function save(base:number,next:Record<string,unknown>){
    if(!authorized.value||busy.value)return
    busy.value=true
    try{receive((await axios.put(`${apiBase}/maestro/ESSA/settings`,{revision:base,settings:next},{headers:headers(),timeout:7000})).data);settings.value?.saved();error.value=''}
    catch(e:any){error.value=e.response?.data?.error||'Settings not saved'}
    finally{busy.value=false;void poll()}
}
watch(()=>auth.token.access_token,()=>{authorized.value=false;checked.value=false;snapshot.value=null;void poll()},{immediate:true})
const timer=setInterval(()=>void poll(),3000),clock=setInterval(()=>now.value=Date.now(),1000)
onUnmounted(()=>{clearInterval(timer);clearInterval(clock)})
</script>
<template><main class="supervisor-page"><header><strong>ESSA · AMAN supervision</strong><a href="/maestro" target="_blank" rel="noopener">Open normal AMAN</a><span v-if="localPreview">Local testing · this computer</span></header>
<template v-if="authorized"><MaestroSettings ref="settings" :config="config" :revision="revision" :busy="busy" @save="save"/><MaestroSupervision :snapshot="snapshot" :config="config" :edits="edits" :now="now" :revision="revision" :master-cid="masterCid" :error="error"/></template>
<section v-else class="access"><h2>{{checked?'Supervisor access required':'Sign in to AMAN supervision'}}</h2><p>{{error||'This page is restricted to authorized VATSIM CIDs.'}}</p><button v-if="!auth.token.access_token&&!localPreview" @click="auth.login()">Sign in with VATSIM</button><button v-else @click="poll">Retry access check</button></section>
</main></template>
<style scoped>.supervisor-page{position:fixed;inset:0;overflow:auto;background:#495055;color:white}.supervisor-page>header{position:sticky;top:0;z-index:2;background:#293c48;display:flex;gap:24px;padding:14px;font:16px Arial,sans-serif;align-items:center;flex-wrap:wrap}.supervisor-page a{color:#cce8ff}.access{padding:24px;font:16px Arial,sans-serif}.access button{padding:8px;font:inherit}</style>
