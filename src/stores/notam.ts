import axios from "axios"
import { defineStore } from "pinia"
import { computed, ref } from "vue"

export const useNotamStore = defineStore("notam", () => {
    const originalText = ref("")
    const lastFetch = ref(undefined as Date | undefined)

    const allText = computed(() => {
        if (typeof(lastFetch.value) === "undefined") fetch()
        return originalText.value.replace(/\s+CONTINUES ON NEXT PAGE/g, "").replace(/ISSUED:.*PAGE:.*/g, "").replace(/PAGE: 1.*\n/g, "")
    })

    function fetch() {
        lastFetch.value = new Date()
        if (originalText.value === "") originalText.value = "Loading..."
        axios.get(`https://api.vatiris.se/notam`).then((response) => {
            const el = document.createElement("div")
            el.innerHTML = response.data
            originalText.value = el.getElementsByTagName("pre")[0].innerHTML
            lastFetch.value = new Date()
        })
    }

    return {
        originalText,
        allText,
        lastFetch,
        fetch
    }
})
