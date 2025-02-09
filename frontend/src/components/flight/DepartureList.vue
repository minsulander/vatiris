<template>
    <div v-if="departures.length === 0" class="text-center">
        <div v-if="vatsim.refreshing || fdp.fdp.loading || esdata.loading">Loading...</div>
        <div v-else>No departures</div>
    </div>
    <table v-else style="border-collapse: collapse; width: 100%">
        <thead>
            <tr style="position: sticky; top: 0; margin-bottom: 20px; background: #ddd">
                <th>Flight</th>
                <th>Type</th>
                <th v-if="multipleAirports">DEP</th>
                <th>Park</th>
                <th>STD</th>
                <th>Status</th>
                <th>DEST</th>
            </tr>
        </thead>
        <tr v-for="dep in departures" :key="dep.callsign">
            <td class="font-weight-medium">{{ dep.callsign }}</td>
            <td>{{ dep.type }}</td>
            <td v-if="multipleAirports">{{ dep.adep }}</td>
            <td class="font-weight-medium">{{ dep.stand }}</td>
            <td :class="dep.sortTime < 0 ? 'text-grey-darken-2' : ''">{{ dep.std }}</td>
            <td>{{ dep.status }}</td>
            <td>{{ dep.ades }}</td>
        </tr>
    </table>
</template>

<style scoped>
table tr th {
    font-weight: bold;
    color: #555;
}
table tr th,
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
</style>

<script setup lang="ts">
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { useAirportStore } from "@/stores/airport"
import { computed, onMounted, onUnmounted, type PropType } from "vue"
import { flightplanDepartureTime, distanceToAirport } from "@/flightcalc"
import moment from "moment"

const props = defineProps({
    airports: {
        type: Array as PropType<string[]>,
        default: () => [],
    },
})

const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()
const airportStore = useAirportStore()
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
            if (props.airports.length == 0 && !pilot.flight_plan.departure.startsWith("ES")) return false
            if (props.airports.length > 0 && !props.airports.includes(pilot.flight_plan.departure)) return false
            if (!(pilot.flight_plan.departure in airportStore.airports)) return false
            const airport = airportStore.airports[pilot.flight_plan.departure]
            if (distanceToAirport(pilot, airport) > 15) return false
            return true
        })
        .map((pilot) => {
            return {
                callsign: pilot.callsign,
                type: pilot.flight_plan?.aircraft_short,
                adep: pilot.flight_plan?.departure,
                std: flightplanDepartureTime(pilot.flight_plan)?.format("HHmm"),
                ades: pilot.flight_plan?.arrival,
                sortTime: flightplanDepartureTime(pilot.flight_plan)
                    ?.utc()
                    .diff(moment().utc(), "seconds"),
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
            dep.stand = esd.stand
            if (esd.groundstate) dep.status = esd.groundstate
        }
    }

    // Add VATSIM prefiles
    let prefileDeps = vatsim.data.prefiles
        .filter((prefile) => {
            if (!prefile.flight_plan) return false
            if (props.airports.length == 0 && !prefile.flight_plan.departure.startsWith("ES")) return false
            if (props.airports.length > 0 && !props.airports.includes(prefile.flight_plan.departure)) return false
            const depTime = flightplanDepartureTime(prefile.flight_plan)
            return depTime && depTime.utc().diff(moment().utc(), "hours") > -2
        })
        .map((prefile) => {
            return {
                callsign: prefile.callsign,
                type: prefile.flight_plan?.aircraft_short,
                adep: prefile.flight_plan?.departure,
                std: flightplanDepartureTime(prefile.flight_plan)?.format("HHmm"),
                ades: prefile.flight_plan?.arrival,
                sortTime: flightplanDepartureTime(prefile.flight_plan)
                    ?.utc()
                    .diff(moment().utc(), "seconds"),
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
                p.groundspeed < 40 &&
                distanceToAirport(p, airport) < 4 &&
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
                status: pilot.flight_plan ? "INFP" : "NOFP",
                stand: "",
                std: "",
            })
        }
    }

    return departures
        .filter((d) => !skipCallsigns.includes(d.callsign))
        .sort((a, b) => a.sortTime - b.sortTime)
})

let esdataSubscription: any = undefined
onMounted(() => {
    esdataSubscription = esdata.subscribe()
})

onUnmounted(() => {
    esdata.unsubscribe(esdataSubscription)
})
</script>
