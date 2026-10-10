<script setup lang="ts">
import Maestro from "@/components/flight/MaestroJuha.vue"
import Window from '@/components/Window.vue'
import { useWindowsStore } from '@/stores/windows'
const windows = useWindowsStore()
if (!windows.layout['maestro-essa']) windows.layout['maestro-essa'] = {}
windows.layout['maestro-essa'].enabled = true
</script>
<template>
    <v-app-bar height="30" color="#2b2d31" elevation="0"><span class="px-3 text-grey">VatIRIS · ESSA workspace</span><v-btn size="small" @click="windows.layout['maestro-essa'].enabled = true">Open AMAN</v-btn></v-app-bar>
    <v-main style="height:100vh;background:#1e1f22"><Window v-if="windows.layout['maestro-essa'].enabled" id="maestro-essa" title="AMAN · ESSA" :width="780" :height="700" preserve-content><Maestro /></Window></v-main>
</template>
