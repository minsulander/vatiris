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
                        :placeholder="defaultTimerName"
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
                    <span>
                        DEFAULTS TO {{ defaultTimerName }}
                    </span>
                </label>
                <button id="createButton" @click="createTimer">
                    CREATE
                </button>
            </div>
        </div>
        <div class="timers-list">
            <table>
                <thead>
                    <tr>
                        <th>TITLE</th>
                        <th>TYPE</th>
                        <th>DURATION</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(timer, index) in timerData.timers"
                        :key="index"
                        :class="timer.duration ? 'COUNTDOWN' : 'STOPWATCH'"
                    >
                        <td>
                            <input
                                class="table-input"
                                type="text"
                                v-model="timer.name"
                                @change="changeTimerName(timer.name, index)"
                            />
                        </td>
                        <td class="type">
                            <button @click="toggleTimerTypeForTimerByIndex(index)">{{ timer.duration ? "COUNTDOWN" : "STOPWATCH" }}</button>
                        </td>
                        <td>
                            <input
                            class="duration-input table-input"
                                v-if="timer.duration !== null"
                                type="number"
                                min="1"
                                step="1"
                                v-model.number="timer.duration"
                                @input="onDurationInput"
                                @change="changeTimerDuration(timer.duration, index)"
                            />
                        </td>
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
import { ref, watch, onMounted, reactive, computed } from "vue"
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
function changeTimerName(name: string, index: number) {
    timerData.timers[index].name = name
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}
function changeTimerDuration(duration: number | null, index: number) {
    timerData.timers[index].duration = duration
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}
onMounted(() => {
    if (auth.user) fetchContent()
})

function toggleTimerTypeForTimerByIndex(index: number) {
    const timer = timerData.timers[index]
    if (timer.duration !== null) {
        timer.duration = null
    } else {
        timer.duration = 1
    }
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}

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

const defaultTimerName = computed(() => {
    let nextNumber = 1
    const existingNames = timerData.timers.map(t => t.name.toLowerCase())
    while (existingNames.includes(`TIMER ${nextNumber}`)) {
        nextNumber++
    }
    return `TIMER ${nextNumber}`
})

function createTimer() {
    const nameToUse = timerName.value && timerName.value.trim() !== ""
        ? timerName.value
        : defaultTimerName.value

    const timer: Timer = {
        name: nameToUse,
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
    let value = input.value ? Number(input.value) : 1

    if (value < 1) {
        value = 1
        input.value = "1"
    }

    if (input.id === "durationInputField") {
        timerDuration.value = value
    } else {
        const tr = input.closest("tr")
        if (tr) {
            const rows = Array.from(tr.parentElement?.children || [])
            const index = rows.indexOf(tr)
            if (index !== -1 && timerData.timers[index]) {
                timerData.timers[index].duration = value
            }
        }
    }
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
.duration-input.table-input {
   padding-left : 5px;
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

tr.STOPWATCH td.type {
    color: green !important;
}

tr.COUNTDOWN td.type {
    color: red !important;
}
span {
    font-size:12px;
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
td.type button {
    width: 90%;
    border: 0.5px solid black;
}
.table-input {
    border: 0.5px solid black;

    width: 95%;
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
