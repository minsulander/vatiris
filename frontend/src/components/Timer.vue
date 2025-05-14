<template>
    <div class="timer-container">
        <button
            class="side-btn pause-btn"
            @click="togglePause"
            :title="isPaused ? 'Resume' : 'Pause'"
        >
            <span v-if="isPaused">&#9654;</span>
            <span v-else>&#10073;&#10073;</span>
        </button>
        <div class="timer-center">
            <input type="text" v-model="timerName" placeholder="TIMER NAME" />
            <span class="timer-time">{{ formattedTime }}</span>
        </div>
        <button
            class="side-btn"
            @click="resetTimer"
            title="Reset"
        >
            &#8635;
        </button>
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
.timer-container {
    display: flex;
    align-items: stretch;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
    padding: 0;
    gap: 0;
}
.side-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    font-size: 3em;
    background: #ddd;
    border: none;
    color: #777;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
    padding-left: 2px;
    height: 100%;
}
.side-btn:hover {
    color: #333;
    background: #ccc;
}

.pause-btn {
    margin-top: 1px;
}

.timer-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0;
}
input {
    background-color: #ddd;
    color: #777;
    border: none;
    outline: none;
    width: 100%;
    font-size: 1.2em;
    text-align: center;
    padding: 2px 8px;
    border-radius: 4px 4px 0 0;
    margin-bottom: 0;
}
.timer-time {
    color: #777;
    font-size: 1.4em;
    text-align: left;
    padding: 2px 8px 4px 8px;
    background: #ddd;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
}
.timer-center,
.side-btn {
    height: 100%;
}
.timer-container {
    height: 70px;
    min-height: 70px;
}
</style>
