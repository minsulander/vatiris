<template>
    <div
        class="wind-rose-container"
        ref="containerRef"
        :style="{ '--computed-size': `${computedSize}px` }"
    >
        <div v-if="!id || !windData" class="pa-3 text-center">NO DATA</div>
        <template v-else>
            <div style="position: relative">
                <div
                    v-if="outdated && lastUpdate"
                    style="position: absolute; right: 3px; z-index: 100"
                    class="text-caption font-weight-bold text-orange-darken-4"
                >
                    {{ lastUpdate.replace("T", " ") }}
                </div>
            </div>
            <svg
                :width="computedSize"
                :height="computedSize"
                :viewBox="`0 0 ${size} ${size + topMargin + bottomMargin}`"
                preserveAspectRatio="xMidYMid meet"
            >
                <!-- For each runway, draw a direction line -->
                <template v-for="runway in runwayData" :key="runway.name">
                    <line
                        :x1="center + radius * -1 * Math.sin(toRadians(runway.heading))"
                        :y1="center - radius * -1 * Math.cos(toRadians(runway.heading)) + topMargin"
                        :x2="center + radius * Math.sin(toRadians(runway.heading))"
                        :y2="center - radius * Math.cos(toRadians(runway.heading)) + topMargin"
                        :stroke="'#b6b6b6'"
                        stroke-width="36"
                        :style="{
                            transition: 'all 0.3s ease-in-out',
                        }"
                    />
                </template>

                <!-- Inner filled circle (50% radius) -->
                <circle
                    :cx="center"
                    :cy="center + topMargin"
                    :r="radius * 0.5"
                    :fill="colors.background"
                    stroke="none"
                />

                <!-- Outer circle (no fill) -->
                <circle
                    :cx="center"
                    :cy="center + topMargin"
                    :r="radius"
                    fill="none"
                    :stroke="colors.circle"
                    stroke-width="2"
                />

                <!-- 10-degree tick marks -->
                <template v-for="i in 36" :key="`tick-${i}`">
                    <!-- Only draw if not a 30-degree mark -->
                    <line
                        v-if="(i * 10) % 30 !== 0"
                        :x1="getTickX(i * 10, 0)"
                        :y1="getTickY(i * 10, 0) + topMargin"
                        :x2="getTickX(i * 10, 6)"
                        :y2="getTickY(i * 10, 6) + topMargin"
                        :stroke="colors.circle"
                        stroke-width="2"
                    />
                </template>

                <!-- Heading marks every 30 degrees -->
                <template v-for="heading in headingPoints" :key="heading">
                    <!-- Heading text -->
                    <text
                        :x="getHeadingX(heading)"
                        :y="getHeadingY(heading) + topMargin"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        :fill="colors.text"
                        :font-size="size / 18"
                        font-weight="bold"
                    >
                        {{ formatHeading(heading) }}
                    </text>

                    <!-- Tick marks centered on circle -->
                    <line
                        :x1="getTickX(heading, -10)"
                        :y1="getTickY(heading, -10) + topMargin"
                        :x2="getTickX(heading, 10)"
                        :y2="getTickY(heading, 10) + topMargin"
                        :stroke="colors.circle"
                        stroke-width="2"
                    />
                </template>

                <!-- Variable wind arc -->
                <path
                    v-if="
                        windData?.vrbFrom !== undefined &&
                        windData?.vrbTo !== undefined &&
                        windData?.vrbFrom !== windData?.vrbTo &&
                        windData?.speed !== undefined &&
                        windData?.speed >= 1
                    "
                    :d="getVrbArcPath"
                    :stroke="colors.vrb"
                    fill="none"
                    stroke-width="9"
                />

                <!-- Wind direction arrow -->
                <line
                    v-if="
                        windData?.direction !== undefined &&
                        windData?.speed !== undefined &&
                        windData?.speed >= 1
                    "
                    :x1="getArrowX(0.5)"
                    :y1="getArrowY(0.5) + topMargin"
                    :x2="getArrowX(1)"
                    :y2="getArrowY(1) + topMargin"
                    :stroke="colors.arrow"
                    stroke-width="6"
                />

                <!-- Update centered wind information -->
                <text
                    :x="center"
                    :y="center + topMargin - size / 20 - (shouldReadVariable ? size / 30 : 0)"
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="colors.text"
                    :font-size="size / 7"
                    font-weight="bold"
                    v-if="windData.direction !== undefined"
                >
                    {{
                        isLargeVrbRange
                            ? "VRB"
                            : windData.speed !== undefined &&
                                windData.speed >= 1 &&
                                windData.direction !== 0
                              ? formatHeading(windData.direction)
                              : "- - -"
                    }}
                </text>
                <text
                    :x="center - (shouldReadMin || shouldReadMax ? size / 20 : 0)"
                    :y="center + topMargin + size / 12 - (shouldReadVariable ? size / 30 : 0)"
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="colors.text"
                    :font-size="size / 7"
                    font-weight="bold"
                    v-if="windData.speed !== undefined"
                >
                    {{ windData.speed.toString() }}
                    <tspan
                        v-if="!shouldReadMin && !shouldReadMax && !shouldReadGust"
                        :font-size="size / 20"
                        font-weight="normal"
                    >
                        kt
                    </tspan>
                    <tspan v-if="shouldReadGust" :font-size="size / 32" font-weight="normal">
                        GUST
                    </tspan>
                    <tspan v-if="shouldReadGust" :font-size="size / 18">{{ windData.gust }}</tspan>
                </text>
                <text
                    v-if="shouldReadMin"
                    :x="center + size / 9"
                    :y="
                        center +
                        topMargin +
                        size / 12 -
                        (shouldReadVariable ? size / 30 : 0) -
                        (shouldReadMax ? size / 35 : 0)
                    "
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="colors.text"
                    :font-size="size / 18"
                    font-weight="bold"
                >
                    <tspan :font-size="size / 32" font-weight="normal">MIN&nbsp;</tspan>
                    {{ windData.minWind }}
                </text>
                <text
                    v-if="shouldReadMax"
                    :x="center + size / 9"
                    :y="
                        center +
                        topMargin +
                        size / 12 -
                        (shouldReadVariable ? size / 30 : 0) +
                        (shouldReadMin ? size / 35 : 0)
                    "
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="colors.text"
                    :font-size="size / 18"
                    font-weight="bold"
                >
                    <tspan :font-size="size / 32" font-weight="normal">MAX&nbsp;</tspan>
                    {{ windData.maxWind }}
                </text>
                <text
                    :x="center"
                    :y="center + topMargin + size / 12 + size / 17"
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="colors.text"
                    :font-size="size / 22"
                    font-weight="bold"
                    v-if="shouldReadVariable && !isLargeVrbRange"
                >
                    {{ formatHeading(windData.vrbFrom) }} - {{ formatHeading(windData.vrbTo) }}
                </text>
            </svg>

            <!-- Update overlay to show wind information -->
            <div class="text-overlay">
                <!-- Add runway selector to top right -->
                <div class="runway-selector">
                    <template v-for="rwy in availableRunways" :key="rwy">
                        <a
                            :title="`Select runway ${rwy}`"
                            class="px-1 font-weight-bold text-caption"
                            @click="selectedRunway = rwy"
                            :style="{ color: currentRunway === rwy ? '#444' : '#999' }"
                            >{{ rwy }}</a
                        >
                    </template>
                </div>

                <!-- Main content -->
                <div class="content-rows">
                    <div class="top-row">
                        <span class="min-wind">
                            <span v-if="windData.minWind"
                                >MIN
                                <span
                                    style="font-size: 28px"
                                    :style="{
                                        'font-weight': shouldReadMin ? 'bold' : 'normal',
                                    }"
                                    >{{ windData.minWind }}</span
                                ></span
                            >
                        </span>
                        <div class="runway-info">
                            <div class="airport-code">{{ id }}</div>
                            <div class="runway-display">RWY {{ currentRunway || "--" }}</div>
                        </div>
                        <span class="max-wind">
                            <span v-if="windData.maxWind"
                                >MAX
                                <span
                                    style="font-size: 28px"
                                    :style="{
                                        'font-weight': shouldReadMax ? 'bold' : 'normal',
                                    }"
                                    >{{ windData.maxWind }}</span
                                ></span
                            >
                            <span v-else-if="windData.gust"
                                >GUST
                                <span
                                    style="font-size: 28px"
                                    :style="{
                                        'font-weight': shouldReadGust ? 'bold' : 'normal',
                                    }"
                                    >{{ windData.gust }}</span
                                ></span
                            ></span
                        >
                    </div>
                    <div class="bottom-row">
                        <div class="wind-head">
                            <span
                                v-if="
                                    windData.headWind !== undefined &&
                                    Math.abs(windData.headWind) > 0 &&
                                    windData.direction != 'VRB'
                                "
                                :class="
                                    windData.headWind < -5
                                        ? 'text-orange-darken-2 font-weight-bold'
                                        : ''
                                "
                            >
                                {{ Math.abs(windData.headWind) }} KT
                                {{ windData.headWind >= 0 ? "HEAD" : "TAIL" }}
                            </span>
                        </div>
                        <div class="wind-cross">
                            <span
                                v-if="
                                    windData.crossWind !== undefined &&
                                    windData.crossWind > 0 &&
                                    windData.direction != 'VRB'
                                "
                            >
                                {{ windData.crossWind }} KT
                                {{ windData.crossWindDir === "L" ? "LEFT" : "RIGHT" }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue"
import { useWindStore } from "@/stores/wind"
import { useSettingsStore } from "@/stores/settings"
import moment from "moment"

interface Props {
    id?: string
    dep?: boolean
    modelValue?: string
    size?: number
    colors?: {
        background?: string
        text?: string
        arrow?: string
        circle?: string
        vrb?: string
    }
}

const props = withDefaults(defineProps<Props>(), {
    id: "",
    dep: false,
    modelValue: "",
    size: 400,
    colors: () => ({
        background: "#f0f0f0",
        text: "#333333",
        arrow: "#ff4444",
        circle: "#cccccc",
        vrb: "#ffcc00",
    }),
})

const windStore = useWindStore()
const subscription = ref<string>()
const settings = useSettingsStore()
const lastUpdate = ref<string>("")
const changed = ref(false)
const outdated = ref(false)
let changeTimeouts: any[] = []
let checkOutdatedInterval: any = undefined

const selectedRunway = ref("")

const currentRunway = computed(() => {
    if (selectedRunway.value) return selectedRunway.value
    return windStore.getRunwayInUse(props.id, props.dep) || availableRunways.value[0] || ""
})

// Get wind data from wind store
const windData = computed(() => {
    if (!props.id || !(props.id in windStore.windData)) return undefined
    const data = windStore.windData[props.id]
    const runwayData = data.runways.find((r) => r.name === currentRunway.value)
    return {
        direction: runwayData?.direction || data.direction,
        speed: runwayData?.speed || data.speed,
        vrbFrom: runwayData?.variableFrom || data.variableFrom || undefined,
        vrbTo: runwayData?.variableTo || data.variableTo || undefined,
        gust: runwayData?.gust || data.gust,
        minWind: runwayData?.minWind || data.minWind,
        maxWind: runwayData?.maxWind || data.maxWind,
        headWind: runwayData?.headWind,
        crossWind: runwayData?.crossWind,
        crossWindDir: runwayData?.crossWindDir,
    }
})

// Update available runways computed
const availableRunways = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return []
    return windStore.windData[props.id].runways.map((r) => r.name).sort()
})

