import { defineStore } from "pinia"
import { ref, watch } from "vue"

export const useSettingsStore = defineStore("settings", () => {
    const windowSnapping = ref(true)
    const metreportFlash = ref(true)
    const metsensorFlash = ref(false)

    if ("settings" in localStorage) {
        try {
            const settings = JSON.parse(localStorage.settings)
            if ("windowSnapping" in settings) windowSnapping.value = settings.windowSnapping
            if ("metreportFlash" in settings) metreportFlash.value = settings.metreportFlash
            if ("metsensorFlash" in settings) metsensorFlash.value = settings.metsensorFlash
        } catch (e: any) {
            console.error("Failed to parse settings", e)
            delete localStorage.settings
        }
    }

    watch([windowSnapping, metsensorFlash], () => {
        localStorage.settings = JSON.stringify({
            windowSnapping: windowSnapping.value,
            metreportFlash: metreportFlash.value,
            metsensorFlash: metsensorFlash.value
        })
    })

    return {
        windowSnapping,
        metreportFlash,
        metsensorFlash,
    }
})
