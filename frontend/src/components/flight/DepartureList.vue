<template>
    <div v-if="departures.length === 0" class="text-center">
        <div v-if="vatsim.refreshing || fdp.fdp.loading || esdata.loading">Loading...</div>
        <div v-else>No departures</div>
    </div>
    <table v-else style="border-collapse: collapse; width: 100%" :class="settings.colorfulArrDep ? 'colorful' : ''">
        <thead>
            <tr style="position: sticky; top: 0; margin-bottom: 20px; background: #ddd">
                <th v-if="settings.fspEnabled" style="width: 28px"></th>
                <th @click="clickHeader('callsign')">
                    Flight <v-icon>{{ sortIcon("callsign") }}</v-icon>
                </th>
                <th @click="clickHeader('type')">
                    Type <v-icon>{{ sortIcon("type") }}</v-icon>
                </th>
                <th v-if="multipleAirports" @click="clickHeader('adep')">
                    DEP <v-icon>{{ sortIcon("adep") }}</v-icon>
                </th>
                <th @click="clickHeader('stand')">
                    Park <v-icon>{{ sortIcon("stand") }}</v-icon>
                </th>
                <th @click="clickHeader('std')">
                    STD <v-icon>{{ sortIcon("std") }}</v-icon>
                </th>
                <th v-if="hasCtot" @click="clickHeader('ctot')">
                    CTOT <v-icon>{{ sortIcon("ctot") }}</v-icon>
                </th>
                <th @click="clickHeader('status')">
                    Status <v-icon>{{ sortIcon("status") }}</v-icon>
                </th>
                <th @click="clickHeader('ades')">
                    DEST <v-icon>{{ sortIcon("ades") }}</v-icon>
                </th>
            </tr>
        </thead>
        <tr v-for="dep in departures" :key="dep.callsign">
            <td v-if="settings.fspEnabled" style="padding: 2px; width: 28px">
                <v-btn
                    icon
                    size="small"
                    variant="flat"
                    density="compact"
                    :disabled="vatfsp.printing"
                    @click="shouldAllowSingleClick(dep) ? printFlight(dep) : null"
                    @dblclick="!shouldAllowSingleClick(dep) ? printFlight(dep) : null"
                    :title="getDepartureButtonTitle(dep)"
                    :color="getDepartureButtonColor(dep)"
                    style="
                        border-radius: 50%;
                        min-width: 24px;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                    "
                >
                </v-btn>
            </td>
            <td class="font-weight-medium">{{ dep.callsign }}</td>
            <td class="type-cell" :class="{ 'wtc-not-medium': isNotMediumWTC(dep.type) }">
                {{ dep.type
                }}<v-icon
                    v-if="
                        settings.showSlow &&
                        dep.adep?.toUpperCase() === 'ESSA' &&
                        isSlowDeparture(dep)
                    "
                    class="slow-icon"
                    >mdi-tortoise</v-icon
                ><v-icon
                    v-if="
                        settings.showSlow &&
                        dep.adep?.toUpperCase() === 'ESGG' &&
                        isPropellerDeparture(dep)
                    "
                    class="propeller-icon"
                    >mdi-fan</v-icon
                >
            </td>
            <td
                v-if="multipleAirports"
                class="airport-cell"
                :class="{
                    pinned: isPinned(dep, 'adep'),
                    'has-actions': hasAirportActions(dep.adep, 'adep'),
                }"
            >
                <span class="airport-code" @click.stop="togglePinned(dep, 'adep')">
                    {{ dep.adep }}
                </span>
                <span
                    v-if="hasAirportActions(dep.adep, 'adep')"
                    class="airport-actions"
                    @click.stop
                >
                    <v-btn
                        v-if="getMetreportId(dep.adep, 'adep')"
                        icon
                        variant="text"
                        size="x-small"
                        density="compact"
                        @click.stop="openWindow(getMetreportId(dep.adep, 'adep')!)"
                    >
                        <v-icon size="14">mdi-cloud</v-icon>
                    </v-btn>
                    <v-btn
                        v-if="getLopId(dep.adep)"
                        icon
                        variant="text"
                        size="x-small"
                        density="compact"
                        @click.stop="openWindow(getLopId(dep.adep)!)"
                    >
                        <v-icon size="14">mdi-map-marker</v-icon>
                    </v-btn>
                    <template v-if="getAipDocs(dep.adep).length === 1">
                        <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            density="compact"
                            @click.stop="openWindow(getAipDocs(dep.adep)[0].id)"
                        >
                            <v-icon size="14">mdi-map</v-icon>
                        </v-btn>
                    </template>
                    <template v-else-if="getAipDocs(dep.adep).length > 1">
                        <v-btn icon variant="text" size="x-small" density="compact">
                            <v-icon size="14">mdi-map</v-icon>
                        </v-btn>
                        <v-menu activator="parent" location="bottom" :close-on-content-click="true">
                            <v-list density="compact">
                                <v-list-item
                                    v-for="doc in getAipDocs(dep.adep)"
                                    :key="doc.id"
                                    @click="openWindow(doc.id)"
                                >
                                    <v-list-item-title>{{ doc.label }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </template>
                </span>
            </td>
            <td class="font-weight-medium">{{ dep.stand }}</td>
            <td
                :class="[
                    dep.sortTime < 0 ? 'text-grey-darken-2' : '',
                    isFls(dep) ? 'text-red-darken-2' : '',
                ]"
                :style="{ cursor: isFls(dep) ? 'pointer' : 'default' }"
                :title="isFls(dep) ? 'FLS - Flight Suspended, update EOBT' : undefined"
                @click="handleStdClick(dep)"
            >
                {{ dep.std }}
            </td>
            <td
                v-if="hasCtot"
                :class="getCtot(dep) ? 'ctot-cell' : ''"
                :style="{ cursor: getCtot(dep) ? 'pointer' : 'default' }"
                :title="getCtotTitle(dep)"
                @click="handleCtotClick(dep)"
            >
                {{ getCtot(dep) }}<span v-if="getCtot(dep) && (isReaSet(dep) || isSirSet(dep))" class="ctot-indicators"><span v-if="isReaSet(dep)" class="ctot-r">R</span><span v-if="isSirSet(dep)" class="ctot-s">S</span></span>
            </td>
            <td>{{ esdata.statusLabel[dep.status] || dep.status }}</td>
            <td
                class="airport-cell"
                :class="{
                    pinned: isPinned(dep, 'ades'),
                    'has-actions': hasAirportActions(dep.ades, 'ades'),
                }"
            >
                <span class="airport-code" @click.stop="togglePinned(dep, 'ades')">
                    {{ dep.ades }}
                </span>
                <span
                    v-if="hasAirportActions(dep.ades, 'ades')"
                    class="airport-actions"
                    @click.stop
                >
                    <v-btn
                        v-if="getMetreportId(dep.ades, 'ades')"
                        icon
                        variant="text"
                        size="x-small"
                        density="compact"
                        @click.stop="openWindow(getMetreportId(dep.ades, 'ades')!)"
                    >
                        <v-icon size="14">mdi-cloud</v-icon>
                    </v-btn>
                    <v-btn
                        v-if="getLopId(dep.ades)"
                        icon
                        variant="text"
                        size="x-small"
                        density="compact"
                        @click.stop="openWindow(getLopId(dep.ades)!)"
                    >
                        <v-icon size="14">mdi-map-marker</v-icon>
                    </v-btn>
                    <template v-if="getAipDocs(dep.ades).length === 1">
                        <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            density="compact"
                            @click.stop="openWindow(getAipDocs(dep.ades)[0].id)"
                        >
                            <v-icon size="14">mdi-map</v-icon>
                        </v-btn>
                    </template>
                    <template v-else-if="getAipDocs(dep.ades).length > 1">
                        <v-btn icon variant="text" size="x-small" density="compact">
                            <v-icon size="14">mdi-map</v-icon>
                        </v-btn>
                        <v-menu activator="parent" location="bottom" :close-on-content-click="true">
                            <v-list density="compact">
                                <v-list-item
                                    v-for="doc in getAipDocs(dep.ades)"
                                    :key="doc.id"
                                    @click="openWindow(doc.id)"
                                >
                                    <v-list-item-title>{{ doc.label }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </template>
                </span>
            </td>
        </tr>
    </table>
</template>

<style scoped>
table tr th {
    font-weight: bold;
    color: #555;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    padding: 0 1px;
    border-bottom: 1px solid #ccc;
}
table thead tr {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #ddd;
}
table tr td {
    font-size: 14px;
    padding: 0 2px;
}
table tr:nth-child(even) {
    background: #f5f5f5;
}
table.colorful tr:nth-child(even) {
    background: #6ce;
}
table.colorful tr:nth-child(odd) {
    background: #8ef;
}
table td {
    user-select: auto;
}
table td.airport-cell {
    position: relative;
    white-space: nowrap;
}
.airport-code {
    display: inline-block;
    transition: opacity 0.1s ease-in-out;
}
.airport-cell.has-actions .airport-code {
    cursor: pointer;
}
.airport-actions {
    display: inline-flex;
    gap: 0px;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    align-items: center;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease-in-out;
}
.airport-cell.has-actions:hover .airport-code,
.airport-cell.has-actions.pinned .airport-code {
    opacity: 0;
}
.airport-cell:hover .airport-actions,
.airport-cell.pinned .airport-actions {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
}
.airport-actions .v-btn {
    width: 18px;
    min-width: 18px;
    height: 18px;
    padding: 0;
}

table:not(.colorful) tr td.ctot-cell {
    font-weight: 500;
}
table.colorful tr td.ctot-cell {
    background-color: #ffb933 !important;
}
.ctot-indicators {
    margin-left: 2px;
    font-size: 0.7em;
    vertical-align: super;
    opacity: 0.85;
}
.ctot-r,
.ctot-s {
    font-weight: 600;
}
table th .v-icon {
    margin-left: -8px;
    margin-right: -10px;
}


.slow-icon {
    margin-left: 2px;
    vertical-align: middle;
    color: #1976d2;
    font-size: 12px;
    width: 12px;
    height: 12px;
}

.propeller-icon {
    margin-left: 2px;
    vertical-align: middle;
    color: #1976d2;
    font-size: 12px;
    width: 12px;
    height: 12px;
}

table tr td.type-cell {
    white-space: nowrap;
    padding: 0 1px;
}

table:not(.colorful) tr td.type-cell.wtc-not-medium {
    font-weight: 500;
}
table.colorful tr td.type-cell.wtc-not-medium {
    background-color: #ffb933 !important;
}

.t1-code {
    color: #1976d2;
    font-weight: 600;
    margin-left: 3px;
    font-size: 7px;
}
</style>

<script setup lang="ts">
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { useAirportStore } from "@/stores/airport"
import { useAircraftStore } from "@/stores/aircraft"
import { useVatfspStore } from "@/stores/vatfsp"
import { useIfpsStore } from "@/stores/ifps"
import { useDeparturesForCdmStore } from "@/stores/departuresForCdm"
import { setCdmPrefill } from "@/cdmPrefill"
import { useSettingsStore } from "@/stores/settings"
import { useWxStore } from "@/stores/wx"
import { useEaipStore } from "@/stores/eaip"
import { computed, onMounted, onUnmounted, ref, watch, type PropType } from "vue"
import useEventBus from "@/eventbus"
import {
    flightplanDepartureTime,
    distanceToAirport,
    formatRFL,
    normalizeFlightRules,
    getSIDName,
    getCleanedRoute,
    closestAirport,
} from "@/flightcalc"
import { useFspRunway } from "@/composables/useFspRunway"
import moment from "moment"
import constants from "@/constants"
import { metarAirports } from "@/metcommon"
import lopPages from "@/data/wiki-pages.json"

const props = defineProps({
    airports: {
        type: Array as PropType<string[]>,
        default: () => [],
    },
    excludeStatus: {
        type: Array as PropType<string[]>,
        default: () => [],
    },
})

const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()
const airportStore = useAirportStore()
const aircraftStore = useAircraftStore()
const vatfsp = useVatfspStore()
const settings = useSettingsStore()
const wx = useWxStore()
const eaip = useEaipStore()
const { manualRunwayOverride } = useFspRunway()
const ifps = useIfpsStore()
const departuresForCdm = useDeparturesForCdmStore()
const bus = useEventBus()

const sortBy = ref("status")
const sortDescending = ref(false)
const sortIcon = (key: string) =>
    sortBy.value != key
        ? ""
        : sortDescending.value
          ? "mdi-triangle-small-down"
          : "mdi-triangle-small-up"

const multipleAirports = computed(() => props.airports.length == 0 || props.airports.length > 1)
const pinnedAirport = ref<{ callsign: string; field: "adep" | "ades" } | null>(null)

interface Departure {
    callsign: string
    type: string
    adep: string
    stand: string
    std: string
    status: string
    ades: string
    sortTime: number
    squawk?: string
    route?: string
    rfl?: string
    flightRules?: string
    tas?: string
    remarks?: string
}

const storedStand = {} as { [key: string]: string }

const departures = computed(() => {
    if (!vatsim.data || !vatsim.data.pilots) return []
    // Start with VATSIM pilots
    let departures = vatsim.data.pilots
        .filter((pilot) => {
            if (!pilot.flight_plan) return false
            if (pilot.groundspeed >= constants.inflightGroundspeed) return false
            if (
                props.airports.length == 0 &&
                !pilot.flight_plan.departure.startsWith("ES") &&
                !constants.arrDepExtraAds.includes(pilot.flight_plan.departure)
            )
                return false
            if (props.airports.length > 0 && !props.airports.includes(pilot.flight_plan.departure))
                return false
            if (!(pilot.flight_plan.departure in airportStore.airports)) return false
            const airport = airportStore.airports[pilot.flight_plan.departure]
            if (distanceToAirport(pilot, airport) > constants.atAirportDistance) return false
            return true
        })
        .map((pilot) => {
            const depTime = flightplanDepartureTime(pilot.flight_plan)
            const dep = {
                callsign: pilot.callsign,
                type: pilot.flight_plan?.aircraft_short,
                adep: pilot.flight_plan?.departure,
                std: flightplanDepartureTime(pilot.flight_plan)?.format("HHmm"),
                ades: pilot.flight_plan?.arrival,
                sortTime: depTime ? depTime.diff(moment().utc(), "seconds") : 0,
                stand:
                    pilot.groundspeed < constants.motionGroundspeed
                        ? airportStore.getStandNameAtLocation(pilot.flight_plan?.departure, [
                              pilot.longitude,
                              pilot.latitude,
                          ])
                        : "",
                squawk: pilot.flight_plan?.assigned_transponder,
                route: pilot.flight_plan?.route,
                rfl: pilot.flight_plan?.altitude,
                flightRules: normalizeFlightRules(
                    pilot.flight_plan?.flight_rules,
                    pilot.flight_plan?.route,
                ), // Auto-detect Y/Z from I/V
                tas: pilot.flight_plan?.cruise_tas,
                remarks: pilot.flight_plan?.remarks,
            } as Departure
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            if (dep.stand) storedStand[dep.callsign] = dep.stand
            else if (dep.callsign in storedStand) dep.stand = storedStand[dep.callsign]
            return dep
        })
    const skipCallsigns = [] as string[]
    for (const dep of departures) {
        // Add FDP data
        if (
            fdp.fdp &&
            fdp.fdp.general &&
            fdp.fdp.general.update_timestamp &&
            fdp.fdp.flights &&
            dep.callsign in fdp.fdp.flights
        ) {
            const fdpFlight = fdp.fdp.flights[dep.callsign]
            if (
                fdpFlight.departure_distance > 15 ||
                (fdpFlight.departure_distance > fdpFlight.arrival_distance &&
                    fdpFlight.arrival_distance >= 0)
            ) {
                skipCallsigns.push(dep.callsign)
            }
        }
        // Add Euroscope data if there is any
        if (dep.callsign in esdata.data) {
            const esd = esdata.data[dep.callsign]
            if (!dep.stand) dep.stand = esd.stand
            if (esd.groundstate) dep.status = esd.groundstate
        }
    }

    // Add VATSIM prefiles
    let prefileDeps = vatsim.data.prefiles
        .filter((prefile) => {
            if (!prefile.flight_plan) return false
            if (departures.find((d) => d.callsign === prefile.callsign)) return false
            if (
                props.airports.length == 0 &&
                !prefile.flight_plan.departure.startsWith("ES") &&
                !constants.arrDepExtraAds.includes(prefile.flight_plan.departure)
            )
                return false
            if (
                props.airports.length > 0 &&
                !props.airports.includes(prefile.flight_plan.departure)
            )
                return false
            const depTime = flightplanDepartureTime(prefile.flight_plan)
            return depTime && depTime.utc().diff(moment().utc(), "hours") > -2
        })
        .map((prefile) => {
            const depTime = flightplanDepartureTime(prefile.flight_plan)
            return {
                callsign: prefile.callsign,
                type: prefile.flight_plan?.aircraft_short,
                adep: prefile.flight_plan?.departure,
                std: flightplanDepartureTime(prefile.flight_plan)?.format("HHmm"),
                ades: prefile.flight_plan?.arrival,
                sortTime: depTime ? depTime.diff(moment().utc(), "seconds") : 0,
                status: "PRE",
                tas: prefile.flight_plan?.cruise_tas,
                remarks: prefile.flight_plan?.remarks,
            } as Departure
        })
    for (const dep of prefileDeps) {
        if (!departures.find((d) => d.callsign == dep.callsign)) departures.push(dep)
    }

    // Find invalid/no flightplan pilots at known airports
    const candidatePilots = vatsim.data.pilots.filter(
        (p) =>
            p.groundspeed < constants.inflightGroundspeed &&
            p.latitude > 55 &&
            p.latitude < 69 &&
            p.longitude > 10 &&
            p.longitude < 24 &&
            !departures.find((d) => d.callsign === p.callsign),
    )
    for (const icao of Object.keys(airportStore.airports)) {
        if (props.airports.length > 0 && !props.airports.includes(icao)) continue
        const airport = airportStore.airports[icao]
        for (const pilot of candidatePilots.filter(
            (p) =>
                distanceToAirport(p, airport) < constants.atAirportDistance &&
                (!p.flight_plan ||
                    (p.flight_plan.departure !== airport.icao &&
                        p.flight_plan.arrival !== airport.icao)) &&
                closestAirport(p)?.icao == airport.icao,
        )) {
            const dep = {
                callsign: pilot.callsign,
                type: pilot.flight_plan?.aircraft_short,
                adep: airport.icao,
                ades: pilot.flight_plan?.arrival,
                sortTime: 0,
                status: pilot.flight_plan ? "INVFP" : "NOFP",
                std: "",
                stand:
                    pilot.groundspeed < constants.motionGroundspeed
                        ? airportStore.getStandNameAtLocation(airport.icao, [
                              pilot.longitude,
                              pilot.latitude,
                          ])
                        : "",
                tas: pilot.flight_plan?.cruise_tas,
                remarks: pilot.flight_plan?.remarks,
            }
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            if (dep.stand) storedStand[dep.callsign] = dep.stand
            else if (dep.callsign in storedStand) dep.stand = storedStand[dep.callsign]
            if (!departures.find((d) => d.callsign == dep.callsign)) departures.push(dep)
        }
    }
    // Clean up stored stands for flights no longer in the list
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    for (const callsign of Object.keys(storedStand)) {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        if (!departures.find((d) => d.callsign == callsign)) delete storedStand[callsign]
    }
    return departures
        .filter(
            (dep) =>
                !skipCallsigns.includes(dep.callsign) && !props.excludeStatus.includes(dep.status),
        )
        .sort((a, b) =>
            sortBy.value == "status"
                ? a.sortTime - b.sortTime
                : (esdata.statusOrder[b.status] || 0) - (esdata.statusOrder[a.status] || 0),
        )
        .sort((a, b) => {
            let order = sortDescending.value ? -1 : 1
            switch (sortBy.value) {
                case "callsign":
                    return order * a.callsign.localeCompare(b.callsign)
                case "type":
                    return order * a.type.localeCompare(b.type)
                case "adep":
                    return order * (a.adep || "ZZZZ").localeCompare(b.adep || "ZZZZ")
                case "ades":
                    return order * (a.ades || "ZZZZ").localeCompare(b.ades || "ZZZZ")
                case "stand":
                    return order * (a.stand || "").localeCompare(b.stand || "")
                case "std":
                    return order * a.std.localeCompare(b.std)
                case "ctot": {
                    const ctotA = getCtot(a) || "9999"
                    const ctotB = getCtot(b) || "9999"
                    return order * ctotA.localeCompare(ctotB)
                }
                default:
                    return (
                        order *
                        ((esdata.statusOrder[b.status] || 0) - (esdata.statusOrder[a.status] || 0))
                    )
            }
        })
})

const ifpsDepAirports = computed(() => {
    if (props.airports.length > 0) return props.airports
    const unique = new Set<string>()
    for (const dep of departures.value) {
        if (dep.adep) unique.add(dep.adep)
    }
    return Array.from(unique)
})

const hasCtot = computed(() => {
    for (const dep of departures.value) {
        const flight = ifps.findFlight(dep.callsign)
        const raw =
            flight?.ctot ||
            flight?.CTOT ||
            flight?.cdmData?.ctot ||
            flight?.slot?.ctot ||
            flight?.slot?.CTOT ||
            flight?.ctot_time ||
            flight?.ctotTime
        if (raw != null && raw !== "") return true
    }
    return false
})

function clickHeader(name: string) {
    if (sortBy.value === name) {
        sortDescending.value = !sortDescending.value
    } else {
        sortBy.value = name
        sortDescending.value = false
    }
}


function normalizeIcao(icao?: string) {
    return (icao || "").toUpperCase()
}

function openWindow(id: string) {
    bus.emit("select", id)
}

function isPinned(dep: Departure, field: "adep" | "ades") {
    return (
        pinnedAirport.value?.callsign === dep.callsign && pinnedAirport.value?.field === field
    )
}

function togglePinned(dep: Departure, field: "adep" | "ades") {
    if (isPinned(dep, field)) {
        pinnedAirport.value = null
    } else {
        pinnedAirport.value = { callsign: dep.callsign, field }
    }
}

function getMetreportId(icao?: string, field?: "adep" | "ades") {
    const normalized = normalizeIcao(icao)
    if (!normalized || !metarAirports.includes(normalized)) return undefined
    if (normalized === "ESSA") {
        if (field === "adep") return "metrepESSAdep"
        if (field === "ades") return "metrepESSAarr"
    }
    return `metrep${normalized}`
}

function getLopId(icao?: string) {
    const normalized = normalizeIcao(icao)
    if (!normalized) return undefined
    const lopKey = `lop-${normalized.toLowerCase()}`
    if (lopKey in lopPages) return `wiki-${lopKey}`
    if (["ESSA", "ESSB", "ESOW", "ESOS"].includes(normalized)) return "wikipdf-lpm-esos"
    return undefined
}

function getAipDocs(icao?: string) {
    const normalized = normalizeIcao(icao)
    if (!normalized || !("airports" in eaip.aipIndex)) return []
    const airport = (eaip.aipIndex.airports as any[]).find(
        (entry) => entry.icao === normalized,
    )
    if (!airport || !airport.documents) return []
    return airport.documents.map((document: any) => ({
        id: `aip${document.prefix}`,
        label: document.name,
    }))
}

function hasAirportActions(icao?: string, field?: "adep" | "ades") {
    return !!(
        getMetreportId(icao, field) ||
        getLopId(icao) ||
        getAipDocs(icao).length
    )
}

let esdataSubscription: any = undefined
onMounted(() => {
    esdataSubscription = esdata.subscribe()
    loadOptions()
})

onUnmounted(() => {
    esdata.unsubscribe(esdataSubscription)
})

watch([sortBy, sortDescending], () => {
    saveOptions()
})

watch(
    ifpsDepAirports,
    (airports) => {
        for (const airport of airports) {
            ifps.fetchByDepAirport(airport)
        }
    },
    { immediate: true },
)

watch(
    departures,
    (deps) => {
        departuresForCdm.setCallsigns(deps.map((d) => d.callsign))
    },
    { immediate: true, deep: true },
)

function loadOptions() {
    if ("depOptions" in localStorage) {
        const options = JSON.parse(localStorage.depOptions)
        sortBy.value = options.sortBy || sortBy.value
        sortDescending.value = options.sortDescending || sortDescending.value
    }
}

function saveOptions() {
    localStorage.depOptions = JSON.stringify({
        sortBy: sortBy.value,
        sortDescending: sortDescending.value,
    })
}

function printFlight(dep: Departure) {
    // If route or other data is missing, try to get it from VATSIM data directly
    if (vatsim.data) {
        const pilot = vatsim.data.pilots.find((p) => p.callsign === dep.callsign)
        if (pilot && pilot.flight_plan) {
            if (!dep.route && pilot.flight_plan.route) {
                dep.route = pilot.flight_plan.route
            }
            if (!dep.rfl && pilot.flight_plan.altitude) {
                dep.rfl = pilot.flight_plan.altitude
            }
            if (!dep.squawk && pilot.flight_plan.assigned_transponder) {
                dep.squawk = pilot.flight_plan.assigned_transponder
            }
            if (!dep.flightRules && pilot.flight_plan.flight_rules) {
                dep.flightRules = normalizeFlightRules(
                    pilot.flight_plan.flight_rules,
                    pilot.flight_plan.route,
                )
            }
            if (!dep.tas && pilot.flight_plan.cruise_tas) {
                dep.tas = pilot.flight_plan.cruise_tas
            }
        } else {
            const prefile = vatsim.data.prefiles.find((p) => p.callsign === dep.callsign)
            if (prefile && prefile.flight_plan) {
                if (!dep.route && prefile.flight_plan.route) {
                    dep.route = prefile.flight_plan.route
                }
                if (!dep.rfl && prefile.flight_plan.altitude) {
                    dep.rfl = prefile.flight_plan.altitude
                }
                if (!dep.squawk && prefile.flight_plan.assigned_transponder) {
                    dep.squawk = prefile.flight_plan.assigned_transponder
                }
                if (!dep.flightRules && prefile.flight_plan.flight_rules) {
                    dep.flightRules = normalizeFlightRules(
                        prefile.flight_plan.flight_rules,
                        prefile.flight_plan.route,
                    )
                }
                if (!dep.tas && prefile.flight_plan.cruise_tas) {
                    dep.tas = prefile.flight_plan.cruise_tas
                }
            }
        }
    }

    // Process SID information for departures
    let sidName: string | undefined
    let cleanedRoute = dep.route

    if (dep.adep && dep.route) {
        const metreport = wx.metreport(dep.adep)
        const isESGG = dep.adep === "ESGG"

        // For ESGG: use manual override if set, otherwise let metreport extract runway from ATIS
        let runwayForSID: string | undefined = undefined
        let metreportForSID: string | undefined = undefined

        if (isESGG && manualRunwayOverride.value) {
            // Manual override is set: use it and don't pass metreport (to prevent metreport from overriding)
            runwayForSID = manualRunwayOverride.value
            metreportForSID = undefined
        } else {
            // No manual override: pass metreport so it can extract runway from ATIS
            metreportForSID = metreport
        }

        // Extract SID and clean route
        sidName = getSIDName(dep.adep, dep.route, runwayForSID, metreportForSID, dep.flightRules)

        if (sidName) {
            cleanedRoute = getCleanedRoute(
                dep.adep,
                dep.route,
                runwayForSID,
                metreportForSID,
                dep.flightRules,
            )
        }
    }

    vatfsp.printFlightStrip(
        {
            callsign: dep.callsign,
            type: dep.type,
            adep: dep.adep,
            ades: dep.ades,
            stand: dep.stand,
            std: dep.std,
            status: dep.status,
            flightRules: dep.flightRules,
            tas: dep.tas,
        },
        false, // isArrival
        dep.squawk,
        cleanedRoute, // use cleaned route with SID removed
        formatRFL(dep.rfl),
        sidName, // pass SID name if found
        undefined, // wtc - not available in dep object yet
    )
}

function getIfpsFlight(dep: Departure) {
    return ifps.findFlight(dep.callsign)
}

function getCtotReason(flight: any): string {
    if (!flight || typeof flight !== "object") return ""
    const check = (v: any) => (v != null && v !== "" ? String(v).trim() : "")
    return (
        check(flight.cdmData?.reason) ||
        check(flight.mostPenalizingAirspace) ||
        check(flight.flow_reason) ||
        check(flight.flowReason) ||
        check(flight.ctot_reason) ||
        check(flight.ctotReason) ||
        check(flight.reason) ||
        check(flight.reason_ctot) ||
        check(flight.slot?.reason) ||
        check(flight.slot?.flow_reason)
    )
}

function formatTimeValue(value: any) {
    if (value === undefined || value === null) return undefined
    const digits = String(value).replace(/\D/g, "")
    if (digits.length === 3) return `0${digits}`
    if (digits.length >= 4) return digits.slice(0, 4)
    return digits || String(value)
}

function getCtot(dep: Departure) {
    const flight = getIfpsFlight(dep)
    const raw =
        flight?.ctot ||
        flight?.CTOT ||
        flight?.cdmData?.ctot ||
        flight?.slot?.ctot ||
        flight?.slot?.CTOT ||
        flight?.ctot_time ||
        flight?.ctotTime
    return formatTimeValue(raw)
}

function getCtotTitle(dep: Departure) {
    const ctot = getCtot(dep)
    if (!ctot) return ""
    const flight = getIfpsFlight(dep)
    const reason = getCtotReason(flight)
    const reasonText = reason ? `\nFlow reason: ${reason}` : ""
    const reaSir = [
        isReaSet(dep) && "R=REA - Ready message sent",
        isSirSet(dep) && "S=SIR - Slot Improvement Request sent",
    ].filter(Boolean).join("\n")
    const reaSirText = reaSir ? `\n${reaSir}` : ""
    return `CTOT: ${ctot}\nEOBT: ${dep.std || "----"}${reasonText}${reaSirText}`
}

function getCdmStatus(dep: Departure) {
    const flight = getIfpsFlight(dep)
    const status = flight?.cdmSts || flight?.cdm_status || flight?.cdmStatus
    return typeof status === "string" ? status : ""
}

function isReaSet(dep: Departure): boolean {
    const flight = getIfpsFlight(dep)
    if (!flight) return false
    const v = flight.rea ?? flight.REA ?? flight.ready_for_improvement ?? flight.atfcmData?.isRea
    if (typeof v === "boolean") return v
    if (typeof v === "number") return v === 1
    const sts = String(flight.cdmSts ?? flight.cdm_status ?? flight.cdmStatus ?? "").toUpperCase()
    return sts.includes("REA")
}

function isSirSet(dep: Departure): boolean {
    const flight = getIfpsFlight(dep)
    if (!flight) return false
    const v = flight.sir ?? flight.SIR ?? flight.slot_improvement_request ?? flight.atfcmData?.SIR
    if (typeof v === "boolean") return v
    if (typeof v === "number") return v === 1
    const sts = String(flight.cdmSts ?? flight.cdm_status ?? flight.cdmStatus ?? "").toUpperCase()
    return sts.includes("SIR")
}

function hasFlsStatus(flight: any): boolean {
    if (!flight) return false
    const sts = String(flight.cdmSts ?? flight.cdm_status ?? flight.cdmStatus ?? "").toUpperCase()
    const atfcm = String(flight.atfcmStatus ?? flight.atfcm_status ?? "").toUpperCase()
    return sts.includes("FLS") || atfcm.includes("FLS")
}

const flsCallsigns = computed(() => {
    const set = new Set<string>()
    for (const dep of departures.value) {
        const flight = ifps.findFlight(dep.callsign)
        if (hasFlsStatus(flight)) set.add(dep.callsign)
    }
    return set
})

function isFls(dep: Departure) {
    return flsCallsigns.value.has(dep.callsign)
}

function handleStdClick(dep: Departure) {
    if (!isFls(dep)) return
    setCdmPrefill(undefined, dep.callsign)
    bus.emit("select", "cdm-actions")
}

function handleCtotClick(dep: Departure) {
    if (!getCtot(dep)) return
    setCdmPrefill(dep.callsign, undefined)
    bus.emit("select", "cdm-actions")
}

function getDepartureButtonColor(dep: Departure): string {
    // Flight plan changed after printing - URGENT
    if (
        vatfsp.hasFlightPlanChanged(
            dep.callsign,
            dep.squawk,
            dep.route,
            formatRFL(dep.rfl),
            dep.type,
        )
    ) {
        return "red" // Urgent - needs reprint
    }

    // Already printed and no changes
    if (vatfsp.isPrinted(dep.callsign)) {
        return "grey-darken-1" // Already printed
    }

    // Not printed - check squawk assignment
    const hasAssignedSquawk = dep.squawk && dep.squawk !== "2000" && dep.squawk !== "0000"
    if (!hasAssignedSquawk) {
        return "blue-grey-lighten-2" // Not ready (no squawk)
    }

    // Not printed with assigned squawk - ready to print
    return "orange" // Ready to print
}

function shouldAllowSingleClick(dep: Departure): boolean {
    // Single click allowed for: red (urgent flight plan changed) or orange (ready to print)
    // Double click required for: grey (already printed) or blue-grey (no squawk)

    // Allow single click only if flight plan changed (red) or ready with squawk (orange)
    if (
        vatfsp.hasFlightPlanChanged(
            dep.callsign,
            dep.squawk,
            dep.route,
            formatRFL(dep.rfl),
            dep.type,
        )
    ) {
        return true // Red - urgent
    }

    if (!vatfsp.isPrinted(dep.callsign)) {
        const hasAssignedSquawk = !!(dep.squawk && dep.squawk !== "2000" && dep.squawk !== "0000")
        return hasAssignedSquawk // Orange (true) or Blue-grey (false)
    }

    return false // Grey - already printed
}

function getDepartureButtonTitle(dep: Departure): string {
    if (
        vatfsp.hasFlightPlanChanged(
            dep.callsign,
            dep.squawk,
            dep.route,
            formatRFL(dep.rfl),
            dep.type,
        )
    ) {
        return "Click to reprint flight strip (flight plan changed)"
    }
    if (vatfsp.isPrinted(dep.callsign)) {
        return "Double-click to reprint flight strip"
    }
    if (dep.status === "PRE") {
        return "Double-click to print flight strip (not connected yet)"
    }
    const hasAssignedSquawk = dep.squawk && dep.squawk !== "2000" && dep.squawk !== "0000"
    if (!hasAssignedSquawk) {
        return "Double-click to print flight strip (no squawk assigned yet)"
    }
    return "Click to print flight strip"
}

function isSlowDeparture(dep: Departure): boolean {
    // Only check slow aircraft for ESSA departures
    return aircraftStore.isSlowAircraft(dep.type, dep.flightRules)
}

function isNotMediumWTC(aircraftType: string | undefined): boolean {
    return aircraftStore.isNotMediumWTC(aircraftType)
}

function isPropellerDeparture(dep: Departure): boolean {
    return aircraftStore.isPropellerDriven(dep.type)
}
</script>
