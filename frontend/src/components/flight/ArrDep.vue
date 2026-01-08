<template>
    <div
        ref="div"
        style="
            height: 25px;
            margin-top: -5px;
            margin-left: -5px;
            background: #777;
            white-space: nowrap;
        "
    >
        <v-btn variant="text" rounded="0" size="small" color="white" @click="adFilter = ''"
            >Aerodromes
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
            >
                <v-list density="compact">
                    <v-list-item
                        @click="clickAdAll"
                        :class="arrAd.length == 0 && depAd.length == 0 ? '' : 'text-grey'"
                    >
                        <v-list-item-title>ALL</v-list-item-title>
                    </v-list-item>
                    <v-list-item
                        @click="clickAdNone"
                        :class="
                            arrAd.length == 1 &&
                            arrAd[0] == 'NONE' &&
                            depAd.length == 1 &&
                            depAd[0] == 'NONE'
                                ? ''
                                : 'text-grey'
                        "
                    >
                        <v-list-item-title>NONE</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="canSyncAd" @click="syncAd">
                        <v-list-item-title>SYNC</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                        <v-text-field
                            v-model="adFilter"
                            variant="underlined"
                            density="compact"
                            hide-details
                            autofocus
                            clearable
                            clear-icon="mdi-close"
                            @keydown.esc="filterEsc"
                            @keydown.enter.stop="filterEnter"
                        />
                    </v-list-item>
                    <v-list-item
                        v-for="id in filteredAd"
                        :key="id"
                        :class="
                            arrAd.includes(id) ||
                            arrAd.length == 0 ||
                            depAd.includes(id) ||
                            depAd.length == 0
                                ? ''
                                : 'text-grey'
                        "
                        @click="clickAd(id)"
                    >
                        <v-list-item-title>
                            {{ id }}
                            <div class="float-right">
                                <span
                                    style="cursor: pointer"
                                    @click.stop="clickArrAd(id)"
                                    :class="
                                        arrAd.includes(id) || arrAd.length == 0 ? '' : 'text-grey'
                                    "
                                    >A</span
                                >
                                <span
                                    style="cursor: pointer; margin-left: 5px"
                                    @click.stop="clickDepAd(id)"
                                    :class="
                                        depAd.includes(id) || depAd.length == 0 ? '' : 'text-grey'
                                    "
                                    >D</span
                                >
                            </div>
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-btn>
        <v-btn variant="text" rounded="0" size="small" color="white"
            >Status
            <v-menu
                activator="parent"
                transition="slide-y-transition"
                :close-on-content-click="false"
            >
                <v-list density="compact">
                    <v-list-item
                        v-for="status in Object.keys(esdataStore.statusLabel)"
                        :key="status"
                        :class="!excludeStatus.includes(status) ? '' : 'text-grey'"
                        @click="clickStatus(status)"
                    >
                        <v-list-item-title
                            >{{ esdataStore.statusLabel[status] }} -
                            {{ esdataStore.statusDescription[status] }}</v-list-item-title
                        >
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-btn>
    </div>
    <div
        v-if="arrAd.length == 1 && arrAd[0] == 'NONE' && depAd.length == 1 && depAd[0] == 'NONE'"
        class="ma-1"
    >
        Select aerodromes in the menu above.
    </div>
    <div v-else class="d-flex" style="height: calc(100% - 20px); overflow: hidden">
        <div
            v-if="arr"
            class="flex-1-0"
            style="
                min-height: 0;
                max-height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
                border-right: 1px solid #ccc;
            "
            :style="{ 'max-width': dep ? '51%' : '100%' }"
        >
            <!--
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Arrivals
            </div>
            -->
            <arrival-list :airports="arrAd" :excludeStatus="excludeStatus" />
        </div>
        <div
            v-if="dep"
            class="flex-1-0"
            style="
                min-height: 0;
                max-height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
                border-left: 1px solid #ccc;
            "
        >
            <!--
            <div
                class="text-center"
                style="position: sticky; top: 0; background: white; border-bottom: 1px solid #ccc"
            >
                Departures
            </div>
            -->
            <departure-list :airports="depAd" :excludeStatus="excludeStatus" />
        </div>
    </div>
</template>

<script setup lang="ts">
import ArrivalList from "./ArrivalList.vue"
import DepartureList from "./DepartureList.vue"
import { reactive, ref, computed, onMounted, watch } from "vue"
import { useAirportStore } from "@/stores/airport"
import { useEsdataStore } from "@/stores/esdata"
import { useVatsimStore } from "@/stores/vatsim"
import { useAuthStore } from "@/stores/auth"
import constants from "@/constants"

const airportStore = useAirportStore()
const esdataStore = useEsdataStore()
const vatsimStore = useVatsimStore()
const auth = useAuthStore()

const div = ref()
const arrAd = reactive([] as string[])
const depAd = reactive([] as string[])
const arr = computed(() => arrAd.length != 1 || arrAd[0] != "NONE")
const dep = computed(() => depAd.length != 1 || depAd[0] != "NONE")
const adFilter = ref("")
const excludeStatus = reactive([] as string[])

const canSyncAd = computed(() => {
    return myEsData.value && "rwyconfig" in myEsData.value
})

const myEsData = computed(() => {
    const cid = auth.user?.cid
    if (!cid) return undefined
    const controller = vatsimStore.data?.controllers.find((c) => c.cid == cid)
    if (!controller) return undefined
    return esdataStore.data[controller.callsign] || undefined
})

const allAd = computed(() => {
    // from euroscope runway selection dialog:
    return [...constants.arrDepExtraAds, ...Object.keys(airportStore.airports).sort()]
})

