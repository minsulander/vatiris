<template>
    <v-app-bar color="#2b2d31" height="30" elevation="0">
        <system-menu />
        <main-menu />
        <v-spacer />
        <main-toolbar />
    </v-app-bar>
    <v-main>
        <template v-for="(win, id) in availableWindows">
            <Window
                v-if="id in windows.layout && windows.layout[id].enabled"
                :key="id"
                :id="'' + id"
                :title="win.title"
                :width="win.width"
                :height="win.height"
                :class="win.class"
            >
                <component :is="win.component" v-bind="win.props" />
            </Window>
        </template>
        <Welcome v-if="!Object.values(windows.layout).find((l) => l.enabled)" />
        <v-dialog v-model="showAboutDialog" max-width="730">
            <v-card>
                <v-card-title class="font-weight-light text-grey pl-6 pt-3">
                    <img src="/vatiris-icon2.png" style="max-width: 40px; float: right" />
                    About VatIRIS
                </v-card-title>
                <v-card-text>
                    <About />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" color="primary" @click="showAboutDialog = false"
                        >Got it</v-btn
                    >
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-main>
</template>

<script setup lang="ts">
import SystemMenu from "@/components/menu/SystemMenu.vue"
import MainMenu from "@/components/menu/MainMenu.vue"
import MainToolbar from "@/components/menu/MainToolbar.vue"
import Window from "@/components/Window.vue"
import Welcome from "@/components/Welcome.vue"
import Metreport from "@/components/met/Metreport.vue"
import MetsensorWX from "@/components/met/MetsensorWX.vue"
import Notam from "@/components/Notam.vue"
import Echarts from "@/components/Echarts.vue"
import Smhi from "@/components/met/Smhi.vue"
import Image from "@/components/Image.vue"
import ECFMP from "@/components/ECFMP.vue"
import SApush from "@/components/SApush.vue"
import DCT from "@/components/DCT.vue"
import Notepad from "@/components/Notepad.vue"
import Alias from "@/components/Alias.vue"
import Checklist from "@/components/Checklist.vue"
import MetarTaf from "@/components/met/MetarTaf.vue"
import Sun from "@/components/met/Sun.vue"
import Airport from "@/components/met/Airport.vue"
import WikiPage from "@/components/WikiPage.vue"
import WikiPdf from "@/components/WikiPdf.vue"
import { onBeforeUnmount, onMounted, onUnmounted, ref, shallowReactive } from "vue"
import { useWindowsStore } from "@/stores/windows"
import { useAuthStore } from "@/stores/auth"
import directsData from "@/data/dct/directs.json"
import { metarAirports, wxAirports } from "@/metcommon"
import GGpush from "@/components/GGpush.vue"
import OccupancyChart from "@/components/fdp/OccupancyChart.vue"
import { useWakeLock } from "@vueuse/core"
import QuickRef from "@/components/QuickRef.vue"
import Pdf from "@/components/Pdf.vue"
import About from "@/components/About.vue"
import ATCBookings from "@/components/ATCBookings.vue"
import ArrDep from "@/components/flight/ArrDep.vue"
import useEventBus from "@/eventbus"
import AircraftTypes from "@/components/icao/AircraftTypes.vue"
import Callsigns from "@/components/icao/Callsigns.vue"
import Aerodromes from "@/components/icao/Aerodromes.vue"
import Iframe from "@/components/Iframe.vue"
import Windrose from "@/components/met/Windrose.vue"
import Timer from "@/components/Timer.vue"
import TimerCreator from "@/components/TimerCreator.vue"

const apiBaseUrl = "https://api.vatiris.se"
const wikiBaseUrl = "https://wiki.vatsim-scandinavia.org"

const wakelock = useWakeLock()
const bus = useEventBus()
const auth = useAuthStore()

export interface WindowSpec {
    title: string
    component: any
    props?: any
    class?: string
    width: string | number
    height: string | number
}

const windows = useWindowsStore()

