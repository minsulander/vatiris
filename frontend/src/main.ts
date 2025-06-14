import "./assets/main.css"

import { createApp } from "vue"
import { createPinia } from "pinia"

import { createVuetify } from "vuetify"
import "@mdi/font/css/materialdesignicons.css"
import "vuetify/styles"

import "ol/ol.css"

const vuetify = createVuetify({
    theme: {
        defaultTheme: "dark",
        themes: {
            light: {
                colors: {
                    primary: "#1867C0",
                    secondary: "#5CBBF6",
                },
            },
            dark: {
                colors: {
                    background: "#1e1f22",
                    surface: "#2b2d31",
                    primary: "#fff",
                    secondary: "#aaa",
                    // #1e1f22
                    // #2b2d31
                    // #313338
                },
            },
        },
    },
})

import App from "./App.vue"
import router from "./router"

if (location.search.startsWith("?code=")) {
    sessionStorage.authorizationCode = location.search.substring(6)
    location.href = "/"
} else {
    const app = createApp(App)
    app.use(createPinia())
    app.use(vuetify)
    app.use(router)
    app.mount("#app")
}

// global exports for fiddling in console

import { useWinBox } from "vue-winbox"
import { useWindowsStore } from "@/stores/windows"
import { useWxStore } from "@/stores/wx"
import { useNotamStore } from "@/stores/notam"
import { usePresetStore } from "@/stores/preset"
import { useVatsimStore } from "@/stores/vatsim"
import { useAuthStore } from "@/stores/auth"
import { useSettingsStore } from "@/stores/settings"
import { useDctStore } from "@/stores/dct"
import { useMetarStore } from "@/stores/metar"
import { useTafStore } from "@/stores/taf"
import { useFdpStore } from "@/stores/fdp"
import { useOccupancyStore } from "./stores/occupancy"
import { useEsdataStore } from "./stores/esdata"
import { useAirportStore } from "./stores/airport"
import moment from "moment"
import axios from "axios"
import useEventBus from "./eventbus"
import { registerSW } from "virtual:pwa-register"
import { useWindStore } from "./stores/wind"

registerSW({ immediate: true })

const global = window as any

global.winbox = useWinBox()
global.windows = useWindowsStore()
global.wx = useWxStore()
global.notam = useNotamStore()
global.preset = usePresetStore()
global.vatsim = useVatsimStore()
global.auth = useAuthStore()
global.settings = useSettingsStore()
global.metar = useMetarStore()
global.taf = useTafStore()
global.moment = moment
global.axios = axios
global.dct = useDctStore()
global.fdp = useFdpStore()
global.occupancy = useOccupancyStore()
global.esdata = useEsdataStore()
global.bus = useEventBus()
global.airport = useAirportStore()
global.wind = useWindStore()
