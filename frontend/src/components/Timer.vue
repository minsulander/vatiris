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
        <span class="timer-time">{{ formattedTime }}</span>
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

const props = defineProps<{
    duration: number | null
}>()

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
    align-items: center;
    width: 100%;
    max-width: 220px;
    margin: 0 auto;
    padding: 0;
    gap: 0;
    height: 100%;
}
.side-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    font-size: 1.5em;
    background: #ddd;
    border: none;
    color: #777;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
    padding: 0;
    height: 100%;
    min-width: 36px;
}
.side-btn:hover {
    color: #333;
    background: #ccc;
}

.pause-btn {
    margin-top: 0;
}

.timer-time {
    color: #777;
    font-size: 1.2em;
    background: #ddd;
    text-align: center;
    width: 70px;
    box-sizing: border-box;
    padding: 0 6px;
    border-radius: 4px;
    margin: 0 4px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