// Update runway data computed
const runwayData = computed(() => {
    if (!props.id || !windStore.windData[props.id]) return []

    const data = windStore.windData[props.id]
    if (!data) return []

    // If there are exactly 2 runway ends (one runway), show both ends
    if (data.runways.length === 2) {
        return data.runways.map((r) => ({
            name: r.name,
            heading: r.heading,
        }))
    }

    // Otherwise, only show selected runway
    return data.runways
        .filter((r) => r.name === currentRunway.value)
        .map((r) => ({
            name: r.name,
            heading: r.heading,
        }))
})

const containerRef = ref<HTMLDivElement | null>(null)
const containerSize = ref(0)
const bottomMargin = 0

const computedSize = computed(() => {
    return Math.min(containerSize.value, props.size)
})

const topMargin = computed(() => 35)
const center = computed(() => props.size / 2)
const radius = computed(() => (props.size / 2) * 0.9)

const shouldReadVariable = computed(() => {
    if (!windData.value) return false
    if (windData.value.speed === undefined) return false
    if (windData.value.speed < 1) return false
    if (windData.value.vrbFrom !== undefined && windData.value.vrbTo !== undefined) {
        // Always count clockwise from smaller to larger angle
        let from = windData.value.vrbFrom
        let to = windData.value.vrbTo

        // If from is larger than to, we need to add 360 to to
        if (from > to) {
            to += 360
        }

        // Now the difference will always be the clockwise distance
        const diff = to - from
        return diff >= 60 && diff < 180
    }
    return false
})

