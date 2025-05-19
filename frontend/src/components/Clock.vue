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
            savedTimers.value = data.timers
        }
    })
}

let savedTimers = ref([
    { name: "snigel", duration: 1 },
    { name: "snigel2", duration: 2 },
    { name: "snigel3", duration: 3 },
    { name: "snigel4", duration: 4 },
    { name: "snigel5", duration: 5 },
    { name: "snigel6", duration: 6 },
    { name: "snigel7", duration: 7 },
    { name: "snigel8", duration: 8 },
    { name: "snigel9", duration: 9 },
    { name: "snigel10", duration: 10 },
])

const submenuItems = ref({})

watch(
    savedTimers,
    (newTimers) => {
        submenuItems.value = {
            "TIMER CREATOR": "timerCreator",
            ...Object.fromEntries(
                newTimers.map((timer, index) => [
                    timer.name + (timer.duration ? ` (${timer.duration} min)` : ""),
                    "timer:" + String(index),
                ]),
            ),
        }
    },
    { immediate: true },
)
</script>
