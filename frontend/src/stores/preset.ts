import { defineStore } from "pinia"
import { reactive, ref, watch } from "vue"
import { useAuthStore } from "./auth"
import useEventBus from "@/eventbus"

export const presetKeys = ["layout", "smhiMapCenter", "smhiMapZoom", "notamOptions"]

export function defaultPresets() {
    return {
        // "ESOS_APP": {
        //     "layout": "{\"metrepESSA\":{\"enabled\":true,\"x\":781,\"y\":86},\"metrepESSB\":{\"enabled\":true,\"x\":350,\"y\":85},\"smhi\":{\"enabled\":true,\"x\":223,\"y\":382}}",
        //     "smhiMapCenter": "[17.951429357434204,59.57143999874103]",
        //     "smhiMapZoom": "7.559999999999997"
        // }
    }
}

export const usePresetStore = defineStore("preset", () => {
    const current = ref(localStorage.preset || "")
    const presets = reactive({} as { [key: string]: { [key: string]: string } })

    const auth = useAuthStore()

    let lastFetchTime = Date.now()

    Object.assign(presets, defaultPresets())

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
        load,
        save,
        remove,
    }
})
