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
                    primary: "#f0e"
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

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.use(router)

app.mount("#app")
