<template>
    <div
        style="
            height: 25px;
            margin-top: -5px;
            margin-left: -5px;
            background: #777;
            white-space: nowrap;
        "
    >
        <v-btn
            v-for="p in notamProfiles"
            :key="p"
            variant="text"
            rounded="0"
            size="small"
            :color="profile == p ? 'white' : 'grey-lighten-1'"
            :class="profile == p ? 'bg-grey-darken-1' : ''"
            @click="profile = p"
            >{{ p }}</v-btn
        >
        <span v-if="!pdf">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="header ? 'white' : 'grey-lighten-1'"
                @click="header = !header"
                >Header</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="ad.length > 0 ? 'white' : 'grey-lighten-1'"
                @click="adFilter = ''"
                >Aerodromes
                <v-menu
                    activator="parent"
                    transition="slide-y-transition"
                    :close-on-content-click="false"
                >
                    <v-list density="compact">
                        <v-list-item
                            @click="clickAdAll"
                            :class="ad.length == 1 && ad[0] == 'ALL' ? '' : 'text-grey'"
                        >
                            <v-list-item-title>ALL</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            @click="clickAdNone"
                            :class="ad.length == 0 ? '' : 'text-grey'"
                        >
                            <v-list-item-title>NONE</v-list-item-title>
                        </v-list-item>
                        <v-list-item>
                            <v-text-field
                                v-model="adFilter"
                                variant="underlined"
                                density="compact"
                                hide-details
                                autofocus
                                @keydown.esc="filterEsc"
                                @keydown.enter.stop="filterEnter"
                            />
                        </v-list-item>
                        <v-list-item
                            v-for="item in filteredAd"
                            :key="item.icao"
                            :class="ad.includes(item.icao) ? '' : 'text-grey'"
                            @click="clickAd(item.icao)"
                        >
                            <v-list-item-title>
                                {{ item.icao }}
                                <span class="text-caption">{{ item.name }}</span>
                                <span class="text-caption" v-if="item.count"
                                    >({{ item.count }})</span
                                >
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="enroute ? 'white' : 'grey-lighten-1'"
                @click="enroute = !enroute"
                >Enroute</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="nav ? 'white' : 'grey-lighten-1'"
                @click="nav = !nav"
                >Nav</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="footer ? 'white' : 'grey-lighten-1'"
                @click="footer = !footer"
                >Footer</v-btn
            >
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                :color="future ? 'white' : 'grey-lighten-1'"
                @click="future = !future"
                >Future</v-btn
            >
        </span>
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="pdf ? 'white' : 'grey-lighten-1'"
            @click="pdf = !pdf"
            >PDF</v-btn
        >
    </div>
    <div v-if="!bulletin && !error" style="height: calc(100% - 20px)">
        <v-progress-linear indeterminate color="#33f" height="5"></v-progress-linear>
    </div>
    <div v-else-if="pdf && bulletin" style="height: calc(100% - 20px)">
        <Pdf :key="pdfSrc" :id="`notam-${profile}`" :src="pdfSrc" />
    </div>
    <div
        v-else
        ref="scroller"
        style="font-size: 14px; line-height: 16px; height: calc(100% - 20px); overflow-y: auto"
    >
        <v-progress-linear
            v-if="notam.loading[profile]"
            indeterminate
            color="#33f"
            height="2"
            style="position: absolute"
        ></v-progress-linear>
        <div class="bg-error pa-3 font-weight-bold" v-if="error && !bulletin">
            Failed to load {{ profile }} NOTAMs: {{ error }}
        </div>
        <div style="width: 580px; margin-left: auto; margin-right: auto" v-if="bulletin">
            <div class="bg-warning pa-1 mt-1" v-if="bulletin.stale || error">
                Could not reach LFV, showing NOTAMs published
                {{ formatTime(bulletin.publishedAt) }}
            </div>
            <div class="pa-1 text-grey-darken-2" v-if="header">
                <div>
                    ESAA FIR {{ bulletin.profile }} 24HR PIB
                    <span class="float-right">{{ bulletin.bulletinId }}</span>
                </div>
                <div>
                    VALID {{ formatTime(bulletin.validFrom) }} - {{ formatTime(bulletin.validTo) }}
                    <span class="float-right"
                        >PUBLISHED {{ formatTime(bulletin.publishedAt) }}</span
                    >
                </div>
            </div>
            <div v-if="ad.length > 0">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">AERODROMES</h2>
                <template v-for="id in shownAd" :key="id">
                    <template v-if="adByIcao[id]">
                        <div v-if="adByIcao[id].notams.length > 0">
                            <h3 class="mb-3 pa-1 bg-grey">{{ id }} {{ adByIcao[id].name }}</h3>
                            <div
                                v-if="filteredNotams(adByIcao[id].notams).length == 0"
                                class="pa-1 mb-3 text-grey-darken-2"
                            >
                                NO NOTAMS IN EFFECT ({{ adByIcao[id].notams.length }} FUTURE)
                            </div>
                            <notam-item
                                v-for="item in filteredNotams(adByIcao[id].notams)"
                                :key="item.id || item.text"
                                :item="item"
                                :ref-exists="item.refId ? allIds.has(item.refId) : false"
                                @show-ref="showRef"
                            />
                        </div>
                        <div v-else-if="!showAll">
                            <h3 class="mb-3 pa-1 bg-grey">{{ id }} {{ adByIcao[id].name }}</h3>
                            <div class="pa-1 mb-3 text-grey-darken-2">NIL</div>
                        </div>
                    </template>
                    <div v-else>
                        <h3 class="mb-3 pa-1 bg-grey">{{ id }}</h3>
                        <div class="pa-1 mb-3 text-grey-darken-2">
                            NOT INCLUDED IN {{ profile }} BULLETIN
                        </div>
                    </div>
                </template>
            </div>
            <div v-for="section in shownSections" :key="section.title">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">{{ section.title }}</h2>
                <div
                    v-if="filteredNotams(section.notams).length == 0"
                    class="pa-1 mb-3 text-grey-darken-2"
                >
                    NIL
                </div>
                <notam-item
                    v-for="item in filteredNotams(section.notams)"
                    :key="item.id || item.text"
                    :item="item"
                    :ref-exists="item.refId ? allIds.has(item.refId) : false"
                    @show-ref="showRef"
                />
            </div>
            <pre class="pa-1 text-grey-darken-2" v-if="footer">{{ bulletin.footer }}</pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import { notamProfiles, useNotamStore, type Notam, type NotamProfile } from "@/stores/notam"
