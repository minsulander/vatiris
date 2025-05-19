<template>
    <div class="timer-creator" :class="`${timerType}`">
        <div class="timer-creator-form">
            <div class="timer-value-inputs">
                <div class="titleInputField">
                    <label for="titleInputField">
                        <span>TITLE</span>
                    </label>
                    <input
                        type="text"
                        id="titleInputField"
                        placeholder="REQUIRED"
                        v-model="timerName"
                    />
                </div>

                <div class="duration-and-type-inputs">
                    <div v-if="timerType !== 'STOPWATCH'">
                        <label for="durationInputField">
                            <span v-if="timerType === 'COUNTDOWN'">DURATION (MINUTES)</span>
                        </label>
                        <input
                            type="number"
                            id="durationInputField"
                            placeholder="DURATION"
                            v-model.number="timerDuration"
                            min="1"
                            step="1"
                            required
                            @input="onDurationInput"
                        />
                    </div>
                    <div class="timer-type-toggle">
                        <label for="typeToggleButton">
                            <span>TOGGLE TYPE</span>
                        </label>
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
            </div>

            <div>
                <label for="createButton">
                    <span v-if="!timerName">TITLE REQUIRED</span>
                    <span v-else-if="timerType === 'COUNTDOWN' && !timerDuration">
                        DURATION REQUIRED
                    </span>
                    <span v-else>
                        CREATE TIMER
                    </span>
                </label>
                <button id="createButton" @click="createTimer" :disabled="!timerName">
                    CREATE
                </button>
            </div>
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
                    <tr v-for="(timer, index) in timerData.timers" :key="index" :class="timer.duration ? 'COUNTDOWN' : 'STOPWATCH'">
                        <td>{{ timer.name }}</td>
                        <td class="type">{{ timer.duration ? "COUNTDOWN" : "STOPWATCH" }}</td>
                        <td>{{ timer.duration }}</td>
                        <td>
                            <button @click="deleteTimer(index)" class="delete-button">
                                DELETE
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, reactive } from "vue"
import { useAuthStore } from "@/stores/auth"
import useEventBus from "@/eventbus"

interface Timer {
    name: string
    duration: number | null
}

const timerType = ref("COUNTDOWN")
const auth = useAuthStore()
const timerName = ref("")
const timerData = reactive({
    timers: [] as Timer[],
})
const timerDuration = ref<number | null>(1)

function toggleTimerType() {
    if (timerType.value === "COUNTDOWN") {
        timerType.value = "STOPWATCH"
        timerDuration.value = null
    } else {
        timerType.value = "COUNTDOWN"
        timerDuration.value = 1
    }
}

watch(
    () => auth.user,
    async () => {
        if (auth.user) fetchContent()
    },
)

function deleteTimer(index: number) {
    timerData.timers.splice(index, 1)
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}

onMounted(() => {
    if (auth.user) fetchContent()
})

const bus = useEventBus()
bus.on("refresh", () => {
    if (auth.user) fetchContent()
})

function fetchContent() {
    auth.fetchUserData("timerData").then((data) => {
        if (!data) {
            auth.postUserData("timerData", { timers: [] })
            return
        }
        timerData.timers = data.timers
    })
}
function createTimer() {
    if (
        typeof timerName.value !== "string"
    ) {
        return
    }
    const timer: Timer = {
        name: timerName.value,
        duration: timerType.value === "STOPWATCH" ? null : timerDuration.value || 1,
    }
    timerName.value = ""
    timerDuration.value = null
    timerData.timers = [...timerData.timers, timer]
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}
function onDurationInput(event: Event) {
    const input = event.target as HTMLInputElement
    input.value = input.value.replace(/\D/g, "")
    timerDuration.value = input.value ? Number(input.value) : null
}
</script>

<style scoped>
label {
    display: block;
    margin-bottom: 4px;
}
.timer-creator {
    font-size: small;
}
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
#createButton {
    width: 100%;
}
.duration-and-type-inputs {
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    justify-content: center;
}
.STOPWATCH .duration-and-type-inputs {
    display: grid;
    gap: 5px;
    grid-template-columns: 1fr;
    align-items: center;
    justify-content: center;
}
#titleInputField {
    width: 100%;
}

tr.STOPWATCH td.type{
    color: green !important;
} 

tr.COUNTDOWN td.type{
    color: red !important;
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
.delete-button {
    background: red;
    color: white;
    border: 1px solid gray;
    padding-left: 5px;
    padding-right: 5px;
    cursor: pointer;
}
.delete-button:hover {
    background: rgb(200, 0, 0);
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

#typeToggleButton {
    width: 100%;
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
    border-collapse: separate;
    border-spacing: 0 5px;
}
</style>
