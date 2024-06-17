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
                :color="ad ? 'white' : 'grey-lighten-1'"
                @click="ad = !ad"
                >Aerodromes</v-btn
            >
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
        <pre class="pa-1" v-html="notam.allText" v-if="raw"></pre>
        <div v-else>
            <pre class="pa-1 text-grey-darken-2" v-html="notam.header" v-if="header"></pre>
            <div v-if="ad">
                <h2 class="pa-1 mt-1 mb-3 bg-grey">AERODROMES</h2>
                <template v-for="id in Object.keys(notam.ad).sort()" :key="id">
                    <div v-if="notam.ad[id].length > 0">
                        <h3 class="mb-3 pa-1 bg-grey">{{ id }}</h3>
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
import { onMounted, ref } from "vue"

import NotamItem from "@/components/NotamItem.vue"

const notam = useNotamStore()

const raw = ref(false)
const header = ref(true)
const ad = ref(true)
const enroute = ref(true)
const nav = ref(true)
const footer = ref(true)
const future = ref(true)

const filteredNotams = (notams: any[]) => {
    if (future.value) return notams.sort((a, b) => a.from - b.from)
    return notams.filter((n) => n.inEffect)
}

onMounted(() => {
    if (!notam.lastFetch) notam.fetch()
})
</script>