const shouldReadMin = computed(() => {
    if (!windData.value) return false
    if (windData.value.speed === undefined) return false
    if (windData.value.minWind === undefined) return false
    if (windData.value.minWind < 1) return false
    return windData.value.speed - windData.value.minWind >= 10
})

const shouldReadMax = computed(() => {
    if (!windData.value) return false
    if (windData.value.speed === undefined) return false
    if (windData.value.maxWind === undefined) return false
    if (windData.value.maxWind < 1) return false
    return windData.value.maxWind - windData.value.speed >= 10
})

const shouldReadGust = computed(() => {
    if (!windData.value) return false
    if (windData.value.speed === undefined) return false
    if (windData.value.gust === undefined) return false
    if (windData.value.gust < 1) return false
    return windData.value.gust - windData.value.speed >= 10
})

const headingPoints = Array.from({ length: 12 }, (_, i) => i * 30)

const toRadians = (degrees: number) => degrees * (Math.PI / 180)

// Heading text positions (unchanged)
const getHeadingX = (angle: number) => {
    return center.value + radius.value * 0.82 * Math.sin(toRadians(angle))
}

const getHeadingY = (angle: number) => {
    return center.value - radius.value * 0.85 * Math.cos(toRadians(angle))
}

// New tick mark calculations centered on circle
const getTickX = (angle: number, offset: number) => {
    return center.value + (radius.value + offset) * Math.sin(toRadians(angle))
}

