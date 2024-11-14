<template>
    <div>
        <select v-model="selected">
            <option v-for="option in options" :key="option.title" :value="option.value">
                {{ option.title }}
            </option>
        </select>
        <Bar :data="chartData" :options="chartOptions" style="width: 100%" />
    </div>
</template>

<style scoped>
select {
    background: transparent;
    color: #aaa;
}
</style>

<script setup lang="ts">
import { Bar } from "vue-chartjs"
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    BarElement,
    CategoryScale,
    LinearScale,
    TimeScale,
    type ChartOptions,
} from "chart.js"
import { computed, onMounted, onUnmounted, reactive, ref } from "vue"
import axios from "axios"
import moment from "moment"
import { useOccupancyStore } from "@/stores/occupancy"

ChartJS.register(Title, Tooltip, BarElement, CategoryScale, LinearScale, TimeScale)

const occupancyStore = useOccupancyStore()

const selected = ref("APPW+APPE+APPS")
const options = reactive([
    { title: "APPW", value: "APPW" },
    { title: "APPW", value: "APPE" },
    { title: "TMA", value: "APPW+APPE+APPS" },
    { title: "TWR", value: "SA_TWRE+SA_TWRW" },
    { title: "S2", value: "ESOS2" },
    { title: "S7", value: "ESOS7" },
    { title: "MMK", value: "ESMMK" },
    { title: "MML", value: "ESMML" },
    { title: "MMKL", value: "ESMMK+ESMML" },
    { title: "EKCH", value: "EKCH_TWR" },
    {
        title: "ESOS-ALL",
        value: "ESOS1+ESOS2+ESOS3+ESOS4+ESOS5+ESOS6+ESOS7+ESOS8+ESOSN+ESOSF+ESOSK",
    },
])

const sectors = computed(() => {
    return selected.value.split("+")
})

const occupancy = computed(() => occupancyStore.occupancy)

const labels = computed(() => {
    return slots.value.map((slot) => moment(slot.time).utc().format("HHmm"))
})

const values = computed(() => {
    return slots.value.map((slot) => slot.occupants.filter((o: any) => !o.active).length)
})

const values2 = computed(() => {
    return slots.value.map((slot) => slot.occupants.filter((o: any) => o.active).length)
})

const slots = computed(() => {
    const slots = [] as any[]
    for (const sec of sectors.value) {
        if (sec in occupancy.value) {
            for (const slot of occupancy.value[sec]) {
                const existingSlot = slots.find((s) => s.time === slot.time)
                if (existingSlot) {
                    for (const occupant of slot.occupants) {
                        const existingOccupant = existingSlot.occupants.find(
                            (o: any) => o.callsign === occupant.callsign,
                        )
                        if (!existingOccupant) {
                            existingSlot.occupants.push(occupant)
                        }
                    }
                } else {
                    slots.push(JSON.parse(JSON.stringify(slot)))
                }
            }
        }
    }
    return slots
})

const chartData = computed(() => {
    return {
        labels: labels.value,
        datasets: [
            {
                label: "Ground/Prefile",
                barPercentage: 1,
                categoryPercentage: 1,
                backgroundColor: "#55f",
                data: values.value,
            },
            {
                label: "Airborne",
                barPercentage: 1,
                categoryPercentage: 1,
                backgroundColor: "#22d",
                data: values2.value,
            },
        ],
    }
})

const chartOptions = computed(() => {
    return {
        responsive: true,
        animation: {
            duration: 0,
        },
        plugins: {
            tooltip: {
                mode: "index",
                callbacks: {
                    footer: (context: any) => {
                      const slot = slots.value[context[0].parsed.x]
                      return `${slot.occupants.map((o: any) => o.callsign).join(", ")}`
                      // let text = ""
                      // for (const occupant of slot.occupants) {
                      //   text += `${occupant.callsign} ${moment(occupant.entry_time).format("mmss")}-${moment(occupant.exit_time).format("mmss")}\n`
                      // }
                      // return text
                    },
                },
            },
        },
        scales: {
            x: {
                type: "category",
                stacked: true,
                ticks: {
                    minRotation: 0,
                    maxRotation: 0,
                    callback: (value: any, index: number, ticks: any) => {
                        const label = labels.value[index]
                        if (!label.endsWith("0")) return undefined
                        return label.endsWith("00") ? label.substring(0, 2) : label.substring(2)
                    },
                    font: {
                        weight: (c: any) => {
                            return labels.value[c.tick.value].endsWith("00") ? "bold" : "normal"
                        },
                    },
                },
            },
            y: {
                stacked: true,
                ticks: {
                    stepSize: 1,
                    beginAtZero: true,
                },
            },
        },
    } as any
})

let subscription: any = undefined
onMounted(() => {
    subscription = occupancyStore.subscribe()
})
onUnmounted(() => {
    if (subscription) occupancyStore.unsubscribe(subscription)
    subscription = undefined
})
</script>