const showAboutDialog = ref(false)
const availableWindows = shallowReactive({
    notam: {
        title: "NOTAM",
        component: Notam,
        width: 600,
        height: 600,
    },
    echarts: {
        title: "eCharts",
        component: Echarts,
        width: 600,
        height: 600,
    },
    smhi: {
        title: "SMHI",
        component: Smhi,
        width: 600,
        height: 600,
    },
    swc: {
        title: "SWC NORDEN",
        component: Image,
        props: { id: "swc", src: "https://aro.lfv.se/tor/nswc2aro.gif", refresh: "3600" },
        width: 480,
        height: 700,
    },
    vfr: {
        title: "VFR",
        component: Image,
        props: { id: "vfr", src: "https://aro.lfv.se/tor/vfrkarta.gif", refresh: "3610" },
        width: 400,
        height: 690,
    },
    ECFMP: {
        title: "ECFMP Flow Measures",
        component: ECFMP,
        width: 700,
        height: 300,
    },
    SApush: {
        title: "ESSA Pushback",
        component: SApush,
        width: 700,
        height: 600,
    },
    aircrafttypes: {
        title: "Aircraft Types ICAO",
        component: AircraftTypes,
        width: 800,
        height: 400,
    },
    callsigns: {
        title: "Callsigns ICAO",
        component: Callsigns,
        width: 800,
        height: 400,
    },
    aerodromes: {
        title: "Aerodromes ICAO",
        component: Aerodromes,
        width: 800,
        height: 400,
    },
    timer: {
        title: "Timer",
        component: Timer,
        width: 155,
        height: 65,
        class: "no-resize, no-max",
    },
    timerCreator: {
        title: "Timer Creator",
        component: TimerCreator,
        width: 700,
        height: 400,
    },
    notepad: {
        title: "NOTEPAD",
        component: Notepad,
        width: 400,
        height: 500,
    },
    metartaf: {
        title: "METAR/TAF",
        component: MetarTaf,
        width: 700,
        height: 500,
    },
    alias: {
        title: "Text Alias",
        component: Alias,
        width: 650,
        height: 750,
    },
    GGpush: {
        title: "ESGG Pushback",
        component: GGpush,
        width: 575,
        height: 895,
        class: "no-max",
    },
    "quickref-esgg-twr": {
        title: "ESGG TWR",
        component: QuickRef,
        props: { ad: "ESGG", type: "TWR", src: `${wikiBaseUrl}/attachments/118?open=true` },
        width: 575,
        height: 855,
        class: "no-max",
    },
    "quickref-esgg-app": {
        title: "ESGG APP",
        component: QuickRef,
        props: { ad: "ESGG", type: "APP", src: `${wikiBaseUrl}/attachments/118?open=true` },
        width: 575,
        height: 855,
        class: "no-max",
    },
    "quickref-essb-twr": {
        title: "ESSB TWR",
        component: QuickRef,
        props: { ad: "ESSB", type: "TWR", src: `${wikiBaseUrl}/attachments/121?open=true` },
        width: 575,
        height: 872,
        class: "no-max",
    },
    "quickref-essb-app": {
        title: "ESSB APP",
        component: QuickRef,
        props: { ad: "ESSB", type: "APP", src: `${wikiBaseUrl}/attachments/121?open=true` },
        width: 575,
        height: 872,
    },
    "quickref-essa-twr": {
        title: "ESSA TWR",
        component: QuickRef,
        props: { ad: "ESSA", type: "TWR", src: `${wikiBaseUrl}/attachments/119?open=true` },
        width: 575,
        height: 808,
    },
    "quickref-essa-app": {
        title: "ESSA APP",
        component: QuickRef,
        props: { ad: "ESSA", type: "APP", src: `${wikiBaseUrl}/attachments/120?open=true` },
        width: 575,
        height: 872,
    },
    regional: {
        title: `Regional Aerodromes`,
        component: Pdf,
        props: { id: "regional", src: `${apiBaseUrl}/regional.pdf`, externalLink: true },
        width: 800,
        height: 600,
    },
    atcbookings: {
        title: "ATC Bookings",
        component: ATCBookings,
        width: 330,
        height: 420,
        class: "no-max",
    },
    arrdep: {
        title: "ARR DEP",
        component: ArrDep,
        width: 680,
        height: 400,
    },
    sectors: {
        title: "Sectors",
        component: Iframe,
        props: { src: "https://esaa-sectors.lusep.fi/" },
        width: 800,
        height: 600,
    },
    windrose: {
        title: "Windrose",
        component: Windrose,
        width: 300,
        height: 300,
    },
} as any)

for (const icao of metarAirports) {
    if (icao == "ESSA") {
        availableWindows[`metrep${icao}arr`] = {
            title: `METREPORT ${icao} ARR`,
            component: Metreport,
            props: { id: icao, type: "ARR" },
            width: 420,
            height: 380,
            class: "no-max",
        }
        availableWindows[`metrep${icao}dep`] = {
            title: `METREPORT ${icao} DEP`,
            component: Metreport,
            props: { id: icao, type: "DEP" },
            width: 420,
            height: 380,
            class: "no-max",
        }
    }
    availableWindows[`metrep${icao}`] = {
        title: `METREPORT ${icao}`,
        component: Metreport,
        props: { id: icao },
        width: 420,
        height: 380,
        class: "no-max",
    }
    availableWindows[`windrose${icao}`] = {
        title: `WINDROSE ${icao}`,
        component: Windrose,
        props: { id: icao },
        width: 400,
        height: 500,
        class: "no-max",
    }
}
for (const icao of wxAirports) {
    availableWindows[`metsen${icao}`] = {
        title: `METSENSOR ${icao}`,
        component: MetsensorWX,
        props: { id: icao },
        width: 360,
        height: 380,
        class: "no-max",
    }
}
for (const icao of metarAirports) {
    availableWindows[`sun${icao}`] = {
        title: `SUN ${icao}`,
        component: Sun,
        props: { id: icao },
        width: 340,
        height: 155,
        class: "no-max",
    }
}
for (const icao of wxAirports) {
    availableWindows[`airport${icao}`] = {
        title: `${icao}`,
        component: Airport,
        props: { id: icao },
        width: 380,
        height: 900,
        class: "no-max",
    }
}

