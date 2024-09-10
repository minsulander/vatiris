import { defineStore } from "pinia"
import { reactive, ref } from "vue"

export const presetKeys = [ "layout", "smhiMapCenter", "smhiMapZoom", "notamOptions" ]

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
    const presets = reactive({} as { [key: string]: { [key: string]: string  }})

    if ("presets" in localStorage) {
        try {
            Object.assign(presets, JSON.parse(localStorage.presets))
        } catch (e: any) {
            console.error("Failed to parse presets", e)
            delete localStorage.presets
        }
    } else {
        Object.assign(presets, defaultPresets())
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
        
        console.log(data)

        presets[name] = data
        localStorage.presets = JSON.stringify(presets)
        current.value = name
        localStorage.preset = name
    }

    function remove(name: string) {
        delete presets[name]
        localStorage.presets = JSON.stringify(presets)
        if (current.value == name) {
            current.value = ""
            localStorage.removeItem("preset")
        }
    }

    return {
        current,
        presets, 
        load,
        save,
        remove
    }

})