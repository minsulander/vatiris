<template>
    <div v-if="!metar" class="pa-3 text-center">NO DATA</div>
    <div
        v-else
        class="metreport"
        :class="{
            flash: changed && settings.metreportFlash,
            'flash-long': changedLong && settings.metreportFlash,
        }"
        style="height: 100%"
        @click="click"
    >
        <div class="float-right text-caption font-weight-bold text-orange-darken-4" v-if="outdated">
            {{ time.replace("T", " ") }}
        </div>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="formattedMetreport"
        ></pre>
    </div>
</template>

<script setup lang="ts">
import { useMetarStore } from "@/stores/metar"
import { useSettingsStore } from "@/stores/settings"
import { useWxStore } from "@/stores/wx"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"

const props = defineProps<{ id: string }>()

const wx = useWxStore()
const metarStore = useMetarStore()
const settings = useSettingsStore()

const time = computed(() => metarStore.time)
const metar = computed(() => metarStore.metar[props.id])
const formattedMetreport = computed(() => {
    let metreport = metarStore.formattedMetreport(props.id)
    const qnhTrend = metarStore.qnhTrend(props.id)
    if (typeof qnhTrend != "undefined") {
        const trend =
            qnhTrend > 0
                ? " <div style='display: inline-block; transform: rotate(-90deg);'><i class='mdi mdi-play'></i></div>"
                : qnhTrend < 0
                  ? " <div style='display: inline-block; transform: rotate(90deg);'><i class='mdi mdi-play'></i></div>"
                  : " <i class='mdi mdi-play'></i>"
        metreport = metreport.replace('id="qnh-trend">', `'id="qnh-trend">${trend}`)
    }
    return metreport
})

const changed = ref(false)
const changedLong = ref(false)
const outdated = ref(false)

let wxSubscription = ""
let metarSubscription = ""

onMounted(() => {
    wxSubscription = wx.subscribe(props.id)
    metarSubscription = metarStore.subscribe(props.id)
})

onUnmounted(() => {
    if (wxSubscription) wx.unsubscribe(wxSubscription)
    if (metarSubscription) metarStore.unsubscribe(metarSubscription)
})

let changeTimeouts: any[] = []

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = changedLong.value = false
}

const firstUpdate = ref(true)

watch(
    () => metarStore.formattedMetreport(props.id),
    (newValue, oldValue) => {
        if (firstUpdate.value) {
            firstUpdate.value = false
            return
        }
        changed.value = false
        if (!settings.metreportFlash) return
        if (oldValue && !oldValue.includes("Loading") && newValue != oldValue) {
            changed.value = true
        }
        if (changed.value) {
            changeTimeouts.splice(0)
            changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
            changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
            changeTimeouts.push(
                setTimeout(() => {
                    changed.value = false
                    changedLong.value = true
                }, 3000),
            )
            changeTimeouts.push(
                setTimeout(() => {
                    changed.value = false
                    changedLong.value = false
                }, 63000),
            )
        }
    },
)
</script>

<style scoped>
.metreport.flash {
    background-color: #33f;
    color: #ddd;
    transition:
        background-color 0.5s,
        color 0.5s;
}
.metreport.flash-long {
    color: #33f;
    transition: color 0.5s;
}
</style>