import("@/data/aip.json").then((module) => {
    const aip = module.default as any
    for (const document of aip.enroute) {
        const id = `aip${document.prefix.replaceAll(" ", "")}`
        availableWindows[id] = {
            title: `AIP ${document.prefix} ${document.name}`,
            component: Pdf,
            props: { id, src: document.url, externalLink: true },
            width: 800,
            height: 600,
        }
    }
    for (const airport of aip.airports) {
        for (const document of airport.documents) {
            const id = `aip${document.prefix}`
            availableWindows[id] = {
                title: `AIP ${document.prefix} ${document.name}`,
                component: Pdf,
                props: { id, src: document.url, externalLink: true },
                width: 800,
                height: 600,
            }
        }
    }
})

import("@/data/wiki-pdfs.json").then((module) => {
    for (const id in module.default) {
        const pdf = (module.default as any)[id]
        availableWindows[`wikipdf-${id}`] = {
            title: pdf.title,
            component: WikiPdf,
            props: {
                id: pdf.attachmentId,
                src: `${wikiBaseUrl}/attachments/${pdf.attachmentId}?open=true`,
            },
            width: 800,
            height: 600,
        }
    }
})
import("@/data/wiki-pages.json").then((module) => {
    for (const id in module.default) {
        const page = (module.default as any)[id]
        availableWindows[`wiki-${id}`] = {
            title: page.title,
            component: WikiPage,
            props: {
                book: page.book,
                page: page.page,
                src: `${wikiBaseUrl}/books/${page.book}/page/${page.page}`,
            },
            width: 800,
            height: 600,
        }
    }
})
import("@/data/occupancy-sectors.json").then((module) => {
    for (const id in module.default) {
        const entry = (module.default as any)[id]
        availableWindows[`occupancy-${id}`] = {
            title: `${entry.title} - Occupancy`,
            component: OccupancyChart,
            props: { sectors: entry.sectors },
            width: 600,
            height: 200,
        }
    }
})

for (const name of ["open-position", "close-position", "handover-takeover", "rwy-change"]) {
    import(`@/data/checklist/${name}.json`).then((module) => {
        const checklist = module.default
        availableWindows[`checklist-${name}`] = {
            title: `Checklist - ${checklist.title}`,
            component: Checklist,
            props: { id: name, checklist },
            width: checklist.width || 600,
            height: checklist.height || 700,
        }
    })
}

for (const direct of directsData) {
    const id = direct.id.toLowerCase().replace(/\s+/g, "-")
    availableWindows[`coord-${id}`] = {
        title: `${direct.id} Directs`,
        component: DCT,
        props: { id: direct.id },
        width: 550,
        height: 700,
    }
}

function getOpenTimersFromStorage() {
    try {
        return JSON.parse(localStorage.getItem("openTimers") || "[]")
    } catch {
        return []
    }
}
function setOpenTimersToStorage(indices: number[]) {
    localStorage.setItem("openTimers", JSON.stringify(indices))
}
function addOpenTimer(idx: number) {
    const open = getOpenTimersFromStorage()
    if (!open.includes(idx)) {
        open.push(idx)
        setOpenTimersToStorage(open)
    }
}
function removeOpenTimer(idx: number) {
    const open = getOpenTimersFromStorage().filter((i: number) => i !== idx)
    setOpenTimersToStorage(open)
}

