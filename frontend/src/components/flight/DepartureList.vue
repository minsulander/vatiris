<template>
    <div v-if="departures.length === 0" class="text-center">
        <div v-if="vatsim.refreshing || fdp.fdp.loading || esdata.loading">Loading...</div>
        <div v-else>No departures</div>
    </div>
    <table v-else style="border-collapse: collapse; width: 100%">
        <thead>
            <tr style="position: sticky; top: 0; margin-bottom: 20px; background: #ddd">
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
            <td class="font-weight-medium">{{ dep.callsign }}</td>
            <td>{{ dep.type }}</td>
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
</style>

<script setup lang="ts">
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { useAirportStore } from "@/stores/airport"
import { computed, onMounted, onUnmounted, ref, watch, type PropType } from "vue"
import { flightplanDepartureTime, distanceToAirport } from "@/flightcalc"
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
}

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
            return {
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
            } as Departure
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
            } as Departure
        })
    for (const dep of prefileDeps) departures.push(dep)

    // Find invalid/no flightplan pilots at known airports
    for (const icao of Object.keys(airportStore.airports)) {
        if (props.airports.length > 0 && !props.airports.includes(icao)) continue
        const airport = airportStore.airports[icao]
        for (const pilot of vatsim.data.pilots.filter(
            (p) =>
                p.groundspeed < constants.inflightGroundspeed &&
                distanceToAirport(p, airport) < constants.atAirportDistance &&
                (!p.flight_plan ||
                    (p.flight_plan.departure !== airport.icao &&
                        p.flight_plan.arrival !== airport.icao)),
        )) {
            departures.push({
                callsign: pilot.callsign,
                type: pilot.flight_plan?.aircraft_short,
                adep: airport.icao,
                ades: pilot.flight_plan?.arrival,
                sortTime: 0,
                status: pilot.flight_plan ? "INVFP" : "NOFP",
                std: "",
                stand:
                    pilot.groundspeed < constants.motionGroundspeed
                        ? airportStore.getStandNameAtLocation(pilot.flight_plan?.departure, [
                              pilot.longitude,
                              pilot.latitude,
                          ])
                        : "",
            })
        }
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
</script>
