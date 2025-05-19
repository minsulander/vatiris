<template>
    <div class="timer-creator" :class="`${timerType}`" >
        <div class="timer-creator-form">
            <div class="timer-value-inputs">
                <input type="text" class="titleInputField" placeholder="TITLE" v-model="timerName" />
                <div class="duration-and-type-inputs">
                    <input
                        v-if="timerType !== ''"
                        type="number"
                        id="durationInputField"
                        placeholder="DURATION"
                        default="0"
                        v-model.number="timerDuration"
                        min="1"
                        required
                    />
                    <button
                        id="typeToggleButton"
                        type="button"
                        @click="toggleTimerType"
                        :class="{ active: timerType === 'STOPWATCH' }"
                    >
                        {{ timerType }}
                    </button>
                </div>
            </div>

            <button @click="createTimer">CREATE</button>
        </div>
        <div class="timers-list">
            <table>
                <thead>
                    <tr>
                        <th>TYPE</th>
                        <th>TYPE</th>
                        <th>DURATION</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(timer, index) in timerData.timers" :key="index">
                        <td>{{ timer.name }}</td>
                        <td>{{ timer.duration ? "COUNTDOWN" : "STOPWATCH" }}</td>
                        <td>{{ timer.duration }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="debug">
            <span>{{ timerData }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue"
import { useAuthStore } from "@/stores/auth"

interface Timer {
    name: string
    duration: number | null
}

const timerType = ref("COUNTDOWN")
const auth = useAuthStore()
const timerName = ref("")
let timerData = {
    timers: [] as Timer[],
}
const timerDuration = ref<number | null>(null)

function toggleTimerType() {
    if (timerType.value === "COUNTDOWN") {
        timerType.value = "STOPWATCH"
        timerDuration.value = null
    } else {
        timerType.value = "COUNTDOWN"
    }
}

watch(
    () => auth.user,
    async () => {
        if (auth.user) fetchContent()
    },
)

onMounted(() => {
    if (auth.user) fetchContent()
})

function fetchContent() {
    auth.fetchUserData("timerData").then((data) => {
        if (!data) {
            auth.postUserData("timerData", { timers: [] })
            return
        }
        timerData = data
    })
}
function createTimer() {
    if (
        typeof timerName.value !== "string" ||
        (typeof timerDuration.value !== "number" && timerDuration.value)
    ) {
        return
    }
    const timer: Timer = {
        name: timerName.value,
        duration: timerDuration.value,
    }
    timerName.value = ""
    timerDuration.value = null
    timerData.timers = [...timerData.timers, timer]
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}
</script>

<style scoped>
option,
select {
    color: black !important;
    outline: none;
    border: 1px solid black;
}
input {
    border: 1px solid black;
    padding: 0.5px;
    outline: none;
    color: black !important;
}

.duration-and-type-inputs {
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr;
    align-items: center;
    justify-content: center;
}

.timer-creator-form {
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    align-items: center;
    justify-content: center;
}
.STOPWATCH .titleInputField {
    grid-column: span 2;
}
.STOPWATCH .timer-value-inputs {
    grid-column: span 4;
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    justify-content: center;
}
.COUNTDOWN .timer-value-inputs {
    grid-column: span 4;
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    justify-content: center;
}
.timer-creator {
    margin: 3px;
}
span {
    color: gray;
}
button {
    border: 1px solid black;
    padding: 0.5px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
</style>
