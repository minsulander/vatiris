<template>
    <div v-if="arrivals.length === 0" class="text-center">
        <div v-if="vatsim.refreshing || fdp.fdp.loading || esdata.loading">Loading...</div>
        <div v-else>No arrivals</div>
    </div>
    <table v-else style="border-collapse: collapse; width: 100%">
        <thead>
            <tr style="position: sticky; top: 0; margin-bottom: 20px; background: #ddd">
                <th>Flight</th>
                <th>Type</th>
                <th v-if="multipleAirports">DEST</th>
                <th>Park</th>
                <th>STA</th>
                <th>ETA</th>
                <th>Status</th>
                <th>DEP</th>
            </tr>
        </thead>
        <tr v-for="arr in arrivals" :key="arr.callsign">
            <td class="font-weight-medium">{{ arr.callsign }}</td>
            <td>{{ arr.type }}</td>
            <td v-if="multipleAirports">{{ arr.ades }}</td>
            <td class="font-weight-medium">{{ arr.stand }}</td>
            <td>{{ arr.sta }}</td>
            <td>{{ arr.eta }}</td>
            <td>{{ esdata.statusLabel[arr.status] || arr.status }}</td>
            <td>{{ arr.adep }}</td>
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
    background: #ec6;
}
table tr:nth-child(odd) {
    background: #fe8;
}
table td {
    user-select: auto;
}
</style>

<script setup lang="ts">
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { useAirportStore } from "@/stores/airport"
import { computed, onMounted, onUnmounted, reactive, type PropType } from "vue"
import { distanceToAirport, flightplanArrivalTime } from "@/flightcalc"
import moment from "moment"
import constants from "@/constants"
import * as turf from "@turf/turf"

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
const multipleAirports = computed(() => props.airports.length == 0 || props.airports.length > 1)

interface Arrival {
    callsign: string
    type: string
    ades: string
    stand: string
    sta: string
    eta: string
    status: string
    adep: string
    sortTime: number
}

const arrivals = computed(() => {
    if (!vatsim.data || !vatsim.data.pilots) return []
    // Start with VATSIM pilots
    let arrivals = vatsim.data.pilots
        .filter(
            (pilot) =>
                pilot.flight_plan &&
                ((props.airports.length == 0 && pilot.flight_plan.arrival.startsWith("ES")) ||
                    (props.airports.length > 0 &&
                        props.airports.includes(pilot.flight_plan.arrival))),
        )
        .map((pilot) => {
            return {
                callsign: pilot.callsign,
                type: pilot.flight_plan?.aircraft_short,
                ades: pilot.flight_plan?.arrival,
                sta: flightplanArrivalTime(pilot.flight_plan)?.format("HHmm"),
                adep: pilot.flight_plan?.departure,
                sortTime: flightplanArrivalTime(pilot.flight_plan)
                    ?.utc()
                    .diff(moment().utc(), "seconds"),
                stand:
                    pilot.groundspeed < constants.motionGroundspeed
                        ? airportStore.getStandNameAtLocation(pilot.flight_plan?.arrival, [
                              pilot.longitude,
                              pilot.latitude,
                          ])
                        : "",
            } as Arrival
        })
    for (const arr of arrivals) {
        // Add FDP flight info
        if (
            fdp.fdp &&
            fdp.fdp.general &&
            fdp.fdp.general.update_timestamp &&
            fdp.fdp.flights &&
            arr.callsign in fdp.fdp.flights
        ) {
            const fdpFlight = fdp.fdp.flights[arr.callsign]
            const prediction = fdpFlight.prediction
            if (prediction) {
                const lastLeg = prediction.legs[prediction.legs.length - 1]
                arr.sortTime = lastLeg.time
                arr.eta = moment(fdp.fdp.general.update_timestamp)
                    .add(lastLeg.time, "seconds")
                    .utc()
                    .format("HHmm")
            }
        } else if (arr.ades in airportStore.airports) {
            const airport = airportStore.airports[arr.ades]
            const pilot = vatsim.data.pilots.find((p) => p.callsign === arr.callsign)
            const distance = distanceToAirport(pilot, airport)
            if (pilot) {
                if (pilot.groundspeed >= constants.inflightGroundspeed) {
                    const seconds = (distance / pilot.groundspeed) * 3600
                    arr.sortTime = seconds
                    arr.eta = moment().utc().add(seconds, "seconds").format("HHmm")
                    arr.status = "NOFDP"
                } else if (distance < constants.atAirportDistance) {
                    arr.status = "LAND"
                    arr.sortTime = 0
                } else {
                    arr.status = "STAT"
                }
            }
        }
        // Add Euroscope data if there is any
        if (esdata.data && arr.callsign in esdata.data) {
            const esd = esdata.data[arr.callsign]
            if (esd.groundstate) arr.status = esd.groundstate
            if (!arr.stand) arr.stand = esd.stand
        }
        // Skip departure statuses if departed or closer to arrival than departure
        if (
            ["ONFREQ", "DE-ICE", "STARTUP", "PUSH", "TAXI", "LINEUP", "DEPA"].includes(arr.status)
        ) {
            const pilot = vatsim.data.pilots.find((p) => p.callsign === arr.callsign)
            const depAirport = airportStore.airports[arr.adep]
            const fdpFlight = fdp.fdp.flights[arr.callsign]
            if (
                (pilot &&
                    depAirport &&
                    distanceToAirport(pilot, depAirport) > constants.atAirportDistance) ||
                (fdpFlight &&
                    (fdpFlight.departure_distance > constants.atAirportDistance ||
                        fdpFlight.arrival_distance < fdpFlight.departure_distance))
            ) {
                arr.status = ""
            }
        }
    }
    return arrivals
        .filter((arr) => arr.sortTime < 3600 && !props.excludeStatus.includes(arr.status))
        .sort((a, b) => (esdata.statusOrder[b.status] || 0) - (esdata.statusOrder[a.status] || 0))
        .sort((a, b) => a.sortTime - b.sortTime)
})

let fdpSubscription: any = undefined
let esdataSubscription: any = undefined

onMounted(() => {
    fdpSubscription = fdp.subscribe()
    esdataSubscription = esdata.subscribe()
})

onUnmounted(() => {
    fdp.unsubscribe(fdpSubscription)
    esdata.unsubscribe(esdataSubscription)
})
</script>