const filteredAd = computed(() => {
    if (adFilter.value) {
        const lower = adFilter.value.toLowerCase()
        return allAd.value.filter((id) => id.toLowerCase().includes(lower)).sort()
    }
    return allAd.value
})

function syncAd() {
    arrAd.splice(0)
    depAd.splice(0)
    arrAd.push("NONE")
    depAd.push("NONE")
    esdataStore.fetch()
    setTimeout(() => {
        if (myEsData.value && "rwyconfig" in myEsData.value) {
            arrAd.splice(0)
            depAd.splice(0)
            for (const icao of Object.keys(myEsData.value.rwyconfig)) {
                if (myEsData.value.rwyconfig[icao].arr) arrAd.push(icao)
                if (myEsData.value.rwyconfig[icao].dep) depAd.push(icao)
            }
        }
    }, 500)
}

function clickAd(icao: string) {
    if (arrAd.includes(icao) || depAd.includes(icao)) {
        arrAd.splice(arrAd.indexOf(icao), 1)
        if (arrAd.length == 0) arrAd.push("NONE")
        depAd.splice(depAd.indexOf(icao), 1)
        if (depAd.length == 0) depAd.push("NONE")
    } else if (arrAd.length == 0 && depAd.length == 0) {
        for (const a of allAd.value) {
            if (a != icao) {
                arrAd.push(a)
                depAd.push(a)
            }
        }
    } else {
        if (arrAd.includes("NONE")) arrAd.splice(arrAd.indexOf("NONE"), 1)
        if (depAd.includes("NONE")) depAd.splice(depAd.indexOf("NONE"), 1)
        arrAd.push(icao)
        depAd.push(icao)
    }
}

function clickArrAd(icao: string) {
    if (arrAd.includes(icao)) {
        arrAd.splice(arrAd.indexOf(icao), 1)
        if (arrAd.length == 0) arrAd.push("NONE")
    } else if (arrAd.length == 0) {
        for (const a of allAd.value) {
            if (a != icao) arrAd.push(a)
        }
    } else {
        if (arrAd.includes("NONE")) arrAd.splice(arrAd.indexOf("NONE"), 1)
        arrAd.push(icao)
    }
}

function clickDepAd(icao: string) {
    if (depAd.includes(icao)) {
        depAd.splice(depAd.indexOf(icao), 1)
        if (depAd.length == 0) depAd.push("NONE")
    } else if (depAd.length == 0) {
        for (const a of allAd.value) {
            if (a != icao) depAd.push(a)
        }
    } else {
        if (depAd.includes("NONE")) depAd.splice(depAd.indexOf("NONE"), 1)
        depAd.push(icao)
    }
}

function clickAdAll() {
    arrAd.splice(0)
    depAd.splice(0)
}

function clickAdNone() {
    arrAd.splice(0)
    depAd.splice(0)
    arrAd.push("NONE")
    depAd.push("NONE")
}

function clickStatus(status: string) {
    if (excludeStatus.includes(status)) {
        excludeStatus.splice(excludeStatus.indexOf(status), 1)
    } else {
        excludeStatus.push(status)
    }
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
    } else if (adFilter.value.length == 4) {
        clickAd(adFilter.value.toUpperCase())
    }
}

onMounted(() => {
    loadOptions()
})

watch([arr, dep, arrAd, depAd, excludeStatus], () => {
    saveOptions()
    updateWindowTitle()
})

function loadOptions() {
    if ("arrdepOptions" in localStorage) {
        const options = JSON.parse(localStorage.arrdepOptions)

        // backwards compatibility
        if ("ad" in options) {
            arrAd.splice(0)
            depAd.splice(0)
            for (const id of options.ad) {
                arrAd.push(id)
                depAd.push(id)
            }
        }
        if ("arr" in options && options.arr == false) {
            arrAd.splice(0)
            arrAd.push("NONE")
        }
        if ("dep" in options && options.dep == false) {
            depAd.splice(0)
            depAd.push("NONE")
        }

        if ("arrAd" in options) {
            arrAd.splice(0)
            for (const id of options.arrAd) arrAd.push(id)
        }
        if ("depAd" in options) {
            depAd.splice(0)
            for (const id of options.depAd) depAd.push(id)
        }
        if ("excludeStatus" in options) {
            excludeStatus.splice(0)
            for (const status of options.excludeStatus) excludeStatus.push(status)
        }
    }
}

function saveOptions() {
    localStorage.arrdepOptions = JSON.stringify({
        arrAd,
        depAd,
        excludeStatus,
    })
}

function updateWindowTitle() {
    if (div.value) {
        const winbox = div.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            title.innerText = ""
            if (arr.value) title.innerText += " ARR"
            if (arrAd.join(",") != depAd.join(",") && arrAd.length > 0 && arrAd[0] != "NONE") {
                if (arrAd.length == 1) {
                    if (depAd[0] == "NONE") {
                        title.innerText += ` - ${arrAd[0]}`
                    } else {
                        title.innerText += ` (${arrAd[0]})`
                    }
                } else {
                    title.innerText += ` (${arrAd.length})`
                }
            }
            if (dep.value) title.innerText += " DEP"
            if (depAd.length > 1 && depAd[0] != "NONE") {
                title.innerText += ` (${depAd.length})`
            } else if (depAd.length == 1 && depAd[0] != "NONE") {
                if (depAd[0] == arrAd[0] || arrAd[0] == "NONE") {
                    title.innerText += ` - ${depAd[0]}`
                } else {
                    title.innerText += ` (${depAd[0]})`
                }
            }
        }
    }
}
</script>
