import { reactive, ref, computed, watch } from "vue"
import { defineStore } from "pinia"

export const useWindowsStore = defineStore("windows", () => {
    const layout = reactive({})
    const focusId = ref("")

    if ("layout" in localStorage) Object.assign(layout, JSON.parse(localStorage.layout))
    if ("focusId" in localStorage) focusId.value = localStorage.focusId

    watch(layout, () => localStorage.layout = JSON.stringify(layout))
    watch(focusId, () => localStorage.focusId = focusId.value)

    return { layout, focusId }
})
