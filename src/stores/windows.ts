import { reactive, ref, computed, watch } from "vue"
import { defineStore } from "pinia"

export interface WindowLayout {
    x?: number
    y?: number
    width?: string
    height?: string
    min?: boolean
    max?: boolean
    enabled?: boolean
}

export const useWindowsStore = defineStore("windows", () => {
    const layout = reactive({} as {[key: string]: WindowLayout})
    const focusId = ref("")
    const winbox = reactive({} as {[key: string]: any})

    if ("layout" in localStorage) Object.assign(layout, JSON.parse(localStorage.layout))
    if ("focusId" in localStorage) focusId.value = localStorage.focusId

    watch(layout, () => localStorage.layout = JSON.stringify(layout))
    watch(focusId, () => localStorage.focusId = focusId.value)

    return { layout, focusId, winbox }
})
