<template>
    <div>
        <input type="text" v-model="timerName" placeholder="TIMER NAME" />
        <div style="text-align: center; ">
            <span>{{ formattedTime }}</span>
            <div style="margin-top: 8px">
                <button
                    @click="togglePause"
                    style="font-size: 1.5em; padding: 12px 32px; margin-right: 12px"
                >
                    {{ isPaused ? "RESUME" : "PAUSE" }}
                </button>
                <button @click="resetTimer" style="font-size: 1.5em; padding: 12px 32px">
                    RESET
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue"

const timerName = ref("")

const time = ref(0)
const isPaused = ref(false)
let interval: ReturnType<typeof setInterval> | undefined

function startTimer() {
    interval = setInterval(() => {
        if (!isPaused.value) {
            time.value++
        }
    }, 1000)
}

function togglePause() {
    isPaused.value = !isPaused.value
}

function resetTimer() {
    time.value = 0
    isPaused.value = false
}

const formattedTime = computed(() => {
    const minutes = Math.floor(time.value / 60)
        .toString()
        .padStart(2, "0")
    const seconds = (time.value % 60).toString().padStart(2, "0")
    return `${minutes}:${seconds}`
})

startTimer()

onUnmounted(() => {
    clearInterval(interval)
})
</script>

<style scoped>
button {
    background-color: #777;
    color: white;
}
input {
    background-color: #ddd;
    color: #777;
    border: none;
    outline: none;
    width: 100%;
    font-size: 2.5em;
    text-align: center;
    padding: 2px;
    background: #ddd;
    border-color: transparent;
}

span {
    color: #777;
    font-size: 1.6em !important;
}
</style>
