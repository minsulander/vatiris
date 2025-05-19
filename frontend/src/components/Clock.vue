<template>
    <div style="display: inline-block; position: relative;">
        <span ref="timeRef" @click="showMenu = true" style="cursor: pointer">{{ time }}</span>
        <Submenu
            v-if="showMenu"
            :items="menuItems"
            @click.stop
            @mouseleave="showMenu = false"
            style="position: absolute; z-index: 1000;"
        />
        <span v-if="timer" @click="clickTimer" class="ml-2" style="cursor: pointer">
            {{ moment(timerElapsed).utc().format("mm:ss") }}
        </span>
    </div>
</template>

<script setup lang="ts">
import moment from "moment"
import { onMounted, onUnmounted, ref, reactive, watch } from "vue"
import useEventBus from "@/eventbus"
import { useAuthStore } from "@/stores/auth"
import Submenu from "@/components/menu/Submenu.vue"

const bus = useEventBus()
const auth = useAuthStore()

const time = ref("99:99:99")
const timer = ref(false)
const timerElapsed = ref(0)
const showMenu = ref(false)
const timeRef = ref<HTMLElement | null>(null)

let interval: any = undefined

const timers = ref<{ name: string; duration: number | null }[]>([])

function fetchTimers() {
    auth.fetchUserData("timerData").then((data) => {
        timers.value = data?.timers || []
    })
}
onMounted(() => {
    let lastTime = Date.now()
    interval = setInterval(() => {
        time.value = moment().utc().format("HH:mm:ss")
        const timeSinceLast = Date.now() - lastTime
        lastTime = Date.now()
        if (timer.value) timerElapsed.value += timeSinceLast
    }, 250)
    if (auth.user) fetchTimers()
    bus.on("refresh", fetchTimers)
})
onUnmounted(() => {
    clearInterval(interval)
})

const menuItems = reactive<{ [key: string]: string }>({})
function updateMenuItems() {
    menuItems["TIMER CREATOR"] = "timerCreator"
    timers.value.forEach((t, i) => {
        menuItems[`${t.name}${t.duration ? ` (${t.duration} min)` : ""}`] = `timer:${i}`
    })
}
watch(timers, updateMenuItems, { immediate: true })

function clickTimer() {
    timer.value = false
    timerElapsed.value = 0
}
</script>