function select(id: string | object) {
    let ctrl = false
    if (typeof id == "string" && id.startsWith("ctrl+")) {
        ctrl = true
        id = id.substr(5)
    }
    if (typeof id === "string" && id.startsWith("timer:")) {
        const idx = Number(id.split(":")[1])
        addOpenTimer(idx)
        const timerWinId = `timer-${idx}` 
        auth.fetchUserData("timerData").then((data) => {
            const timers = data?.timers || []
            const timer = timers[idx]
            let title = `Timer`
            let duration = null
            let isStopwatch = true
            if (timer) {
                title = timer.name
                if (timer.duration) {
                    title += ` (${timer.duration} min)`
                    duration = timer.duration
                }
                if (timer.isStopwatch) {
                    isStopwatch = timer.isStopwatch
                }
            } else {
                title = `Timer ${idx}`
            }
            if (!(timerWinId in availableWindows)) {
                availableWindows[timerWinId] = {
                    title,
                    component: Timer,
                    width: 155,
                    height: 65,
                    class: "no-resize, no-max",
                    props: { timerIndex: idx, duration, isStopwatch: isStopwatch },
                }
            } else {
                availableWindows[timerWinId].title = title
                availableWindows[timerWinId].props = { timerIndex: idx, duration }
            }
            if (!(timerWinId in windows.layout)) {
                windows.layout[timerWinId] = { enabled: true }
            } else {
                windows.layout[timerWinId].enabled = true
            }
            windows.focusId = timerWinId
        })
        return
    }
    if (id === "timerCreator") {
        const timerCreatorId = "timerCreator"
        if (!(timerCreatorId in windows.layout)) {
            windows.layout[timerCreatorId] = { enabled: true }
        } else {
            windows.layout[timerCreatorId].enabled = true
        }
        windows.focusId = timerCreatorId
        return
    }
    if (typeof id == "object") {
        // submenu
    } else if (id in availableWindows) {
        if (ctrl && availableWindows[id].props && availableWindows[id].props.src) {
            window.open(availableWindows[id].props.src, "_blank")
        } else if (id in windows.winbox) {
            if (windows.winbox[id].min) windows.winbox[id].restore()
            windows.winbox[id].focus()
        } else {
            if (id in windows.layout) {
                windows.layout[id].enabled = true
            } else {
                windows.layout[id] = { enabled: true }
            }
        }
        windows.focusId = id
    } else if (id.startsWith && id.startsWith("https://")) {
        const [url, target] = id.split("|")
        window.open(url, target || "_blank")
    } else if (id == "about") {
        showAboutDialog.value = true
    } else {
        console.error(`Unknown menu selection: ${id}`)
    }
}

function unselect(id: string) {
    if (id.startsWith && id.startsWith("timer-")) {
        const idx = Number(id.split("-")[1])
        removeOpenTimer(idx)
    }
    if (id in windows.winbox) {
        windows.winbox[id].close()
    }
}

onMounted(() => {
    wakelock.request("screen")
    document.addEventListener("visibilitychange", onVisibilityChange)
    bus.on("select", select)
    bus.on("unselect", unselect)

    // Restore open timer windows
    const openTimers = getOpenTimersFromStorage()
    if (Array.isArray(openTimers)) {
        for (const idx of openTimers) {
            select(`timer:${idx}`)
        }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.shiftKey || e.ctrlKey) && e.key === "Escape" && windows.focusId) {
            unselect(windows.focusId)
        }
        if (
            document.activeElement?.tagName != "INPUT" &&
            document.activeElement?.tagName != "TEXTAREA" &&
            !document.activeElement?.classList.contains("ql-editor")
        ) {
            if (e.shiftKey && e.key === "ArrowLeft" && windows.focusId) {
                const winbox = windows.winbox[windows.focusId]
                if (winbox) winbox.move(0, winbox.y)
            }
            if (e.shiftKey && e.key === "ArrowRight" && windows.focusId) {
                const winbox = windows.winbox[windows.focusId]
                if (winbox) {
                    const windowWidth = window.innerWidth
                    const boxWidth = winbox.width
                    winbox.move(windowWidth - boxWidth, winbox.y)
                }
            }
            if (e.shiftKey && e.key === "ArrowUp" && windows.focusId) {
                const winbox = windows.winbox[windows.focusId]
                if (winbox) winbox.move(winbox.x, 0)
            }
            if (e.shiftKey && e.key === "ArrowDown" && windows.focusId) {
                const winbox = windows.winbox[windows.focusId]
                if (winbox) {
                    const windowHeight = window.innerHeight
                    const boxHeight = winbox.height
                    winbox.move(winbox.x, windowHeight - boxHeight)
                }
            }
        }
    }

    window.addEventListener("keydown", handleKeyDown)

    onUnmounted(() => {
        window.removeEventListener("keydown", handleKeyDown)
    })
})

function onVisibilityChange() {
    if (document.visibilityState == "visible") {
        wakelock.request("screen")
    }
}

onBeforeUnmount(() => {
    windows.unmounting = true
    document.removeEventListener("visibilitychange", onVisibilityChange)
    wakelock.release()
})

onUnmounted(() => {
    windows.unmounting = false
})
;(window as any).select = select
</script>