const getTickY = (angle: number, offset: number) => {
    return center.value - (radius.value + offset) * Math.cos(toRadians(angle))
}

// New arrow calculations
const getArrowX = (multiplier: number) => {
    if (!windData.value) return 0
    if (typeof windData.value.direction != "number") return 0
    return center.value + radius.value * multiplier * Math.sin(toRadians(windData.value.direction))
}

const getArrowY = (multiplier: number) => {
    if (!windData.value) return 0
    if (typeof windData.value.direction != "number") return 0
    return center.value - radius.value * multiplier * Math.cos(toRadians(windData.value.direction))
}

const formatHeading = (heading: number | string | undefined) => {
    if (typeof heading == "undefined") return ""
    if (typeof heading == "string") return heading
    if (heading === 0) return "360"
    return heading.toString().padStart(3, "0")
}

// Resize handling
const updateSize = () => {
    if (containerRef.value) {
        containerSize.value = containerRef.value.clientWidth
    }
}

onMounted(() => {
    updateSize()
    window.addEventListener("resize", updateSize)
    if (props.id) {
        subscription.value = windStore.subscribe(props.id)

        // Add outdated check interval
        checkOutdatedInterval = setInterval(() => {
            outdated.value =
                lastUpdate.value.length > 0 &&
                moment(lastUpdate.value).isBefore(moment().subtract(5, "minutes"))
        }, 5000)
    }
})

onUnmounted(() => {
    window.removeEventListener("resize", updateSize)
    if (subscription.value) {
        windStore.unsubscribe(subscription.value)
    }
    if (checkOutdatedInterval) {
        clearInterval(checkOutdatedInterval)
    }
    for (const timeout of changeTimeouts) {
        clearTimeout(timeout)
    }
})

