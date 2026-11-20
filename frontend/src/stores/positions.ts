import { defineStore } from "pinia"
import { computed, reactive, ref, watch } from "vue"
import sectorsTxt from "@/data/sectors.txt?raw"
import callsignsTxt from "@/data/callsigns.txt?raw"
import { useVatsimStore, type Controller } from "./vatsim"
import { useAuthStore } from "./auth"

export interface Sector {
    name: string
    owners: string[]
}

export interface SectorOwnership {
    controller: string | null
    frequency: string | null
    owners: { si: string; online: boolean }[]
}

interface PositionInfo {
    callsign: string
    si: string
    frequency: string
}

const ESOS_ORDER = ["1", "2", "3", "4", "6", "7", "8", "9", "F", "N", "K"]

function parseSectorName(name: string): { mode: "ESMM" | "ESOS"; id: string } | null {
    const match = name.match(/^ESAA\u00b7(ESMM|ESOS)\s+(\S+)/)
    if (!match) return null
    return { mode: match[1] as "ESMM" | "ESOS", id: match[2] }
}

export const usePositionsStore = defineStore("positions", () => {
    const vatsim = useVatsimStore()
    const auth = useAuthStore()

    const sectors = new Map<string, Sector>()
    const callsignToPosition = new Map<string, PositionInfo>()
    const siToCallsigns = new Map<string, string[]>()

    const activePositions = reactive(new Map<string, Controller>())
    const testMode = ref(false)
    const fakeActive = reactive(new Map<string, Partial<Controller>>())
    const manualSis = ref<string[]>([])
    const manualCid = ref<string | null>(null)
    const highlightedKeys = ref<string[]>([])

    function parseSectors() {
        sectors.clear()
        let current: Sector | null = null
        for (const line of sectorsTxt.split(/\r?\n/)) {
            const trimmed = line.trim()
            if (trimmed.startsWith("SECTOR:")) {
                if (current) sectors.set(current.name, current)
                current = { name: trimmed.slice(7).trim(), owners: [] }
            } else if (trimmed.startsWith("OWNER:") && current) {
                current.owners = trimmed.slice(6).trim().split(":").filter(Boolean)
            }
        }
        if (current) sectors.set(current.name, current)
        if (sectors.size === 0) console.error("Failed to parse ACC sector ownership")
    }

    function parseCallsigns() {
        callsignToPosition.clear()
        siToCallsigns.clear()
        for (const line of callsignsTxt.split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("#")) continue
            const parts = trimmed.split(":")
            if (parts.length < 4) continue
            const callsign = parts[0]
            const frequency = parts[2] || ""
            const si = parts[3] || ""
            if (!callsign || !si) continue
            callsignToPosition.set(callsign, { callsign, si, frequency })
            const list = siToCallsigns.get(si)
            if (list) list.push(callsign)
            else siToCallsigns.set(si, [callsign])
        }
    }

    function callsignFor(si: string) {
        const list = siToCallsigns.get(si) || []
        return list.find((callsign) => callsign.endsWith("_CTR")) || list[0] || ""
    }

    function frequencyFor(si: string) {
        const callsign = callsignFor(si)
        return callsign ? callsignToPosition.get(callsign)?.frequency || "" : ""
    }

    function updateActivePositions() {
        activePositions.clear()
        if (testMode.value) {
            for (const [si, partial] of fakeActive) {
                const callsign = partial.callsign || callsignFor(si) || `TEST_${si}_CTR`
                activePositions.set(si, {
                    callsign,
                    cid: partial.cid ?? 999999,
                    facility: partial.facility ?? 6,
                    frequency: partial.frequency || frequencyFor(si) || "199.998",
                    last_updated: partial.last_updated || new Date().toISOString(),
                    logon_time: partial.logon_time || new Date().toISOString(),
                    name: partial.name || `Test ${si}`,
                    rating: partial.rating ?? 5,
                    server: partial.server || "TEST",
                    visual_range: partial.visual_range ?? 300,
                })
            }
            return
        }
        for (const controller of vatsim.data?.controllers || []) {
            const info = callsignToPosition.get(controller.callsign)
            if (!info?.si) continue
            activePositions.set(info.si, controller)
        }
    }

    const sectorController = computed(() => {
        const mapping = new Map<string, string | null>()
        for (const [name, sector] of sectors) {
            let controller: string | null = null
            for (const si of sector.owners) {
                if (activePositions.has(si)) {
                    controller = si
                    break
                }
            }
            mapping.set(name, controller)
        }
        return mapping
    })

    const mySis = computed(() => {
        if (manualSis.value.length) return [...manualSis.value]
        if (manualCid.value) {
            const found: string[] = []
            for (const [si, controller] of activePositions) {
                if (String(controller.cid) === manualCid.value) found.push(si)
            }
            if (found.length) return found
        }
        if (testMode.value) return [...activePositions.keys()]
        const cid = auth.user?.cid
        if (cid == null || cid === "") return []
        const found: string[] = []
        for (const [si, controller] of activePositions) {
            if (String(controller.cid) === String(cid)) found.push(si)
        }
        return found
    })

    function sectorName(mode: "ESMM" | "ESOS", id: string) {
        return `ESAA\u00b7${mode} ${id}`
    }

    function parseLocation(text: string | null | undefined) {
        if (!text) return null
        const match = text.trim().match(/^(ESMM|ESOS)\s+([A-Za-z0-9]+)/)
        if (!match) return null
        const mode = match[1] as "ESMM" | "ESOS"
        const id = match[2]
        return { mode, id, name: sectorName(mode, id) }
    }

    function ownership(name: string): SectorOwnership | null {
        const sector = sectors.get(name)
        if (!sector) return null
        const controller = sectorController.value.get(name) ?? null
        return {
            controller,
            frequency: controller ? activePositions.get(controller)?.frequency || frequencyFor(controller) : null,
            owners: sector.owners.map((si) => ({ si, online: activePositions.has(si) })),
        }
    }

    // Sectors this position does not own yet, but would: either by connecting
    // (nobody above them is online) or as the immediate backup.
    function hypotheticalSi(name: string): string | null {
        const sector = sectors.get(name)
        if (!sector || mySis.value.length === 0) return null
        const currentIdx = sector.owners.findIndex((si) => activePositions.has(si))
        for (const si of mySis.value) {
            const idx = sector.owners.indexOf(si)
            if (idx < 0 || idx === currentIdx) continue
            const higherOnline = sector.owners
                .slice(0, idx)
                .some((owner) => owner !== si && activePositions.has(owner))
            if (!higherOnline) return si
            if (currentIdx >= 0 && idx === currentIdx + 1) return si
        }
        return null
    }

    function idsForMode(mode: "ESMM" | "ESOS") {
        const ids = new Set<string>()
        for (const name of sectors.keys()) {
            const parsed = parseSectorName(name)
            if (parsed?.mode === mode) ids.add(parsed.id)
        }
        const list = [...ids]
        if (mode === "ESOS") {
            return list.sort((a, b) => {
                const ai = ESOS_ORDER.indexOf(a)
                const bi = ESOS_ORDER.indexOf(b)
                if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                return a.localeCompare(b)
            })
        }
        return list.sort((a, b) => {
            const an = /^\d+$/.test(a) ? parseInt(a, 10) : NaN
            const bn = /^\d+$/.test(b) ? parseInt(b, 10) : NaN
            if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
            if (!Number.isNaN(an)) return -1
            if (!Number.isNaN(bn)) return 1
            return a.localeCompare(b)
        })
    }

    function idsForController(si: string, mode: "ESMM" | "ESOS") {
        const ids: string[] = []
        for (const [name, controller] of sectorController.value) {
            if (controller !== si) continue
            const parsed = parseSectorName(name)
            if (parsed?.mode === mode) ids.push(parsed.id)
        }
        return ids
    }

    function modeForSi(si: string): "ESMM" | "ESOS" | null {
        for (const [name, controller] of sectorController.value) {
            if (controller !== si) continue
            if (name.includes("ESMM")) return "ESMM"
            if (name.includes("ESOS")) return "ESOS"
        }
        for (const [name, sector] of sectors) {
            if (!sector.owners.includes(si)) continue
            if (name.includes("ESMM")) return "ESMM"
            if (name.includes("ESOS")) return "ESOS"
        }
        const callsign = callsignFor(si)
        if (callsign.startsWith("ESOS")) return "ESOS"
        if (callsign.startsWith("ESMM") || callsign.startsWith("ESAA")) return "ESMM"
        return null
    }

    function setHighlight(keys: string[]) {
        const next = keys.join("|")
        if (highlightedKeys.value.join("|") === next) return
        highlightedKeys.value = [...keys]
    }

    function setTestMode(enabled: boolean) {
        testMode.value = enabled
        if (!enabled) fakeActive.clear()
        updateActivePositions()
    }

    function setFakePosition(si: string, partial: Partial<Controller> = {}) {
        testMode.value = true
        fakeActive.set(si, partial)
        updateActivePositions()
    }

    function removeFakePosition(si: string) {
        fakeActive.delete(si)
        updateActivePositions()
    }

    function clearFakePositions() {
        fakeActive.clear()
        updateActivePositions()
    }

    function setSectorCoverageSis(sis: string[]) {
        manualSis.value = sis.map((si) => si.trim()).filter(Boolean)
    }

    function setSectorCoverageCid(cid: string | null) {
        manualCid.value = cid
    }

    function clearSectorCoverageOverride() {
        manualSis.value = []
        manualCid.value = null
    }

    parseSectors()
    parseCallsigns()
    watch(() => vatsim.data?.controllers, updateActivePositions)
    updateActivePositions()

    return {
        testMode,
        mySis,
        highlightedKeys,
        sectorName,
        parseLocation,
        ownership,
        hypotheticalSi,
        idsForMode,
        idsForController,
        modeForSi,
        callsignFor,
        setHighlight,
        setTestMode,
        setFakePosition,
        removeFakePosition,
        clearFakePositions,
        setSectorCoverageSis,
        setSectorCoverageCid,
        clearSectorCoverageOverride,
    }
})