import moment from "moment"
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue"

import NotamItem from "@/components/NotamItem.vue"
import Pdf from "@/components/Pdf.vue"
import { backendBaseUrl } from "@/stores/auth"

const notam = useNotamStore()

const profile = ref("IFR" as NotamProfile)
const pdf = ref(false)
const header = ref(true)
const adByProfile = reactive({ IFR: ["ALL"], VFR: ["ALL"], HKP: ["ALL"] } as Record<
    NotamProfile,
    string[]
>)
const enroute = ref(true)
const nav = ref(true)
const footer = ref(true)
const future = ref(true)

const adFilter = ref("")
const scroller = ref<HTMLElement>()

const bulletin = computed(() => notam.bulletins[profile.value])
const error = computed(() => notam.errors[profile.value])
const pdfSrc = computed(() => (bulletin.value ? `${backendBaseUrl}${bulletin.value.pdfPath}` : ""))
const ad = computed(() => adByProfile[profile.value])
const showAll = computed(() => ad.value.length == 1 && ad.value[0] == "ALL")

const adByIcao = computed(() =>
    Object.fromEntries((bulletin.value?.aerodromes || []).map((a) => [a.icao, a])),
)

const shownAd = computed(() => (showAll.value ? Object.keys(adByIcao.value).sort() : ad.value))

const shownSections = computed(() =>
    (bulletin.value?.sections || []).filter((s) => {
        if (s.title == "EN-ROUTE") return enroute.value
        if (s.title == "NAV WARNINGS") return nav.value
        return true
    }),
)

const allIds = computed(() => {
    const ids = new Set<string>()
    for (const n of [
        ...(bulletin.value?.aerodromes || []).flatMap((a) => a.notams),
        ...(bulletin.value?.sections || []).flatMap((s) => s.notams),
    ]) {
        if (n.id) ids.add(n.id)
    }
    return ids
})

