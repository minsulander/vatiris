<template>
    <div ref="rootEl" class="striptv-essa" :class="{ 'compact-chrome': compactChrome, 'combine-bays': combineBays }">
        <header class="striptv-header">
            <div v-if="!compactChrome" class="hdr-left">
                <div class="hdr-icon" aria-hidden="true">
                    <v-icon icon="mdi-airplane-takeoff" size="30" />
                </div>
                <div class="hdr-text">
                    <div class="hdr-title">DEPARTURES</div>
                    <div class="hdr-sub">Stockholm Arlanda</div>
                </div>
            </div>
            <div class="hdr-center">
                <div class="hdr-rwy">
                    {{ clockHour }}: ARR {{ ops?.runwayInUse?.arr || "—" }} / DEP
                    {{ ops?.runwayInUse?.dep || activeDepRunway || "—" }}
                </div>
                <div class="hdr-sep">
                    <div class="sep-cell">
                        <div class="sep-label">SEP</div>
                        <div class="sep-val">{{ fmtSep(sep?.sep) }}</div>
                    </div>
                    <div class="sep-cell">
                        <div class="sep-label">DLV</div>
                        <div class="sep-val">{{ fmtSep(sep?.dlv) }}</div>
                    </div>
                    <div class="sep-cell">
                        <div class="sep-label">DEP GAP</div>
                        <div class="sep-val">{{ fmtSep(sep?.depGap) }}</div>
                    </div>
                    <div class="sep-cell">
                        <div class="sep-label">INFO</div>
                        <div class="sep-val" :class="{ 'no-efs': sep?.info === 'NO EFS' }">
                            {{ sep?.info?.trim() ? sep.info : "—" }}
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="!compactChrome" class="hdr-right">
                <div
                    class="hdr-clock"
                    :class="{ outdated: dataOutdated }"
                    :title="dataOutdated ? 'Data older than 5 minutes' : 'Latest received data'"
                >
                    {{ clock }}
                </div>
                <img class="hdr-logo" src="/striptv-arrow-logo.png" alt="" aria-hidden="true" />
            </div>
        </header>
        <div class="striptv-cols">
            <section v-for="col in displayColumns" :key="col.id" class="striptv-col">
                <div class="col-head">{{ col.heading }}</div>
                <div
                    class="col-body"
                    :ref="(el) => setBayBodyRef(col.id, el)"
                    @wheel.prevent
                >
                    <!-- Last→first in DOM; scroll pinned to bottom so #1 stays visible -->
                    <StripCard
                        v-for="f in [...col.flights].reverse()"
                        :key="f.callsign"
                        :flight="f"
                    />
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch,
    type ComponentPublicInstance,
} from "vue"
import { useStripDepartures, type StripFlight } from "@/composables/useStripDepartures"
import { useWxOpsStore } from "@/stores/wxOps"
import { useEsdataStore } from "@/stores/esdata"
import { useEfsStore } from "@/stores/efs"
import StripCard from "./StripCard.vue"
import moment from "moment"

/** Same freshness window as IRIS met reports (MetreportWX / Windrose). */
const DATA_STALE_MS = 5 * 60 * 1000

const columnDefs = [
    { id: "TWR-W", title: "TWR-W" },
    { id: "TWR-E", title: "TWR-E" },
]

/** Hide DEPARTURES + clock below this width */
const CHROME_COMPACT_PX = 640
/** Merge TWR-W/E into one bay below this width */
const BAYS_COMBINE_PX = 780

const wxOps = useWxOpsStore()
const esdata = useEsdataStore()
const efs = useEfsStore()

const { columns, ops, sep, activeDepRunway } = useStripDepartures({
    icao: "ESSA",
    view: "DEP",
    mode: "essa-twr",
    columnDefs,
})

function fmtSep(v: number | string | undefined) {
    if (v === undefined || v === null || v === "") return "—"
    return String(v).replace(/\s*nm\s*/gi, "").trim() || "—"
}

watch(
    activeDepRunway,
    (rwy) => {
        if (rwy) wxOps.fetch("ESSA", rwy)
    },
    { immediate: true },
)

const now = ref(moment.utc())
let tick: ReturnType<typeof setInterval> | undefined

const rootEl = ref<HTMLElement | null>(null)
const compactChrome = ref(false)
const combineBays = ref(false)
let ro: ResizeObserver | undefined
let bayRo: ResizeObserver | undefined

const bayBodies = new Map<string, HTMLElement>()

function pinBay(el: HTMLElement) {
    el.scrollTop = el.scrollHeight
}

function pinAllBays() {
    for (const el of bayBodies.values()) pinBay(el)
}

function setBayBodyRef(id: string, el: Element | ComponentPublicInstance | null) {
    if (el instanceof HTMLElement) {
        bayBodies.set(id, el)
        bayRo?.observe(el)
        requestAnimationFrame(() => pinBay(el))
    } else {
        const prev = bayBodies.get(id)
        if (prev) bayRo?.unobserve(prev)
        bayBodies.delete(id)
    }
}

