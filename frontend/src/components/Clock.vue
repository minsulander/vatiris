<template>
    <div>
        <span @click="clickTime" style="cursor: pointer">{{ time }}</span>
        <span v-if="timer" @click="clickTimer" class="ml-2" style="cursor: pointer">{{
            moment(timerElapsed).utc().format("mm:ss")
        }}</span>
        <submenu :items="submenuItems" />
    </div>
</template>

<script setup lang="ts">
import moment from "moment"
import { onMounted, onUnmounted, ref, watch, toRefs, computed } from "vue"
import useEventBus from "@/eventbus"
import Submenu from "@/components/menu/Submenu.vue"
import { useAuthStore } from "@/stores/auth"


const props = defineProps<{
    timers?: any[] | null
}>()
const { timers: propTimers } = toRefs(props)

const auth = useAuthStore()
const bus = useEventBus()

const savedTimers = ref([
    { name: "snigel", duration: 1, isStopwatch: true },
])


const effectiveTimers = computed({
    get: () => propTimers.value ?? savedTimers.value,
    set: (val) => {
        if (!propTimers.value) savedTimers.value = val
    }
})

const time = ref("99:99:99")
const timer = ref(false)
const timerElapsed = ref(0)

let interval: any = undefined

bus.on("refresh", () => {
    fetchTimers()
})

onMounted(() => {
    fetchTimers()
    let lastTime = Date.now()
    interval = setInterval(() => {
        time.value = moment().utc().format("HH:mm:ss")
        const timeSinceLast = Date.now() - lastTime
        lastTime = Date.now()
        if (timer.value) timerElapsed.value += timeSinceLast
    }, 250)
})

onUnmounted(() => {
    clearInterval(interval)
})

function clickTime() {
    fetchTimers()
}

function clickTimer() {
    timer.value = false
    timerElapsed.value = 0
}

function fetchTimers() {
    if (!auth.user) {
        return "not logged in"
    }

    auth.fetchUserData("timerData").then((data) => {
        if (data) {
            savedTimers.value = data.timers.map((t: any) => ({
                ...t,
                isStopwatch:
                    t.isStopwatch === true ||
                    t.isStopwatch === "true" ||
                    t.isStopwatch === 1,
            }))
        }
    })
}

const submenuItems = ref({})

function formatTimerLabel(timer: any) {
    if (timer.isStopwatch) return `${timer.name} (stopwatch)`
    if (timer.duration) return `${timer.name} (${timer.duration} min)`
    return timer.name
}

watch(
    () => effectiveTimers.value,
    (timersVal) => {
        const items: Record<string, string> = { "TIMER CREATOR": "timerCreator" }
        timersVal.forEach((timer: any, idx: number) => {
            items[formatTimerLabel(timer)] = `timer:${idx}`
        })
        submenuItems.value = items
    },
    { immediate: true },
)
</script>
