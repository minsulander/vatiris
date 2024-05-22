<template>
    <div v-if="wx.noData(props.id)" class="pa-3 text-center">
        NO DATA
    </div>
    <div class="metreport" v-else :style="changed ? 'background-color: #33f; color: #ddd' : ''" style="height: 100%">
        <div class="float-right text-caption text-grey-darken-2">
            {{ time.replace("T", " ") }}
        </div>
        <pre class="pa-1" style="font-size: 14px; line-height: 16px; white-space: pre-wrap" v-html="rwy"></pre>
        <pre class="pa-1" style="font-size: 14px; line-height: 16px; white-space: pre-wrap" v-html="metreport"></pre>
        <pre class="pa-1" style="font-size: 14px; line-height: 16px; white-space: pre-wrap" v-html="info"></pre>
        <pre class="pa-1" style="font-size: 14px; line-height: 16px; white-space: pre-wrap" v-html="metar"></pre>
    </div>
</template>

<style>
.metreport {
    transition: background-color 0.25s, color 0.25s;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue"
import { useWxStore } from "@/stores/wx";

const props = defineProps<{ id: string }>()

const wx = useWxStore()

const time = computed(() => wx.time(props.id))
const rwy = computed(() => wx.rwy(props.id))
const metreport = computed(() => wx.metreport(props.id))
const info = computed(() => wx.info(props.id))
const metar = computed(() => wx.metar(props.id))

const changed = ref(false)

let subscription = ""

onMounted(() => {
    subscription = wx.subscribe(props.id)
})

onUnmounted(() => {
    wx.unsubscribe(subscription)
})

watch([rwy, metreport, info, metar], (newValues, oldValues) => {
    if (oldValues.find(v => v.length > 0)) {
        changed.value = true
        setTimeout(() => changed.value = false, 1000)
        setTimeout(() => changed.value = true, 2000)
        setTimeout(() => changed.value = false, 3000)
    }
})
</script>