// Add watch for id changes
watch(
    () => props.id,
    (newId) => {
        if (subscription.value) {
            windStore.unsubscribe(subscription.value)
        }
        if (newId) {
            subscription.value = windStore.subscribe(newId)
        }
    },
)

// Add watch for wind data changes
watch(
    () => windStore.windData[props.id],
    (newValue, oldValue) => {
        if (!newValue) return

        lastUpdate.value = newValue.timestamp || ""
        changed.value = false

        if (!settings.metsensorFlash) return

        // Clear existing timeouts
        for (const timeout of changeTimeouts) clearTimeout(timeout)
        changeTimeouts.splice(0)

        // Set up flash sequence
        changed.value = true
        changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
        changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
        changeTimeouts.push(setTimeout(() => (changed.value = false), 3000))
    },
    { deep: true },
)

const getVrbArcPath = computed(() => {
    if (!windData.value) return ""

    const startAngle = windData.value.vrbFrom
    const endAngle = windData.value.vrbTo

    if (startAngle === undefined || endAngle === undefined) return ""

    const needsCrossover = startAngle > endAngle
    const sweepAngle = needsCrossover ? 360 - startAngle + endAngle : endAngle - startAngle

    const arcRadius = radius.value * 0.97

    const x1 = center.value + arcRadius * Math.sin(toRadians(startAngle))
    const y1 = center.value - arcRadius * Math.cos(toRadians(startAngle))
    const x2 = center.value + arcRadius * Math.sin(toRadians(endAngle))
    const y2 = center.value - arcRadius * Math.cos(toRadians(endAngle))

    const largeArcFlag = sweepAngle > 180 ? 1 : 0

    return `M ${x1} ${y1 + topMargin.value} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${x2} ${y2 + topMargin.value}`
})

const isLargeVrbRange = computed(() => {
    if (!windData.value?.vrbFrom || !windData.value?.vrbTo) return false

    // Always count clockwise from smaller to larger angle
    let from = windData.value.vrbFrom
    let to = windData.value.vrbTo

    // If from is larger than to, we need to add 360 to to
    if (from > to) {
        to += 360
    }

    // Now the difference will always be the clockwise distance
    const diff = to - from
    return diff >= 180
})
</script>

<style scoped>
.wind-rose-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    position: relative;
    user-select: none;
}

svg {
    width: 100%;
    height: 100%;
}

.text-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    padding: 0;
}

.runway-selector {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    gap: 0;
    pointer-events: auto;
    padding: 0;
    z-index: 1;
}

.runway-selector a {
    cursor: pointer;
    user-select: none;
    text-decoration: none;
}

.content-rows {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 5%;
    padding-top: 10;
}

.top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    color: #333333;
    margin-top: 0;
}

.runway-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    line-height: 1;
}

.airport-code {
    font-weight: 500;
    font-size: calc(var(--computed-size) / 24);
    color: #333333;
    margin-bottom: 0.2em;
}

.runway-display {
    font-weight: bold;
    font-size: calc(var(--computed-size) / 12);
    white-space: nowrap;
}

.min-wind,
.max-wind {
    font-size: calc(var(--computed-size) / 25);
    width: 30%;
}
.max-wind {
    text-align: right;
}
.bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    color: #333333;
    margin-top: 0;
    bottom: 1%;
    left: 5%;
    color: #333333;
}

.wind-cross {
    right: 0;
    text-align: right;
}

.wind-components > div {
    margin: 0.3em 0;
}

.clickable {
    cursor: pointer;
    user-select: none;
    pointer-events: auto;
}

.clickable.has-runways:hover {
    color: #666666;
}

.clickable:active {
    transform: scale(0.95);
}

.wind-rose-container.flash {
    background-color: rgba(102, 102, 255, 0.1);
}

.runway-button {
    background: none;
    border: none;
    padding: 4px 8px;
    margin: 0 2px;
    cursor: pointer;
    color: #999;
    font-weight: bold;
    font-size: calc(var(--computed-size) / 25);
    border-radius: 4px;
    pointer-events: auto;
}

.runway-button.active {
    background-color: #f0f0f0;
    color: #000;
}

.runway-button:hover {
    background-color: #f0f0f0;
    color: #000;
}
</style>
