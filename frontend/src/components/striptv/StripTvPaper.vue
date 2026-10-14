<template>
    <div class="striptv-paper">
        <div
            v-if="dataOutdated && latestDataMoment"
            class="data-age text-caption font-weight-bold text-orange-darken-4"
            title="Data older than 5 minutes"
        >
            {{ latestDataMoment.format("YYYY-MM-DD HH:mm:ss") }}
        </div>
        <div class="striptv-cols">
            <section v-for="col in columns" :key="col.id" class="striptv-col">
                <div class="col-head">{{ col.title }}</div>
                <div class="col-body" @wheel.prevent>
                    <StripCard v-for="f in col.flights" :key="f.callsign" :flight="f" paper />
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue"
import { useStripDepartures } from "@/composables/useStripDepartures"
import { useEsdataStore } from "@/stores/esdata"
import { useEfsStore } from "@/stores/efs"
import StripCard from "./StripCard.vue"
import moment from "moment"

/** Same freshness window as IRIS met reports / MetsensorWX. */
const DATA_STALE_MS = 5 * 60 * 1000

const props = withDefaults(
    defineProps<{
        icao?: string
    }>(),
    { icao: "ESGG" },
)

const columnDefs = [
    { id: "PA_TAXI", title: "PÅ TAXI" },
    { id: "PA_BANAN", title: "PÅ BANAN" },
    { id: "UTFLYGNING", title: "UTFLYGNING" },
]

const icaoRef = toRef(props, "icao")
const esdata = useEsdataStore()
const efs = useEfsStore()

const { columns } = useStripDepartures({
    icao: icaoRef,
    view: "DEP",
    mode: "paper",
    columnDefs,
})

const now = ref(moment.utc())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
    tick = setInterval(() => {
        now.value = moment.utc()
    }, 1000)
})
onUnmounted(() => {
    if (tick) clearInterval(tick)
})

const latestDataMoment = computed(() => {
    void now.value
    void esdata.data
    void esdata.lastReceivedAt
    void efs.layouts
    void efs.lastReceivedAt
    const candidates: moment.Moment[] = []
    const es = esdata.latestDataTime()
    if (es) {
        const m = moment.utc(es)
        if (m.isValid()) candidates.push(m)
    }
    const efsT = efs.latestDataTime(props.icao, "DEP")
    if (efsT) {
        const m = moment.utc(efsT)
        if (m.isValid()) candidates.push(m)
    }
    if (!candidates.length) return null
    return moment.max(...candidates)
})

const dataOutdated = computed(() => {
    const t = latestDataMoment.value
    if (!t) return true
    return now.value.diff(t) > DATA_STALE_MS
})
</script>

<style scoped>
.striptv-paper {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #c8c0d0;
    color: #eee;
    overflow: hidden;
}
.data-age {
    position: absolute;
    top: 0;
    right: 3px;
    z-index: 100;
}
.striptv-cols {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 2px;
}
.striptv-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #b8b0c0;
}
.col-head {
    background: #4a4458;
    color: #fff;
    padding: 4px 8px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
}
.col-body {
    flex: 1;
    overflow: hidden;
    overscroll-behavior: none;
    padding: 6px;
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-start;
    gap: 4px;
}
.col-body > :deep(*) {
    flex-shrink: 0;
}
</style>
