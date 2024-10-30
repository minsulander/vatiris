import { fileURLToPath, URL } from "node:url"

import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

import vuetify, { transformAssetUrls } from "vite-plugin-vuetify"
import ViteFonts from "unplugin-fonts/vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue({
            template: { transformAssetUrls },
        }),
        vuetify({
            autoImport: true,
            styles: {
                configFile: "src/styles/settings.scss",
            },
        }),
        ViteFonts({
            google: {
                families: [
                    {
                        name: "Roboto",
                        styles: "wght@100;300;400;500;700;900",
                    },
                ],
            },
        }),
        VitePWA({
            registerType: "autoUpdate",
            devOptions: { enabled: true },
            // ## in case the app grows large, and it's not by accident this time:
            // workbox: {
            //     maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            // },
            manifest: {
                name: "VatIRIS",
                short_name: "VatIRIS",
                description: "VATSIM Sweden Integrated Real-time Information System",
                theme_color: "#1e2022",
                icons: [
                    {
                        src: "/android-chrome-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/android-chrome-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
                screenshots: [
                    {
                        src: "/screenshots/1024.png",
                        sizes: "1024x768",
                        type: "image/png",
                        form_factor: "wide",
                        label: "VatIRIS",
                    },
                    {
                        src: "/screenshots/iphone_se.png",
                        sizes: "750x1334",
                        type: "image/png",
                        form_factor: "narrow",
                        label: "VatIRIS",
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
})