onMounted(() => {
    tick = setInterval(() => {
        now.value = moment.utc()
    }, 1000)

    if (typeof ResizeObserver !== "undefined") {
        bayRo = new ResizeObserver(() => pinAllBays())
    }

    const el = rootEl.value
    if (!el || typeof ResizeObserver === "undefined") return
    const apply = (w: number) => {
        compactChrome.value = w < CHROME_COMPACT_PX
        combineBays.value = w < BAYS_COMBINE_PX
    }
    apply(el.clientWidth)
    ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? el.clientWidth
        apply(w)
        nextTick(pinAllBays)
    })
    ro.observe(el)
})
onUnmounted(() => {
    if (tick) clearInterval(tick)
    ro?.disconnect()
    bayRo?.disconnect()
    bayBodies.clear()
})

/** Newest of esdata payload times and EFS bay receive/update. */
const latestDataMoment = computed(() => {
    // Tick + store deps so clock/outdated update when data arrives or ages
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
    const efsT = efs.latestDataTime("ESSA", "DEP")
    if (efsT) {
        const m = moment.utc(efsT)
        if (m.isValid()) candidates.push(m)
    }
    if (!candidates.length) return null
    return moment.max(...candidates)
})

const clock = computed(() =>
    latestDataMoment.value ? latestDataMoment.value.format("HH:mm:ss") : "—:—:—",
)
const dataOutdated = computed(() => {
    const t = latestDataMoment.value
    if (!t) return true
    return now.value.diff(t) > DATA_STALE_MS
})
const clockHour = computed(() => now.value.format("HH"))

interface DisplayColumn {
    id: string
    heading: string
    flights: StripFlight[]
}

const displayColumns = computed((): DisplayColumn[] => {
    if (!combineBays.value) {
        return columns.value.map((c) => ({
            id: c.id,
            heading: `DEPARTURE ${c.title}`,
            flights: c.flights,
        }))
    }
    // Single bay: TWR-W then TWR-E (first of W at bottom of stack)
    const flights = columns.value.flatMap((c) => c.flights)
    return [
        {
            id: "TWR-COMBINED",
            heading: "DEPARTURE TWR-W, TWR-E",
            flights,
        },
    ]
})

watch(
    displayColumns,
    async () => {
        await nextTick()
        requestAnimationFrame(pinAllBays)
    },
    { deep: true },
)
</script>

<style scoped>
.striptv-essa {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #dddddd;
    color: #111;
    overflow: hidden;
    font-family: "Segoe UI", Tahoma, sans-serif;
}
.striptv-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    column-gap: 6px;
    padding: 5px 8px;
    background: #b6b6b6;
    border-bottom: 1px solid #8e8e8e;
    flex-shrink: 0;
    color: #000;
}
.striptv-essa.compact-chrome .striptv-header {
    grid-template-columns: 1fr;
    justify-items: center;
}
.hdr-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    justify-self: start;
}
.hdr-icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #b6b6b6;
    border: 2px solid #111;
    border-radius: 3px;
    color: #000;
    box-sizing: border-box;
    padding: 0;
}
.hdr-icon :deep(.v-icon) {
    width: 30px;
    height: 30px;
}
.hdr-text {
    min-width: 0;
}
.hdr-title {
    font-size: 18px;
    font-weight: 400;
    letter-spacing: 0.01em;
    line-height: 1.05;
}
.hdr-sub {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.1;
}
.hdr-center {
    justify-self: center;
    text-align: center;
    min-width: 0;
}
.striptv-essa.compact-chrome .hdr-center {
    justify-self: center;
}
.hdr-rwy {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.15;
}
.hdr-sep {
    margin-top: 1px;
    display: flex;
    gap: 8px;
    justify-content: center;
}
.sep-cell {
    text-align: center;
    min-width: 0;
    padding: 0 2px;
}
.sep-label {
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.1;
}
.sep-val {
    font-size: 14px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    min-height: 1.1em;
    line-height: 1.15;
}
.sep-val.no-efs {
    font-size: 12px;
}
.hdr-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding-left: 4px;
}
.hdr-clock {
    font-variant-numeric: tabular-nums;
    font-size: 20px;
    font-weight: 400;
    text-align: right;
    color: #111;
}
.hdr-clock.outdated {
    color: #c62828 !important;
}
.hdr-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
}
.striptv-cols {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 18px;
    padding: 14px 18px;
    box-sizing: border-box;
    background: #dddddd;
}
.striptv-essa.combine-bays .striptv-cols {
    max-width: 100%;
}
.striptv-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #b6b6b6;
    border: 1px solid #6e6e6e;
    border-radius: 4px 4px 0 0;
    overflow: hidden;
}
.striptv-essa.combine-bays .striptv-col {
    max-width: 100%;
}
.col-head {
    background: #252d30;
    color: #fff;
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: center;
    text-transform: uppercase;
    border-bottom: 1px solid #1a1f21;
    flex-shrink: 0;
}
.col-body {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 6px;
    background: #b6b6b6;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 4px;
}
.col-body::-webkit-scrollbar {
    display: none;
}
.col-body > :deep(*) {
    flex-shrink: 0;
}
</style>