const filteredAd = computed(() => {
    const all = (bulletin.value?.aerodromes || [])
        .map((a) => ({ icao: a.icao, name: a.name, count: a.notams.length }))
        .sort((a, b) => a.icao.localeCompare(b.icao))
    if (!adFilter.value) return all
    const lower = adFilter.value.toLowerCase()
    return all.filter(
        (a) => a.icao.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower),
    )
})

const filteredNotams = (notams: Notam[]) => {
    const sorted = [...notams].sort((a, b) => (a.from?.getTime() || 0) - (b.from?.getTime() || 0))
    if (future.value) return sorted
    return sorted.filter((n) => !n.from || n.from.getTime() < Date.now())
}

function formatTime(date?: Date) {
    return date ? moment(date).utc().format("DD MMM HH:mm").toUpperCase() + "Z" : "-"
}

function clickAd(id: string) {
    const list = ad.value
    if (list.includes(id)) list.splice(list.indexOf(id), 1)
    else {
        list.push(id)
        if (list[0] == "ALL") list.splice(0, 1)
    }
}

function clickAdAll() {
    ad.value.splice(0, ad.value.length, "ALL")
}

function clickAdNone() {
    ad.value.splice(0)
}

async function showRef(id: string) {
    // The referenced NOTAM may be hidden by the current filters
    future.value = true
    const owner = bulletin.value?.aerodromes.find((a) => a.notams.some((n) => n.id == id))
    if (owner && !showAll.value && !ad.value.includes(owner.icao)) ad.value.push(owner.icao)
    const section = bulletin.value?.sections.find((s) => s.notams.some((n) => n.id == id))
    if (section?.title == "EN-ROUTE") enroute.value = true
    if (section?.title == "NAV WARNINGS") nav.value = true
    await nextTick()
    const el = scroller.value?.querySelector(`[data-notam-id="${id}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("notam-flash")
    setTimeout(() => el.classList.remove("notam-flash"), 1500)
}

let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
    loadOptions()
    if (!notam.bulletins[profile.value]) notam.fetch(profile.value)
    // The backend only re-downloads when LFV publishes a new PIB, so polling is cheap
    pollTimer = setInterval(() => notam.fetch(profile.value), 5 * 60 * 1000)
})

onUnmounted(() => clearInterval(pollTimer))

watch(profile, (p) => {
    if (!notam.bulletins[p]) notam.fetch(p)
})

watch([profile, pdf, header, adByProfile, enroute, nav, footer, future], () => {
    saveOptions()
})

function loadOptions() {
    if (!("notamOptions" in localStorage)) return
    try {
        const options = JSON.parse(localStorage.notamOptions)
        if (notamProfiles.includes(options.profile)) profile.value = options.profile
        if (options.adByProfile) {
            for (const p of notamProfiles) {
                if (Array.isArray(options.adByProfile[p])) adByProfile[p] = options.adByProfile[p]
            }
        } else if (Array.isArray(options.ad)) {
            // Options saved before profiles existed
            adByProfile.IFR = [...options.ad]
            adByProfile.VFR = [...options.ad]
        }
        pdf.value = options.pdf ?? false
        header.value = options.header ?? true
        enroute.value = options.enroute ?? true
        nav.value = options.nav ?? true
        footer.value = options.footer ?? true
        future.value = options.future ?? true
    } catch (e) {
        console.warn("Invalid notamOptions", e)
    }
}

function saveOptions() {
    localStorage.notamOptions = JSON.stringify({
        profile: profile.value,
        pdf: pdf.value,
        header: header.value,
        ad: adByProfile.IFR,
        adByProfile,
        enroute: enroute.value,
        nav: nav.value,
        footer: footer.value,
        future: future.value,
    })
}

function filterEsc(e: KeyboardEvent) {
    if (adFilter.value.length > 0) {
        adFilter.value = ""
        e.stopPropagation()
    }
}

function filterEnter() {
    if (filteredAd.value.length == 1) {
        clickAd(filteredAd.value[0].icao)
    }
}
</script>

<style scoped>
:deep(.notam-flash) {
    animation: notam-flash 1.5s ease-out;
}

@keyframes notam-flash {
    from {
        background: #ffeb3b;
    }
    to {
        background: transparent;
    }
}
</style>
