<template>
    <div ref="div">
        <!--<Iframe :src="src + '#toolbar=0'" />-->
        <PDF
            :src="rewrittenSrc"
            :show-page-tooltip="false"
            :show-back-to-top-btn="false"
            @on-pdf-init="init"
            @on-scroll="scroll"
            @on-complete="complete"
        ></PDF>
    </div>
</template>

<script setup lang="ts">
import Iframe from "./Iframe.vue"
import PDF, { type PDFDocumentProxy } from "pdf-vue3"
import { computed, onMounted, ref } from "vue"
const props = defineProps<{ id: string; src: string; externalLink?: boolean }>()

const div = ref()

const rewrittenSrc = computed(() => {
    let src = props.src
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
    if (props.externalLink) {
        const winbox = div.value.closest(".winbox")
        if (winbox) {
            const title = winbox.querySelector(".wb-title")
            if (title && !title.innerHTML.includes("mdi-open-in-new")) {
                title.innerHTML += ` <a href="${props.src}" target="_blank" style="color: #ddd"><span class="mdi mdi-open-in-new"></span></a> `
            }
        }
    }
})
</script>
