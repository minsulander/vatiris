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
import moment, { duration } from "moment"
import { onMounted, onUnmounted, ref, watch } from "vue"
import useEventBus from "@/eventbus"
import Submenu from "@/components/menu/Submenu.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const bus = useEventBus()

let timers = ref([] as any[])

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

let savedTimers = ref([
    { name: "snigel", duration: 1, isStopwatch: true },
])

const submenuItems = ref({})

function formatTimerLabel(timer: any) {
    console.log("formatTimerLabel", timer)
    if (timer.isStopwatch) return `${timer.name} (stopwatch)`
    if (timer.duration) return `${timer.name} (${timer.duration} min)`
    return timer.name
}

watch(
    savedTimers,
    (timers) => {
        console.log("watch timers", timers)
        const items: Record<string, string> = { "TIMER CREATOR": "timerCreator" }
        timers.forEach((timer, idx) => {
            items[formatTimerLabel(timer)] = `timer:${idx}`
        })
        console.log("submenuItems", items)
        submenuItems.value = items
    },
    { immediate: true },
)
</script>
