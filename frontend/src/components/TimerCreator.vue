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
                            <span v-if="timerType === 'COUNTDOWN'">DURATION (MIN.SEC)</span>
                        </label>
                        <input
                            type="text"
                            id="durationInputField"
                            placeholder="DURATION (e.g. 5.30)"
                            v-model="timerDurationInput"
                            min="1"
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
                    <span> DEFAULTS TO {{ defaultTimerName }} </span>
                </label>
                <button id="createButton" @click="createTimer">CREATE</button>
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
                        :class="timer.isStopwatch ? 'STOPWATCH' : 'COUNTDOWN'"
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
                            <button @click="toggleTimerTypeForTimerByIndex(index)">
                                {{ timer.isStopwatch ? "STOPWATCH" : "COUNTDOWN" }}
                            </button>
                        </td>
                        <td>
                            <input
                                class="duration-input table-input"
                                v-if="!timer.isStopwatch"
                                type="text"
                                :value="formatDuration(timer.duration)"
                                @input="onTableDurationInput($event, index)"
                            />
                        </td>
                        <td>
                            <button @click="deleteTimer(index)" class="delete-button">
                                DELETE
                            </button>
                        </td>
                        <td><button class="open-button" @click="openTimer(index)">OPEN</button></td>
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
    duration: [number, number]
    isStopwatch: boolean
}

const timerType = ref("COUNTDOWN")
const auth = useAuthStore()
const timerName = ref("")
const timerData = reactive({
    timers: [] as Timer[],
})
const timerDurationInput = ref<string>("1.00")
function toggleTimerType() {
    if (timerType.value === "COUNTDOWN") {
        timerType.value = "STOPWATCH"
        timerDurationInput.value = "1.00"
    } else {
        timerType.value = "COUNTDOWN"
        timerDurationInput.value = "1.00"
    }
}

function openTimer(index: number) {
    bus.emit("select", "timer:" + index)
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
    bus.emit("unselect", "timer-" + index)
}
function changeTimerName(name: string, index: number) {
    timerData.timers[index].name = name
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}

onMounted(() => {
    if (auth.user) fetchContent()
})

function toggleTimerTypeForTimerByIndex(index: number) {
    const timer = timerData.timers[index]
    timer.isStopwatch = !timer.isStopwatch
    if (!timer.isStopwatch) {
        timer.duration = [1, 0]
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

        timerData.timers = (data.timers || []).map((t: any) => {
            if (typeof t.isStopwatch === "boolean") return t
            return {
                name: t.name,
                duration: t.duration === null ? 1 : t.duration,
                isStopwatch: t.duration === null,
            }
        })
    })
}

const defaultTimerName = computed(() => {
    let nextNumber = 1
    const existingNames = timerData.timers.map((t) => t.name.toLowerCase())
    while (
        existingNames.includes(
            timerType.value == "STOPWATCH" ? `sw ${nextNumber}` : `timer ${nextNumber}`,
        )
    ) {
        nextNumber++
    }
    if (timerType.value == "STOPWATCH") return `SW ${nextNumber}`
    return `TIMER ${nextNumber}`
})

function parseDurationTuple(input: string): [number, number] {
    const cleaned = input.replace(/[^0-9.]/g, "")
    const [minStr, secStr] = cleaned.split(".")
    const minutes = Number(minStr) || 0
    let seconds = secStr ? Number(secStr.padEnd(2, "0")) : 0
    if (seconds > 59) seconds = 59
    return [minutes, seconds]
}

function formatDuration(duration: [number, number]) {
    return `${duration[0]}.${duration[1].toString().padStart(2, "0")}`
}

function createTimer() {
    const nameToUse =
        timerName.value && timerName.value.trim() !== "" ? timerName.value : defaultTimerName.value

    const durationTuple =
        timerType.value === "STOPWATCH" ? [1, 0] : parseDurationTuple(timerDurationInput.value)

    const timer: Timer = {
        name: nameToUse,
        duration: [durationTuple[0] ?? 0, durationTuple[1] ?? 0],
        isStopwatch: timerType.value === "STOPWATCH",
    }
    timerName.value = ""
    timerDurationInput.value = "1.00"
    timerData.timers = [...timerData.timers, timer]
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
}

function onDurationInput(event: Event) {
    const input = event.target as HTMLInputElement
    input.value = input.value.replace(/[^0-9.]/g, "")
    timerDurationInput.value = input.value
}

function onTableDurationInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement
    input.value = input.value.replace(/[^0-9.]/g, "")
    timerData.timers[index].duration = parseDurationTuple(input.value)
    auth.postUserData("timerData", timerData).then(() => {
        fetchContent()
    })
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
    padding-left: 5px;
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
    font-size: 12px;
}
label[for="createButton"] span {
    font-size: 10px;
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
.open-button {
    background: green;
    color: white;
    border: 1px solid gray;
    padding-left: 5px;
    padding-right: 5px;
    cursor: pointer;
    width: 100%;
}
.open-button:hover {
    background: rgb(0, 103, 0);
}
.delete-button {
    background: red;
    color: white;
    border: 1px solid gray;
    padding-left: 5px;
    padding-right: 5px;
    cursor: pointer;
    width: 85%;
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
