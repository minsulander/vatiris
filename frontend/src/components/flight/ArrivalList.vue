<template>
    <div v-if="arrivals.length === 0" class="text-center">No arrivals</div>
    <table v-else style="border-collapse: collapse; width: 100%">
        <thead>
            <tr style="position: sticky; top: 20px; margin-bottom: 20px; background: #ddd">
                <th>Flight</th>
                <th>Park</th>
                <th>STA</th>
                <th>ETA</th>
                <th>Status</th>
                <th>DEP</th>
            </tr>
        </thead>
        <tr v-for="arr in arrivals" :key="arr.callsign">
            <td class="font-weight-medium">{{ arr.callsign }}</td>
            <td class="font-weight-medium">{{ arr.stand }}</td>
            <td>{{ arr.sta }}</td>
            <td>{{ arr.eta }}</td>
            <td>{{ arr.status }}</td>
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
</style>

<script setup lang="ts">
import { useVatsimStore } from "@/stores/vatsim"
import { useFdpStore } from "@/stores/fdp"
import { useEsdataStore } from "@/stores/esdata"
import { computed, onMounted, onUnmounted } from "vue"
import moment from "moment"
import { flightplanArrivalTime } from "@/flightcalc"

const vatsim = useVatsimStore()
const fdp = useFdpStore()
const esdata = useEsdataStore()

interface Arrival {
    callsign: string
    stand: string
    sta: string
    eta: string
    status: string
    adep: string
}

const arrivals = computed(() => {
    if (!vatsim.data || !vatsim.data.pilots) return []
    let arrivals = vatsim.data.pilots
        .filter((pilot) => pilot.flight_plan?.arrival.startsWith("ES"))
        .map((pilot) => {
            return {
                callsign: pilot.callsign,
                stand: "",
                sta: moment(flightplanArrivalTime(pilot.flight_plan)).format("HHmm"),
                eta: "",
                status: "",
                adep: pilot.flight_plan?.departure,
            }
        })
    for (const arr of arrivals) {
        if (fdp.fdp && fdp.fdp.flights && arr.callsign in fdp.fdp.flights) {
            const prediction = fdp.fdp.flights[arr.callsign].prediction
            if (prediction) {
                const lastLeg = prediction.legs[prediction.legs.length - 1]
                arr.eta = moment().utc().add(lastLeg.time, "seconds").format("HHmm")
            }
        }
        if (esdata.data && arr.callsign in esdata.data) {
            arr.stand = esdata.data[arr.callsign].stand
            arr.status = esdata.data[arr.callsign].groundstate
        }
    }
    return arrivals
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
