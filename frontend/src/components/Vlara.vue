<template>
    <div class="vlara-container pa-3">
        <div class="d-flex align-center justify-space-between mb-3">
            <h3 class="text-h6">Area activation</h3>
            <v-btn
                variant="outlined"
                size="small"
                href="https://lara.lusep.fi"
                target="_blank"
                rel="noopener noreferrer"
            >
                Open LARA
                <v-icon end size="small">mdi-open-in-new</v-icon>
            </v-btn>
        </div>

        <div v-if="loading" class="text-body2 text-grey">Loading...</div>
        <div v-else-if="error" class="text-body2 text-error">{{ error }}</div>
        <template v-else>
            <div class="mb-4">
                <h4 class="text-subtitle-2 mb-2">LARA areas</h4>
                <p class="text-caption text-grey mb-2">
                    Pilot reservations. Activate or deactivate in LARA.
                </p>
                <v-list density="compact" class="bg-transparent">
                    <v-list-item
                        v-for="item in activations.lara"
                        :key="item.name"
                        class="px-0"
                    >
                        <template #prepend>
                            <v-icon size="small" :color="item.active ? 'success' : 'grey'">
                                {{ item.active ? "mdi-circle" : "mdi-circle-outline" }}
                            </v-icon>
                        </template>
                        <v-list-item-title>{{ item.name }}</v-list-item-title>
                        <v-list-item-subtitle v-if="item.from || item.fl">
                            {{ item.from }}–{{ item.to }} · {{ item.fl }}
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="activations.lara.length === 0" class="px-0">
                        <v-list-item-title class="text-grey"
                            >No LARA reservations</v-list-item-title
                        >
                    </v-list-item>
                </v-list>
            </div>

            <div>
                <h4 class="text-subtitle-2 mb-2">LFV AUP areas</h4>
                <p class="text-caption text-grey mb-2">
                    Override activation from LFV Daily Use Plan. Resets at midnight UTC.
                </p>
                <v-list density="compact" class="bg-transparent">
                    <v-list-item
                        v-for="item in activations.lfv"
                        :key="item.name"
                        class="px-0"
                    >
                        <template #prepend>
                            <v-switch
                                :model-value="item.active"
                                hide-details
                                density="compact"
                                color="primary"
                                :disabled="!auth.token?.access_token"
                                @update:model-value="setOverride(item.name, $event)"
                            />
                        </template>
                        <v-list-item-title>
                            {{ item.name }}
                            <v-chip
                                v-if="item.overridden"
                                size="x-small"
                                class="ml-1"
                                variant="tonal"
                            >
                                override
                            </v-chip>
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="item.from || item.fl">
                            {{ formatTime(item.from) }}–{{ formatTime(item.to) }} · {{ item.fl }}
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="activations.lfv.length === 0" class="px-0">
                        <v-list-item-title class="text-grey"
                            >No LFV areas</v-list-item-title
                        >
                    </v-list-item>
                </v-list>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import axios from "axios"
import { backendBaseUrl, useAuthStore } from "@/stores/auth"

const auth = useAuthStore()

interface ActivationItem {
    name: string
    active: boolean
    from: string
    to: string
    fl: string
    overridden?: boolean
}

const activations = reactive<{ lara: ActivationItem[]; lfv: ActivationItem[] }>({
    lara: [],
    lfv: [],
})
const loading = ref(true)
const error = ref<string | null>(null)

function formatTime(iso: string): string {
    if (!iso) return ""
    try {
        const d = new Date(iso)
        return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
    } catch {
        return iso
    }
}

async function fetchActivations() {
    try {
        loading.value = true
        error.value = null
        const { data } = await axios.get<{ lara: ActivationItem[]; lfv: ActivationItem[] }>(
            `${backendBaseUrl}/aup/activations`
        )
        activations.lara = data.lara || []
        activations.lfv = data.lfv || []
    } catch (e: any) {
        const msg =
            e?.code === "ERR_NETWORK" || e?.message?.includes("Network Error")
                ? "Backend unavailable. Start with: cd backend && npm start"
                : (e as Error).message || "Failed to load activations"
        error.value = msg
        activations.lara = []
        activations.lfv = []
    } finally {
        loading.value = false
    }
}

async function setOverride(area: string, active: boolean) {
    if (!auth.token?.access_token) return
    try {
        await axios.post(
            `${backendBaseUrl}/aup/overrides/${encodeURIComponent(area)}`,
            { active },
            { headers: { Authorization: `Bearer ${auth.token.access_token}` } }
        )
        await fetchActivations()
    } catch (e: any) {
        const msg =
            e?.code === "ERR_NETWORK" || e?.message?.includes("Network Error")
                ? "Backend unavailable. Start the backend with: cd backend && npm start"
                : e?.response?.data || e?.message || "Failed to set override"
        console.error("Failed to set override:", msg)
        error.value = msg
    }
}

onMounted(fetchActivations)
</script>

<style scoped>
.vlara-container {
    max-height: 100%;
    overflow-y: auto;
}
</style>
