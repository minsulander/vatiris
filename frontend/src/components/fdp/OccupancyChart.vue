<template>
    <div style="width: 100%; height: 100%">
        <div style="position: relative">
            <div
                v-if="occupancy && occupancy.general"
                style="position: absolute; right: 0; top: 0; padding-right: 5px; font-size: 12px"
            >
                <div
                    v-if="moment(occupancy.general.update_timestamp).diff(moment(), 'minutes') < -8"
                    class="text-orange-darken-3 font-weight-bold"
                >
                    {{
                        moment(occupancy.general.update_timestamp)
                            .utc()
                            .format("YYYY-MM-DD HH:mm:ss")
                    }}
                </div>
                <div v-else>
                    {{ moment(occupancy.general.update_timestamp).utc().format("HH:mm") }}
                </div>
            </div>
        </div>
        <Bar
            v-if="slots.length > 0"
            :data="chartData"
            :options="chartOptions"
            style="padding-top: 10px"
        />
        <div v-else class="text-center pt-5">
            <div v-if="occupancyStore.occupancy.loading">Loading...</div>
            <div v-else>No traffic or no data available</div>
        </div>
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
} from "chart.js"
import { computed, onMounted, onUnmounted } from "vue"
import moment from "moment"
import { useOccupancyStore } from "@/stores/occupancy"
import annotationPlugin from "chartjs-plugin-annotation"

ChartJS.register(Title, BarElement, CategoryScale, LinearScale, TimeScale, annotationPlugin)

const props = defineProps({
    sectors: {
        type: Array<string>,
        required: true,
        default: () => ["ARRW", "ARRE"],
    },
    maintainAspectRatio: {
        type: Boolean,
        default: false,
    },
    tooltip: {
        type: Boolean,
        default: false,
    },
    yellowThreshold: {
        type: Number,
        default: undefined,
    },
    redThreshold: {
        type: Number,
        default: undefined,
    },
})

if (props.tooltip) ChartJS.register(Tooltip)

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
    if (!(occupancy.value && occupancy.value.sectors)) return []
    const slots = [] as any[]
    for (const sec of props.sectors) {
        if (sec in occupancy.value.sectors) {
            for (const slot of occupancy.value.sectors[sec]) {
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
    return slots.sort((a, b) => moment(a.time).diff(moment(b.time)))
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
                backgroundColor: "#16e",
                data: valuesInactive.value,
            },
        ],
    }
})

const maxValue = computed(() => {
    if (slots.value.length === 0) return 0
    const maxActive = Math.max(...valuesActive.value)
    const maxInactive = Math.max(...valuesInactive.value)
    const maxTotal = Math.max(...slots.value.map((slot) => slot.occupants.length))
    return Math.max(maxActive + maxInactive, maxTotal)
})

const yAxisMax = computed(() => {
    if (props.yellowThreshold !== undefined && props.yellowThreshold !== null) {
        // Show minimum yellow + 2, not necessarily red if traffic is low
        const minDisplay = props.yellowThreshold + 2
        if (props.redThreshold !== undefined && props.redThreshold !== null && maxValue.value > props.redThreshold) {
            return Math.max(minDisplay, props.redThreshold + 1)
        }
        return Math.max(minDisplay, maxValue.value + 1)
    }
    return Math.max(maxValue.value + 1, 1)
})

const chartOptions = computed(() => {
    const annotations: any = {
        timeline: {
            type: "line",
            xMax: nowIndex.value,
            xMin: nowIndex.value,
            borderWidth: 1,
            borderColor: "#666",
        },
    }

    // Add yellow threshold line (slightly more orange)
    if (props.yellowThreshold !== undefined && props.yellowThreshold !== null) {
        annotations.yellowThreshold = {
            type: "line",
            yMin: props.yellowThreshold,
            yMax: props.yellowThreshold,
            borderColor: "#ff8c00", // Orange color (slightly more orange than yellow)
            borderWidth: 2,
            // borderDash omitted for solid line
        }
    }

    // Add red threshold line
    if (props.redThreshold !== undefined && props.redThreshold !== null) {
        annotations.redThreshold = {
            type: "line",
            yMin: props.redThreshold,
            yMax: props.redThreshold,
            borderColor: "#ff0000", // Red color
            borderWidth: 2,
            // borderDash omitted for solid line
        }
    }

    return {
        responsive: true,
        maintainAspectRatio: props.maintainAspectRatio,
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
                    },
                },
            },
            annotation: {
                annotations,
            },
        },
        scales: {
            x: {
                type: "category",
                stacked: true,
                ticks: {
                    minRotation: 0,
                    maxRotation: 0,
                    callback: (value: any, index: number) => {
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
                max: yAxisMax.value,
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
