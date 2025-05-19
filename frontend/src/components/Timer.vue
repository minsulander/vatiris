<template>
  <div class="timer-container">
    <button
      class="side-btn"
      @click="handleButton"
      :title="buttonTitle"
    >
      <span v-if="isRunning">&#10073;&#10073;</span>
      <span v-else>&#9654;</span>
    </button>
    <span class="timer-time">{{ formattedTime }}</span>
    <button
      v-if="duration === null"
      class="side-btn"
      @click="resetStopwatch"
      title="Reset"
    >
      &#8635;
    </button>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, computed, watch } from 'vue'

const props = defineProps<{
  duration: number | null
}>()
const { duration } = props

const initialSeconds = computed(() => (duration !== null ? duration * 60 : 0))

const time = ref(initialSeconds.value)
const started = ref(false)
const isRunning = ref(false)
let interval: ReturnType<typeof setInterval> | undefined

watch(initialSeconds, (newVal) => {
  if (!started.value && duration !== null) {
    time.value = newVal
  }
})

function startStopwatch() {
  clearInterval(interval)
  isRunning.value = true
  interval = setInterval(() => {
    time.value++
  }, 1000)
}

function startCountdown() {
  clearInterval(interval)
  isRunning.value = true
  interval = setInterval(() => {
    if (time.value > 0) {
      time.value--
    } else {
      clearInterval(interval)
      interval = undefined
      isRunning.value = false
    }
  }, 1000)
}

function resetStopwatch() {
  time.value = 0
}

function resetCountdown(pause = true) {
  time.value = initialSeconds.value
  isRunning.value = !pause
  started.value = true
  clearInterval(interval)
  interval = undefined
}

function handleButton() {
  if (duration === null) {
    if (!started.value) {
      started.value = true
      startStopwatch()
    } else if (isRunning.value) {
      isRunning.value = false
      clearInterval(interval)
      interval = undefined
    } else {
      isRunning.value = true
      startStopwatch()
    }
  } else {
    if (!started.value) {
      started.value = true
      time.value = initialSeconds.value
      startCountdown()
    } else if (time.value <= 0) {
      resetCountdown(false)
      startCountdown()
    } else if (isRunning.value) {
      resetCountdown(true)
    } else {
      isRunning.value = true
      startCountdown()
    }
  }
}

const formattedTime = computed(() => {
  const mins = Math.floor(time.value / 60)
    .toString()
    .padStart(2, '0')
  const secs = (time.value % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
})

const buttonTitle = computed(() => {
  if (duration === null) {
    return isRunning.value ? 'Pause' : (started.value ? 'Resume' : 'Start')
  }
  if (!started.value) return 'Start'
  if (time.value <= 0) return 'Restart'
  return isRunning.value ? 'Reset & Pause' : 'Resume'
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<style scoped>
.timer-container {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 260px;
  margin: 0 auto;
  padding: 0;
  gap: 4px;
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
  height: 36px;
  min-width: 36px;
  border-radius: 4px;
}
.side-btn:hover {
  color: #333;
  background: #ccc;
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
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
