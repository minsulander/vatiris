<template>
    <div class="cdm-actions">
        <div class="section">
            <div class="section-title">REA / SIR</div>
            <div class="row">
                <v-text-field
                    v-model="reaCallsign"
                    label="Callsign"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="field"
                />
                <v-btn size="small" color="primary" :disabled="!reaCallsign" @click="sendRea(true)">
                    REA
                </v-btn>
                <v-btn size="small" color="grey" :disabled="!reaCallsign" @click="sendRea(false)">
                    REA-
                </v-btn>
                <v-btn size="small" color="primary" :disabled="!reaCallsign" @click="sendSir(true)">
                    SIR
                </v-btn>
                <v-btn size="small" color="grey" :disabled="!reaCallsign" @click="sendSir(false)">
                    SIR-
                </v-btn>
            </div>
        </div>

        <div class="section">
            <div class="section-title">DLA</div>
            <div class="row">
                <v-text-field
                    v-model="dlaCallsign"
                    label="Callsign"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="field"
                />
                <v-text-field
                    v-model="dlaTime"
                    label="DLA (HHmm)"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="field time-field"
                />
                <v-btn size="small" color="primary" :disabled="!canSendDla" @click="sendDla">
                    Send
                </v-btn>
            </div>
        </div>

        <div v-if="message" class="message" :class="messageType">{{ message }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import useEventBus from "@/eventbus"
import { useIfpsStore } from "@/stores/ifps"

const ifps = useIfpsStore()
const bus = useEventBus()

const reaCallsign = ref("")
const dlaCallsign = ref("")
const dlaTime = ref("")

const message = ref("")
const messageType = ref<"success" | "error">("success")

const canSendDla = computed(() => {
    return !!dlaCallsign.value && /^\d{3,4}$/.test(dlaTime.value)
})

function setMessage(text: string, type: "success" | "error") {
    message.value = text
    messageType.value = type
    setTimeout(() => {
        if (message.value === text) message.value = ""
    }, 4000)
}

function normalizeCallsign(value: string) {
    return value.trim().toUpperCase()
}

function normalizeTime(value: string) {
    const digits = value.replace(/\D/g, "")
    if (digits.length === 3) return `0${digits}`
    if (digits.length >= 4) return digits.slice(0, 4)
    return digits
}

async function sendRea(enabled: boolean) {
    const callsign = normalizeCallsign(reaCallsign.value)
    if (!callsign) return
    try {
        await ifps.sendDpi(callsign, `REA/${enabled ? "1" : "0"}`)
        setMessage(`REA ${enabled ? "set" : "cleared"} for ${callsign}`, "success")
    } catch (error) {
        setMessage(`Failed to send REA for ${callsign}`, "error")
    }
}

async function sendSir(enabled: boolean) {
    const callsign = normalizeCallsign(reaCallsign.value)
    if (!callsign) return
    try {
        await ifps.sendDpi(callsign, `SIR/${enabled ? "1" : "0"}`)
        setMessage(`SIR ${enabled ? "set" : "cleared"} for ${callsign}`, "success")
    } catch (error) {
        setMessage(`Failed to send SIR for ${callsign}`, "error")
    }
}

async function sendDla() {
    const callsign = normalizeCallsign(dlaCallsign.value)
    const time = normalizeTime(dlaTime.value)
    if (!callsign || !time) return
    try {
        await ifps.sendDpi(callsign, `DLA/${time}`)
        setMessage(`DLA ${time} sent for ${callsign}`, "success")
    } catch (error) {
        setMessage(`Failed to send DLA for ${callsign}`, "error")
    }
}

bus.on("cdm-actions:prefill", (callsign?: string) => {
    if (!callsign) return
    const normalized = normalizeCallsign(callsign)
    reaCallsign.value = normalized
    dlaCallsign.value = normalized
})
</script>

<style scoped>
.cdm-actions {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.section {
    border: 1px solid #ccc;
    padding: 8px;
    border-radius: 4px;
    background: #f7f7f7;
}

.section-title {
    font-weight: 600;
    margin-bottom: 6px;
    color: #444;
}

.row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.field {
    min-width: 140px;
    max-width: 200px;
}

.time-field {
    max-width: 120px;
}

.message {
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.message.success {
    background: #e6f4ea;
    color: #1b5e20;
}

.message.error {
    background: #fbe9e7;
    color: #b71c1c;
}
</style>
