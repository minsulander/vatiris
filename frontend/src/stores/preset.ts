import { defineStore } from "pinia"
import { reactive, ref, watch } from "vue"
import { useAuthStore } from "./auth"
import useEventBus from "@/eventbus"

export const presetKeys = [
    "layout",
    "smhiMapCenter",
    "smhiMapZoom",
    "notamOptions",
    "metartafOptions",
]

export const usePresetStore = defineStore("preset", () => {
    const current = ref(localStorage.preset || "")
    const presets = reactive({} as { [key: string]: { [key: string]: string } })

    const auth = useAuthStore()

    let lastFetchTime = Date.now()

    function loadDefault(name: string, preset: any) {
        console.log("Load default", name, preset)
        console.log(`Screen size ${window.innerWidth}x${window.innerHeight}`)
        let bestLayout = undefined
        let minDiff = 9999999
        for (const layout of preset.layouts) {
            const screenSizeDiff =
                Math.abs(window.innerWidth - layout.width) +
                Math.abs(window.innerHeight - layout.height)
            if (screenSizeDiff < minDiff) {
                minDiff = screenSizeDiff
                bestLayout = layout
            }
        }
        if (bestLayout) {
            console.log(`Best layout ${bestLayout.width}x${bestLayout.height}`)
            const windows = bestLayout.layout
            for (const id in windows) {
                const win = windows[id]
                win.x *= window.innerWidth / bestLayout.width
                win.y = (win.y - 30) * (window.innerHeight - 30) / (bestLayout.height - 30) + 30
                win.width *= window.innerWidth / bestLayout.width
                win.height *= (window.innerHeight - 30) / (bestLayout.height - 30)
            }
            localStorage.layout = JSON.stringify(windows)
        }
        // TODO remove timeout - for debugging
        setTimeout(() => {
            current.value = ""
            delete localStorage.preset
            location.reload()
        }, 500)
    }

    function load(name: string) {
        if (name in presets) {
            current.value = name
            for (const key in presets[name]) {
                localStorage[key] = presets[name][key]
            }
            localStorage.preset = name
            location.reload()
        }
    }

    function save(name: string) {
        const data = {} as { [key: string]: string }

        function store(name: string) {
            if (name in localStorage) data[name] = localStorage[name]
        }
        for (const key of presetKeys) store(key)

        presets[name] = data
        current.value = name
        localStorage.preset = name
        if (Date.now() - lastFetchTime > 3000 && auth.user) {
            console.log("Post presets to backend")
            auth.postUserData("presets", presets)
        }
    }

    function remove(name: string) {
        if (current.value == name) {
            current.value = ""
            localStorage.removeItem("preset")
        }
    }

    watch(
        () => auth.user,
        async () => {
            if (auth.user) fetchPresets()
        },
    )

    const bus = useEventBus()
    bus.on("refresh", () => {
        if (auth.user) fetchPresets()
    })

    async function fetchPresets() {
        try {
            const backendPresets = await auth.fetchUserData("presets")
            lastFetchTime = Date.now()
            if (backendPresets) {
                console.log("Got presets from backend")
                try {
                    Object.assign(presets, backendPresets)
                } catch (e: any) {
                    console.error("Failed to parse backend presets", e)
                }
            } else if ("presets" in localStorage) {
                try {
                    Object.assign(presets, JSON.parse(localStorage.presets))
                    console.log("Found presets in localStorage - posting to backend")
                    await auth.postUserData("presets", presets)
                    delete localStorage.presets
                } catch (e: any) {
                    console.error("Failed to parse presets", e)
                    delete localStorage.presets
                }
            } else {
                console.log("No presets")
            }
        } catch (e: any) {
            console.error("Failed to fetch presets", e)
        }
    }

    return {
        current,
        presets,
        loadDefault,
        load,
        save,
        remove,
    }
})
