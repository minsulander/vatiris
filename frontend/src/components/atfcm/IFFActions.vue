<template>
    <div ref="root" class="cdm-actions">
        <div class="section departure-section">
            <div class="section-title">Ready</div>
            <div class="section-row">
                <div class="fields">
                    <v-autocomplete
                        v-model="reaCallsign"
                        :items="departuresForCdm.callsigns"
                        label="C/S"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="field callsign-field"
                    />
                </div>
                <div class="section-actions">
                    <v-btn
                        v-if="sirSet"
                        size="small"
                        color="grey"
                        :disabled="!reaCallsign || !reaSirDataLoaded"
                        :loading="loading"
                        @click="sendSir(false)"
                    >
                        Clear SIR
                    </v-btn>
                    <v-btn
                        v-if="reaSet"
                        size="small"
                        color="grey"
                        :disabled="!reaCallsign || !reaSirDataLoaded"
                        :loading="loading"
                        @click="onClearReaClick"
                    >
                        Clear REA
                    </v-btn>
                    <v-btn
                        v-else
                        size="small"
                        color="primary"
                        :disabled="!reaCallsign || !reaSirDataLoaded"
                        :loading="loading"
                        @click="onSendReaClick"
                    >
                        Send REA
                    </v-btn>
                </div>
            </div>
        </div>

        <v-dialog v-model="showSirConfirm" max-width="400" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">Confirm SIR</v-card-title>
                <v-card-text>
                    SIR (Slot Improvement Request) is for exceptional cases requiring high priority
                    only. Are you sure you want to send SIR for {{ reaCallsign || "this flight" }}?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="showSirConfirm = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :loading="loading" @click="confirmSir">
                        Send SIR
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="showDlaConfirm" max-width="400" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">DLA not required</v-card-title>
                <v-card-text>
                    DLA is not required for EOBT changes of less than 15 minutes.
                    Send anyway for {{ dlaCallsign || "this flight" }}?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="showDlaConfirm = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :loading="loading" @click="confirmDla">
                        Send DLA
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <div class="section delay-section">
            <div class="section-title delay-header">
                <span>Delay</span>
                <span v-if="eobtTimeDiffLabel" class="eobt-diff" :class="{ 'eobt-past': eobtInPast }">{{ eobtTimeDiffLabel }}</span>
            </div>
            <div class="section-row">
                <div class="fields">
                    <v-autocomplete
                        v-model="dlaCallsign"
                        :items="departuresForCdm.callsigns"
                        label="C/S"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="field callsign-field"
                    />
                    <v-text-field
                        v-model="dlaTime"
                        label="New EOBT"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="field time-field"
                        maxlength="4"
                        placeholder="0000"
                        @input="enforceDlaFormat"
                    />
                </div>
                <div class="section-actions">
                    <v-btn size="small" color="primary" :disabled="!canSendDla" @click="onSendDlaClick">
                        Send DLA
                    </v-btn>
                </div>
            </div>
        </div>

        <div class="footer">
            <v-btn size="small" variant="outlined" @click="clearForm">
                Clear Form
            </v-btn>
            <div v-if="message" class="message" :class="messageType">{{ message }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import moment from "moment"
import { useIfpsStore } from "@/stores/ifps"
import { useDeparturesForCdmStore } from "@/stores/departuresForCdm"
import {
    cdmPrefillReady,
    cdmPrefillDelay,
    clearCdmPrefill,
} from "@/cdmPrefill"

const ifps = useIfpsStore()
const departuresForCdm = useDeparturesForCdmStore()

const root = ref<HTMLElement | null>(null)
const reaCallsign = ref("")
const dlaCallsign = ref("")
const dlaTime = ref("")
const reaSet = ref(false)
const sirSet = ref(false)
const reaSirDataLoaded = ref(false)
const showSirConfirm = ref(false)
const showDlaConfirm = ref(false)

const message = ref("")
const messageType = ref<"success" | "error">("success")

const loading = computed(() => ifps.loading)

const nowTick = ref(0)
const eobtParsed = computed(() => {
    nowTick.value
    const t = dlaTime.value
    if (!t || t.length !== 4) return null
    const h = parseInt(t.slice(0, 2), 10)
    const m = parseInt(t.slice(2, 4), 10)
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null
    const now = moment().utc()
    const eobtToday = moment.utc([now.year(), now.month(), now.date(), h, m])
    return { now, eobtToday }
})

const eobtTimeDiff = computed(() => {
    const p = eobtParsed.value
    if (!p) return null
    let eobt = p.eobtToday.clone()
    if (eobt.isBefore(p.now)) eobt = eobt.add(1, "day")
    return eobt.diff(p.now, "minutes")
})

const eobtInPast = computed(() => {
    const p = eobtParsed.value
    if (!p) return false
    let eobt = p.eobtToday.clone()
    if (eobt.isBefore(p.now)) eobt = eobt.add(1, "day")
    return !eobt.isAfter(p.now)
})

const eobtCrossesMidnight = computed(() => {
    const p = eobtParsed.value
    if (!p || eobtInPast.value) return false
    return p.eobtToday.isBefore(p.now)
})

const eobtTimeDiffLabel = computed(() => {
    if (eobtInPast.value) return "EOBT is in the past"
    const diff = eobtTimeDiff.value
    if (diff === null) return ""
    const sign = diff >= 0 ? "+" : ""
    const base = `Now${sign}${diff} min`
    return eobtCrossesMidnight.value ? `${base} — Update DOF` : base
})

const canSendDla = computed(() => {
    return !!dlaCallsign.value && /^\d{4}$/.test(dlaTime.value) && !eobtInPast.value
})

function getFlight(callsign: string) {
    return ifps.findFlight(callsign)
}

function isReaSet(flight: any): boolean {
    if (!flight) return false
    const v = flight.rea ?? flight.REA ?? flight.ready_for_improvement
    if (typeof v === "boolean") return v
    if (typeof v === "number") return v === 1
    const sts = flight.cdmSts ?? flight.cdm_status ?? flight.cdmStatus ?? ""
    return String(sts).toUpperCase().includes("REA")
}

function isSirSet(flight: any): boolean {
    if (!flight) return false
    const v = flight.sir ?? flight.SIR ?? flight.slot_improvement_request
    if (typeof v === "boolean") return v
    if (typeof v === "number") return v === 1
    const sts = flight.cdmSts ?? flight.cdm_status ?? flight.cdmStatus ?? ""
    return String(sts).toUpperCase().includes("SIR")
}

async function refreshReaSirState() {
    const cs = normalizeCallsign(reaCallsign.value)
    if (!cs) {
        reaSet.value = false
        sirSet.value = false
        reaSirDataLoaded.value = false
        return
    }
    reaSirDataLoaded.value = false
    await ifps.fetchByCallsign(cs)
    const flight = getFlight(cs)
    reaSet.value = isReaSet(flight)
    sirSet.value = isSirSet(flight)
    reaSirDataLoaded.value = true
}

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

function enforceDlaFormat() {
    dlaTime.value = dlaTime.value.replace(/\D/g, "").slice(0, 4)
}

function normalizeTime(value: string) {
    const digits = value.replace(/\D/g, "")
    if (digits.length === 3) return `0${digits}`
    if (digits.length >= 4) return digits.slice(0, 4)
    return digits
}

function onSendReaClick(e: MouseEvent) {
    if (e.ctrlKey) {
        showSirConfirm.value = true
    } else {
        sendRea(true)
    }
}

function onClearReaClick(e: MouseEvent) {
    if (e.ctrlKey && !sirSet.value) {
        showSirConfirm.value = true
    } else {
        sendRea(false)
    }
}

async function sendRea(enabled: boolean) {
    const callsign = normalizeCallsign(reaCallsign.value)
    if (!callsign) return
    try {
        await ifps.sendDpi(callsign, `REA/${enabled ? "1" : "0"}`)
        reaSet.value = enabled
        setMessage(`REA ${enabled ? "set" : "cleared"} for ${callsign}`, "success")
    } catch (error) {
        setMessage(`Failed to send REA for ${callsign}`, "error")
    }
}

async function sendSir(enabled: boolean) {
    const callsign = normalizeCallsign(reaCallsign.value)
    if (!callsign) return
    showSirConfirm.value = false
    try {
        await ifps.sendDpi(callsign, `SIR/${enabled ? "1" : "0"}`)
        sirSet.value = enabled
        if (enabled) {
            await ifps.sendDpi(callsign, "REA/1")
            reaSet.value = true
        }
        setMessage(enabled ? `SIR and REA set for ${callsign}` : `SIR cleared for ${callsign}`, "success")
    } catch (error) {
        setMessage(`Failed to send SIR for ${callsign}`, "error")
    }
}

function confirmSir() {
    sendSir(true)
}

function clearReaCallsign() {
    reaCallsign.value = ""
    reaSet.value = false
    sirSet.value = false
    reaSirDataLoaded.value = false
}

function clearDla() {
    dlaCallsign.value = ""
    dlaTime.value = ""
}

function clearForm() {
    clearReaCallsign()
    clearDla()
}

watch(reaCallsign, (val) => {
    const cs = normalizeCallsign(val)
    if (!cs) {
        reaSet.value = false
        sirSet.value = false
        reaSirDataLoaded.value = false
        return
    }
    const tid = setTimeout(() => refreshReaSirState(), 150)
    return () => clearTimeout(tid)
})

watch(dlaCallsign, (val) => {
    const cs = normalizeCallsign(val)
    if (!cs) return
    const tid = setTimeout(() => ifps.fetchByCallsign(cs), 150)
    return () => clearTimeout(tid)
})

function getCurrentEobtMinutes(): number | null {
    const cs = normalizeCallsign(dlaCallsign.value)
    const t = dlaTime.value
    if (!cs || !t || t.length !== 4) return null
    const flight = getFlight(cs)
    const raw =
        flight?.eobt ??
        flight?.EOBT ??
        flight?.tobt ??
        flight?.TOBT ??
        flight?.cdmData?.tobt?.toString().slice(0, 4)
    if (raw == null || raw === "") return null
    const digits = String(raw).replace(/\D/g, "").slice(0, 4)
    if (digits.length < 3) return null
    const h = parseInt(digits.slice(0, 2), 10)
    const m = parseInt(digits.slice(2, 4), 10)
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null
    const now = moment().utc()
    const eobt = moment.utc([now.year(), now.month(), now.date(), h, m])
    return eobt.hours() * 60 + eobt.minutes()
}

function getNewEobtMinutes(): number | null {
    const t = dlaTime.value
    if (!t || t.length !== 4) return null
    const h = parseInt(t.slice(0, 2), 10)
    const m = parseInt(t.slice(2, 4), 10)
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null
    return h * 60 + m
}

function getEobtChangeMinutes(): number | null {
    const curr = getCurrentEobtMinutes()
    const neu = getNewEobtMinutes()
    if (curr === null || neu === null) return null
    let diff = neu - curr
    if (Math.abs(diff) > 720) diff += diff > 0 ? -1440 : 1440
    return Math.abs(diff)
}

function isDlaChangeSmall(): boolean {
    const change = getEobtChangeMinutes()
    return change !== null && change < 15
}

async function onSendDlaClick() {
    if (!canSendDla.value) return
    await ifps.fetchByCallsign(normalizeCallsign(dlaCallsign.value))
    if (isDlaChangeSmall()) {
        showDlaConfirm.value = true
    } else {
        await sendDla()
    }
}

async function confirmDla() {
    showDlaConfirm.value = false
    await sendDla()
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

function applyPrefill() {
    const ready = cdmPrefillReady.value?.trim()
    const delay = cdmPrefillDelay.value?.trim()
    if (ready) {
        reaCallsign.value = normalizeCallsign(ready)
        refreshReaSirState()
    }
    if (delay) {
        dlaCallsign.value = normalizeCallsign(delay)
    }
    clearCdmPrefill()
}

const VIFF_URL = "https://vats.im/viff"

let eobtTickInterval: ReturnType<typeof setInterval>
onMounted(() => {
    applyPrefill()
    eobtTickInterval = setInterval(() => {
        nowTick.value++
    }, 60000)
    nextTick(() => {
        const winbox = root.value?.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                title.innerHTML += ` <a href="${VIFF_URL}" target="_blank" rel="noopener noreferrer" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    })
})
onUnmounted(() => {
    clearInterval(eobtTickInterval)
})

watch(
    () => [cdmPrefillReady.value, cdmPrefillDelay.value],
    () => {
        if (cdmPrefillReady.value || cdmPrefillDelay.value) {
            applyPrefill()
        }
    },
)
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

.delay-header {
    display: flex;
    align-items: center;
    gap: 180px;
}

.eobt-diff {
    font-size: 0.85em;
    font-weight: normal;
    color: #666;
}

.eobt-diff.eobt-past {
    color: rgb(var(--v-theme-error));
}

.section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.fields {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
}

.section-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.field {
    min-width: 100px;
}

.callsign-field {
    min-width: 140px;
    max-width: 200px;
}

.time-field {
    max-width: 100px;
}

.footer {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-top: 8px;
    gap: 12px;
}

.message {
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-left: auto;
    line-height: 1;
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
