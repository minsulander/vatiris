<template>
    <span v-if="settings.showSectorCoverage && strip.length" class="sector-coverage">
        <span v-if="positions.testMode" class="test" title="Test mode">TEST</span>
        <span class="prefix" :title="modeTitle" @click.stop="toggleMode">{{ modeLabel }}:</span>
        <span v-if="!narrow" class="letters" @mouseleave="positions.setHighlight([])">
            <template v-for="sector in strip" :key="sector.id">
                <v-tooltip location="bottom" :text="sector.tooltip">
                    <template v-slot:activator="{ props }">
                        <span
                            v-bind="props"
                            :class="letterClass(sector)"
                            @mouseenter="hover(sector.id)"
                            >{{ sector.id }}</span
                        >
                    </template>
                </v-tooltip>
            </template>
        </span>
        <v-menu v-else location="bottom" :close-on-content-click="false" open-on-hover>
            <template v-slot:activator="{ props }">
                <span v-bind="props" class="prefix">sectors</span>
            </template>
            <v-card class="letters pa-2" @mouseleave="positions.setHighlight([])">
                <template v-for="sector in strip" :key="sector.id">
                    <v-tooltip location="bottom" :text="sector.tooltip">
                        <template v-slot:activator="{ props }">
                            <span
                                v-bind="props"
                                :class="letterClass(sector)"
                                @mouseenter="hover(sector.id)"
                                >{{ sector.id }}</span
                            >
                        </template>
                    </v-tooltip>
                </template>
            </v-card>
        </v-menu>
    </span>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { usePositionsStore } from "@/stores/positions"
import { useSettingsStore } from "@/stores/settings"
import { useAuthStore } from "@/stores/auth"
import { useVatsimStore } from "@/stores/vatsim"

const positions = usePositionsStore()
const settings = useSettingsStore()
const auth = useAuthStore()
const vatsim = useVatsimStore()

const mode = ref<"ESMM" | "ESOS">("ESMM")
const manualMode = ref(false)
const narrow = ref(window.innerWidth < 1280)

const modeTitle = "ACC sector coverage. Click to switch ESMM/ESOS."

function userCallsign() {
    const cid = auth.user?.cid
    if (cid != null && cid !== "") {
        const controller = vatsim.data?.controllers?.find((item) => String(item.cid) === String(cid))
        if (controller) return controller.callsign
    }
    return settings.position1 || ""
}

function detectMode(): "ESMM" | "ESOS" | null {
    for (const si of positions.mySis) {
        const detected = positions.modeForSi(si)
        if (detected) return detected
    }
    const callsign = userCallsign()
    if (callsign.includes("ESOS")) return "ESOS"
    if (callsign.includes("ESMM") || callsign.includes("ESAA")) return "ESMM"
    return null
}

watch(
    () => positions.mySis.join(",") + userCallsign(),
    () => {
        if (manualMode.value) return
        const detected = detectMode()
        if (detected) mode.value = detected
    },
    { immediate: true },
)

const modeLabel = computed(() => {
    const si = positions.mySis.find((item) => positions.modeForSi(item) === mode.value)
    return si ? `${mode.value} ${si}` : mode.value
})

const strip = computed(() =>
    positions.idsForMode(mode.value).map((id) => {
        const name = positions.sectorName(mode.value, id)
        const own = positions.ownership(name)
        const controller = own?.controller ?? null
        const coveredBy: "me" | "other" | "none" = !controller
            ? "none"
            : positions.mySis.includes(controller)
              ? "me"
              : "other"
        const chain = own?.owners.map((owner) => owner.si).join(" › ")
        const who = controller
            ? `${controller}${own?.frequency ? " " + own.frequency : ""}`
            : "not covered"
        return {
            id,
            coveredBy,
            hypothetical: !!positions.hypotheticalSi(name),
            hovered: positions.highlightedKeys.includes(`${mode.value} ${id}`),
            tooltip: `${mode.value} ${id}: ${who}${chain ? " · " + chain : ""}`,
        }
    }),
)

function letterClass(sector: { coveredBy: string; hypothetical: boolean; hovered: boolean }) {
    return [sector.hovered ? "hot" : sector.coveredBy, sector.hypothetical ? "hypo" : ""]
}

function hover(id: string) {
    const name = positions.sectorName(mode.value, id)
    const own = positions.ownership(name)
    if (!own?.controller) {
        positions.setHighlight([`${mode.value} ${id}`])
        return
    }
    positions.setHighlight(
        positions.idsForController(own.controller, mode.value).map((sectorId) => `${mode.value} ${sectorId}`),
    )
}

function toggleMode() {
    manualMode.value = true
    mode.value = mode.value === "ESMM" ? "ESOS" : "ESMM"
    positions.setHighlight([])
}

function onResize() {
    narrow.value = window.innerWidth < 1280
}

onMounted(() => window.addEventListener("resize", onResize))
onUnmounted(() => window.removeEventListener("resize", onResize))
</script>

<style scoped>
.sector-coverage {
    margin: 0 8px;
    white-space: nowrap;
    font-size: 13px;
    user-select: none;
}
.prefix {
    cursor: pointer;
    color: #bdbdbd;
    margin-right: 2px;
}
.letters {
    cursor: help;
}
.test {
    color: #ffb74d;
    font-weight: 700;
    margin-right: 4px;
}
.me {
    color: #fff;
    font-weight: 700;
}
.other {
    color: #d0d0d0;
}
.none {
    color: #777;
}
.hot {
    color: #ffd54f;
}
.hypo {
    text-decoration: underline dotted;
    text-underline-offset: 3px;
}
</style>
