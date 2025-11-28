<template>
    <div v-if="departures.length === 0" class="text-center">
        <div v-if="vatsim.refreshing || fdp.fdp.loading || esdata.loading">Loading...</div>
        <div v-else>No departures</div>
    </div>
    <table v-else style="border-collapse: collapse; width: 100%">
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
            <td v-if="multipleAirports">{{ dep.adep }}</td>
            <td class="font-weight-medium">{{ dep.stand }}</td>
            <td :class="dep.sortTime < 0 ? 'text-grey-darken-2' : ''">{{ dep.std }}</td>
            <td>{{ esdata.statusLabel[dep.status] || dep.status }}</td>
            <td>{{ dep.ades }}</td>
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
}
table tr td {
    font-size: 14px;
    padding: 0 2px;
}
table tr:nth-child(even) {
    background: #6ce;
}
table tr:nth-child(odd) {
    background: #8ef;
}
table td {
    user-select: auto;
}
table th .v-icon {
    margin-left: -5px;
    margin-right: -5px;
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

table tr td.type-cell.wtc-not-medium {
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
import { useSettingsStore } from "@/stores/settings"
import { useWxStore } from "@/stores/wx"
import { computed, onMounted, onUnmounted, ref, watch, type PropType } from "vue"
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
const { manualRunwayOverride } = useFspRunway()

const sortBy = ref("status")
const sortDescending = ref(false)
const sortIcon = (key: string) =>
    sortBy.value != key
        ? ""
        : sortDescending.value
          ? "mdi-triangle-small-down"
          : "mdi-triangle-small-up"

const multipleAirports = computed(() => props.airports.length == 0 || props.airports.length > 1)

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
            if (props.airports.length == 0 && !pilot.flight_plan.departure.startsWith("ES"))
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
            if (props.airports.length == 0 && !prefile.flight_plan.departure.startsWith("ES"))
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
                default:
                    return (
                        order *
                        ((esdata.statusOrder[b.status] || 0) - (esdata.statusOrder[a.status] || 0))
                    )
            }
        })
})

function clickHeader(name: string) {
    if (sortBy.value === name) {
        sortDescending.value = !sortDescending.value
    } else {
        sortBy.value = name
        sortDescending.value = false
    }
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
