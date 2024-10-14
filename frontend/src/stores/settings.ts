import { defineStore } from "pinia"
import { ref, watch } from "vue"
import { useAuthStore } from "./auth"

export const useSettingsStore = defineStore("settings", () => {
    const windowSnapping = ref(true)
    const metreportFlash = ref(true)
    const metsensorFlash = ref(false)

    const auth = useAuthStore()

    let lastLoadTime = Date.now()

    if ("settings" in localStorage) {
        try {
            const settings = JSON.parse(localStorage.settings)
            if (settings) load(settings)
        } catch (e: any) {
            console.error("Failed to parse localStorage settings", e)
            delete localStorage.settings
        }
    }

    watch([windowSnapping, metreportFlash, metsensorFlash], () => {
        const settings = {
            windowSnapping: windowSnapping.value,
            metreportFlash: metreportFlash.value,
            metsensorFlash: metsensorFlash.value,
        }
        localStorage.settings = JSON.stringify(settings)
        if (Date.now() - lastLoadTime > 5000 && auth.user) {
            console.log("Post settings to backend")
            auth.postUserData("settings", settings)
        }
    })

    watch(
        () => auth.user,
        async () => {
            if (auth.user) {
                const settings = await auth.fetchUserData("settings")
                if (settings) {
                    console.log("Got settings from backend")
                    load(settings)
                }
            }
        },
    )

    function load(settings: any) {
        lastLoadTime = Date.now()
        if ("windowSnapping" in settings) windowSnapping.value = settings.windowSnapping
        if ("metreportFlash" in settings) metreportFlash.value = settings.metreportFlash
        if ("metsensorFlash" in settings) metsensorFlash.value = settings.metsensorFlash
    }

    return {
        windowSnapping,
        metreportFlash,
        metsensorFlash,
    }
})
