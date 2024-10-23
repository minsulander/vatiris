<template>
    <div style="height: 30px; background: #666">
        <v-btn
            variant="text"
            rounded="0"
            size="small"
            :color="raw ? 'white' : 'grey-lighten-1'"
            @click="raw = !raw"
            >Raw</v-btn
        >
        <span v-if="raw">
            <v-btn
                variant="text"
                rounded="0"
                size="small"
                color="grey-lighten-1"
                @click="raw = false"
                >Parsed</v-btn
            >
        </span>
        <span v-else>
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
                            v-for="id in filteredAd"
                            :key="id"
                            :class="ad.includes(id) ? '' : 'text-grey'"
                            @click="clickAd(id)"
                        >
                            <v-list-item-title>{{ id }}</v-list-item-title>
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
    </div>
    <div v-if="!notam.originalText" style="height: calc(100% - 30px)">
        <v-progress-linear indeterminate color="#33f" height="5"></v-progress-linear>
    </div>
    <div
        v-else
        style="font-size: 14px; line-height: 16px; height: calc(100% - 30px); overflow-y: auto"
    >
        <pre
            class="pa-1"
            style="width: 580px; margin-left: auto; margin-right: auto"
            v-html="notam.allText"
            v-if="raw"
        ></pre>
        <div style="width: 580px; margin-left: auto; margin-right: auto" v-else>
            <pre class="pa-1 text-grey-darken-2" v-html="notam.header" v-if="header"></pre>
            <div v-if="ad.length > 0">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">AERODROMES</h2>
                <template
                    v-for="id in ad.length == 1 && ad[0] == 'ALL'
                        ? Object.keys(notam.ad).sort()
                        : ad"
                    :key="id"
                >
                    <div v-if="notam.ad[id].length > 0">
                        <h3 class="mb-3 pa-1 bg-grey">{{ id }} {{ notam.adTitle[id] }}</h3>
                        <div
                            v-if="filteredNotams(notam.ad[id]).length == 0"
                            class="pa-1 mb-3 text-grey-darken-2"
                        >
                            NO NOTAMS IN EFFECT ({{ notam.ad[id].length }} FUTURE)
                        </div>
                        <div v-else>
                            <notam-item
                                v-for="item in filteredNotams(notam.ad[id])"
                                :key="item.id"
                                :item="item"
                            />
                        </div>
                    </div>
                    <div v-else-if="ad.length < 1 || ad[0] != 'ALL'">
                        <h3 class="mb-3 pa-1 bg-grey">{{ id }} {{ notam.adTitle[id] }}</h3>
                        <div class="pa-1 mb-3 text-grey-darken-2">NIL</div>
                    </div>
                </template>
            </div>
            <div v-if="enroute">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">EN-ROUTE</h2>
                <notam-item
                    v-for="item in filteredNotams(notam.enroute)"
                    :key="item.id"
                    :item="item"
                />
            </div>
            <div v-if="nav">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">NAV WARNINGS</h2>
                <notam-item v-for="item in filteredNotams(notam.nav)" :key="item.id" :item="item" />
            </div>
            <pre class="pa-1 text-grey-darken-2" v-html="notam.footer" v-if="footer"></pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useNotamStore } from "@/stores/notam"
import { computed, onMounted, reactive, ref, watch } from "vue"

import NotamItem from "@/components/NotamItem.vue"

const notam = useNotamStore()

const raw = ref(false)
const header = ref(true)
const ad = reactive(["ALL"])
const enroute = ref(true)
const nav = ref(true)
const footer = ref(true)
const future = ref(true)

const adFilter = ref("")

const filteredAd = computed(() => {
    if (adFilter.value) {
        const lower = adFilter.value.toLowerCase()
        return Object.keys(notam.ad)
            .filter((id) => id.toLowerCase().includes(lower))
            .sort()
    }
    return Object.keys(notam.ad).sort()
})

const filteredNotams = (notams: any[]) => {
    if (future.value) return notams.sort((a, b) => a.from - b.from)
    return notams
        .filter((n) => !n.from || n.from.getTime() < Date.now())
        .sort((a, b) => a.from - b.from)
}

function clickAd(id: string) {
    if (ad.includes(id)) ad.splice(ad.indexOf(id), 1)
    else {
        ad.push(id)
        if (ad[0] == "ALL") ad.splice(0, 1)
    }
}

function clickAdAll() {
    ad.splice(0)
    ad.push("ALL")
}

function clickAdNone() {
    ad.splice(0)
}

onMounted(() => {
    loadOptions()
    if (!notam.lastFetch) notam.fetch()
})

watch([raw, header, ad, enroute, nav, footer, future], () => {
    saveOptions()
})

function loadOptions() {
    if ("notamOptions" in localStorage) {
        const options = JSON.parse(localStorage.notamOptions)
        raw.value = options.raw
        header.value = options.header
        ad.splice(0)
        for (const id of options.ad) ad.push(id)
        enroute.value = options.enroute
        nav.value = options.nav
        footer.value = options.footer
        future.value = options.future
    }
}

function saveOptions() {
    localStorage.notamOptions = JSON.stringify({
        raw: raw.value,
        header: header.value,
        ad,
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
        clickAd(filteredAd.value[0])
    }
}
</script>
