<template>
    <div v-if="departures.length === 0" class="text-center">No departures</div>
    <table v-else style="border-collapse: collapse; width: 100%">
        <thead>
            <tr style="position: sticky; top: 20px; margin-bottom: 20px; background: #ddd">
                <th>Flight</th>
                <th>Park</th>
                <th>STD</th>
                <th>Status</th>
                <th>DEST</th>
            </tr>
        </thead>
        <tr v-for="dep in departures" :key="dep.callsign">
            <td class="font-weight-medium">{{ dep.callsign }}</td>
            <td class="font-weight-medium">{{ dep.stand }}</td>
            <td>{{ dep.std }}</td>
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
import { computed, onMounted, onUnmounted } from "vue"
import { flightplanDepartureTime } from "@/flightcalc"
import moment from "moment"

const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()

interface Departure {
    callsign: string
    stand: string
    std: string
    status: string
    ades: string
}

const departures = computed(() => {
    if (!vatsim.data || !vatsim.data.pilots) return []
    let departures = vatsim.data.pilots
        .filter((pilot) => pilot.flight_plan?.departure.startsWith("ES"))
        .map((pilot) => {
            return {
                callsign: pilot.callsign,
                stand: "",
                std: moment(flightplanDepartureTime(pilot.flight_plan)).format("HHmm"),
                status: "",
                ades: pilot.flight_plan?.arrival,
            }
        })
    for (const dep of departures) {
        if (dep.callsign in esdata.data) {
            dep.stand = esdata.data[dep.callsign].stand
            dep.status = esdata.data[dep.callsign].groundstate
        }
    }
    return departures
})

let esdataSubscription: any = undefined
onMounted(() => {
    esdataSubscription = esdata.subscribe()
})

onUnmounted(() => {
    esdata.unsubscribe(esdataSubscription)
})

</script>
