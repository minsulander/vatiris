<template>
    <Bar :data="chartData" :options="chartOptions" />
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
} from "chart.js"
import { computed, onMounted, onUnmounted } from "vue"
import moment from "moment"
import { useOccupancyStore } from "@/stores/occupancy"
import annotationPlugin from "chartjs-plugin-annotation"

ChartJS.register(
    Title,
    Tooltip,
    BarElement,
    CategoryScale,
    LinearScale,
    TimeScale,
    annotationPlugin,
)

const props = defineProps({
    sectors: {
        type: Array<string>,
        required: true,
        default: () => ["ARRW", "ARRE"],
    },
})

const occupancyStore = useOccupancyStore()

const occupancy = computed(() => occupancyStore.occupancy)

const labels = computed(() => {
    return slots.value.map((slot) => moment(slot.time).utc().format("HHmm"))
})

const valuesActive = computed(() => {
    return slots.value.map((slot) => slot.occupants.filter((o: any) => o.active).length)
})

const valuesInactive = computed(() => {
    return slots.value.map((slot) => slot.occupants.filter((o: any) => !o.active).length)
})

const slots = computed(() => {
    const slots = [] as any[]
    for (const sec of props.sectors) {
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

const nowIndex = computed(() => {
    for (const slot of slots.value) {
        if (moment(slot.time).isAfter(moment())) {
            return slots.value.indexOf(slot) - 1
        }
    }
    return 0
})

const chartData = computed(() => {
    return {
        labels: labels.value,
        datasets: [
            {
                label: "Airborne",
                barPercentage: 1,
                categoryPercentage: 1,
                backgroundColor: "#22d",
                data: valuesActive.value,
            },
            {
                label: "Ground/Prefile",
                barPercentage: 1,
                categoryPercentage: 1,
                backgroundColor: "#55f",
                data: valuesInactive.value,
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
            annotation: {
                annotations: {
                    timeline: {
                        type: "line",
                        xMax: nowIndex.value,
                        xMin: nowIndex.value,
                        borderWidth: 1,
                        borderColor: "#666",
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
                        if (!label || !label.endsWith("0")) return undefined
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
    ;(window as any).wtf = () => {
        console.log(slots.value)
    }
})
onUnmounted(() => {
    if (subscription) occupancyStore.unsubscribe(subscription)
    subscription = undefined
})
</script>
