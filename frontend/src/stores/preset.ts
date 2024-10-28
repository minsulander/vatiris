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

    // TODO find a better way to load defaults
    const defaults = reactive({ ESOS_APP: {}, ESGG_APP: {}, ESMS_APP: {} } as {
        [key: string]: any
    })
    import("@/data/default/ESOS_APP.json").then((data) => (defaults.ESOS_APP = data))
    import("@/data/default/ESGG_APP.json").then((data) => (defaults.ESGG_APP = data))

    const auth = useAuthStore()

    let lastFetchTime = Date.now()

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
        if (name in presets) {
            delete presets[name]
            auth.postUserData("presets", presets)
        }
    }

    function rename(from: string, to:string) {
        if (current.value == from) {
            current.value = to
            localStorage.preset = to
        }
        if (from in presets) {
            presets[to] = presets[from]
            delete presets[from]
            auth.postUserData("presets", presets)
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

    function loadDefault(name: string) {
        const preset = defaults[name]

        // Find best layout for current screen size
        let bestLayout = undefined
        if (preset.layouts && preset.layouts.length == 1) {
            bestLayout = preset.layouts[0]
        } else if (preset.layouts) {
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
        }
        // Apply best layout
        if (bestLayout) {
            const windows = bestLayout.layout
            for (const id in windows) {
                const win = windows[id]
                win.x *= window.innerWidth / bestLayout.width
                win.y = ((win.y - 30) * (window.innerHeight - 30)) / (bestLayout.height - 30) + 30
                win.width *= window.innerWidth / bestLayout.width
                win.height *= (window.innerHeight - 30) / (bestLayout.height - 30)
            }
            localStorage.layout = JSON.stringify(windows)
        } else {
            localStorage.removeItem("layout")
        }
        // Apply other settings
        for (const key in preset) {
            if (key == "layouts") continue
            localStorage[key] = JSON.stringify(preset[key])
        }
        // Save some stuff in localStorage before reload, show them when reloaded (below)
        current.value = ""
        delete localStorage.preset
        localStorage.default = name
        localStorage.defaultLayout = JSON.stringify(bestLayout)
        location.reload()
    }

    // Setup react to loaded default after reload
    if ("default" in localStorage) {
        try {
            const defaultName = localStorage.default
            const defaultLayout = JSON.parse(localStorage.defaultLayout)
            console.log(
                "Loaded default",
                defaultName,
                `${defaultLayout.width}x${defaultLayout.height}`,
            )
        } catch (e: any) {
            console.error("Failed to load default", e)
        } finally {
            delete localStorage.default
            delete localStorage.defaultLayout
        }
    }

    function makeDefault() {
        const data = {} as { [key: string]: any }
        data.layouts = []
        data.layouts.push({
            width: window.innerWidth,
            height: window.innerHeight,
            layout: JSON.parse(localStorage.layout),
        })
        for (const key of presetKeys) {
            if (key == "layout") continue
            if (key in localStorage) data[key] = JSON.parse(localStorage[key])
        }
        return data
    }

    return {
        current,
        presets,
        defaults,
        loadDefault,
        load,
        save,
        remove,
        rename,
        makeDefault,
    }
})
