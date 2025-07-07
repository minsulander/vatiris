<template>
    <div ref="div" style="height: 100%">
        <PDF
            v-if="settings.customPdfBrowser"
            :src="rewrittenSrc"
            :show-page-tooltip="false"
            :show-back-to-top-btn="false"
            @on-pdf-init="init"
            @on-scroll="scroll"
            @on-complete="complete"
        ></PDF>
        <Iframe v-else :src="props.src + '#toolbar=0'" style="height: 100%"></Iframe>
    </div>
</template>

<script setup lang="ts">
import Iframe from "./Iframe.vue"
import { useSettingsStore } from "@/stores/settings"
import PDF, { type PDFDocumentProxy } from "pdf-vue3"
import { computed, onMounted, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

const props = defineProps<{ id: string; src: string; externalLink?: boolean | string }>()

const settings = useSettingsStore()

const div = ref()

const rewrittenSrc = computed(() => {
    let src = props.src
    if (settings.customPdfBrowser && src.includes("https://aro.lfv.se/content/eaip"))
        src = src.replace("https://aro.lfv.se/content/eaip", `${backendBaseUrl}/eaip/content`)
    if (!src.endsWith(".pdf")) src += ".pdf"
    return src
})

function init(pdf: PDFDocumentProxy) {
    // console.log("PDF init", pdf)
    // ;(window as any).pdf = pdf
}

let scrollTimeout: any = undefined
function scroll(offset: number) {
    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
        localStorage[`${props.id}_pdf_scroll`] = offset
    }, 100)
}

function complete() {
    const scroller = div.value?.querySelector(".pdf-vue3-scroller")
    if (`${props.id}_pdf_scroll` in localStorage) {
        const scrollIt = () =>
            (scroller.scrollTop = parseInt(localStorage[`${props.id}_pdf_scroll`]))
        setTimeout(scrollIt, 10)
        setTimeout(scrollIt, 100)
        setTimeout(scrollIt, 250)
    }
}

onMounted(() => {
    if (props.externalLink && div.value) {
        const winbox = div.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                const src = typeof props.externalLink === "string" ? props.externalLink : props.src
                title.innerHTML += ` <a href="${src}" target="_blank" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    }
})
</script>
