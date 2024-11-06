import { defineStore } from "pinia"
import { ref, watch } from "vue"
import { useAuthStore } from "./auth"
import useEventBus from "@/eventbus"

export const useSettingsStore = defineStore("settings", () => {
    const windowSnapping = ref(true)
    const metreportFlash = ref(true)
    const metsensorFlash = ref(false)
    const enablePLS = ref(false)
    const plsLogic = ref("CID")
    const useVatsimConnect = ref(true)
    const cid1 = ref("")
    const cid2 = ref("")
    const position1 = ref("")
    const position2 = ref("")

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

    watch(
        [
            windowSnapping,
            metreportFlash,
            metsensorFlash,
            enablePLS,
            plsLogic,
            useVatsimConnect,
            cid1,
            cid2,
            position1,
            position2,
        ],
        () => {

            // PLS logic validation
            // Clear values when switching logic
            if (plsLogic.value === 'CID') {
                if (useVatsimConnect.value) {
                    cid1.value = ''
                    cid2.value = ''
                } else {
                    if (cid1.value && !/^\d{5,8}$/.test(cid1.value)) cid1.value = ''
                    if (cid2.value && !/^\d{5,8}$/.test(cid1.value)) cid2.value = ''
                }
                position1.value = ''
                position2.value = ''
            } else if (plsLogic.value === 'Position') {
                cid1.value = ''
                cid2.value = ''
                useVatsimConnect.value = false
            }

            const settings = {
                windowSnapping: windowSnapping.value,
                metreportFlash: metreportFlash.value,
                metsensorFlash: metsensorFlash.value,
                enablePLS: enablePLS.value,
                plsLogic: plsLogic.value,
                useVatsimConnect: useVatsimConnect.value,
                cid1: cid1.value,
                cid2: cid2.value,
                position1: position1.value,
                position2: position2.value,
            }
            localStorage.settings = JSON.stringify(settings)
            if (Date.now() - lastLoadTime > 3000 && auth.user) {
                console.log("Post settings to backend")
                auth.postUserData("settings", settings)
            }
        },
    )

    watch(
        () => auth.user,
        async () => {
            if (auth.user) fetchSettings()
        },
    )

    const bus = useEventBus()
    bus.on("refresh", () => {
        if (auth.user) fetchSettings()
    })

    async function fetchSettings() {
        const settings = await auth.fetchUserData("settings")
        if (settings) {
            console.log("Got settings from backend")
            load(settings)
        }
    }

    function load(settings: any) {
        lastLoadTime = Date.now()
        if ("windowSnapping" in settings) windowSnapping.value = settings.windowSnapping
        if ("metreportFlash" in settings) metreportFlash.value = settings.metreportFlash
        if ("metsensorFlash" in settings) metsensorFlash.value = settings.metsensorFlash
        if ("enablePLS" in settings) enablePLS.value = settings.enablePLS
        if ("plsLogic" in settings) plsLogic.value = settings.plsLogic
        if ("useVatsimConnect" in settings) useVatsimConnect.value = settings.useVatsimConnect
        if ("cid1" in settings) cid1.value = settings.cid1
        if ("cid2" in settings) cid2.value = settings.cid2
        if ("position1" in settings) position1.value = settings.position1
        if ("position2" in settings) position2.value = settings.position2
    }

    return {
        windowSnapping,
        metreportFlash,
        metsensorFlash,
        enablePLS,
        plsLogic,
        useVatsimConnect,
        cid1,
        cid2,
        position1,
        position2,
    }
})
