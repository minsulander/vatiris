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
    const layout = reactive({} as { [key: string]: WindowLayout })
    const focusId = ref("")
    const winbox = reactive({} as { [key: string]: any })
    const unmounting = ref(false) // used when Main.vue is unmounting, to ignore close events

    if ("layout" in localStorage) Object.assign(layout, JSON.parse(localStorage.layout))
    if ("focusId" in localStorage) focusId.value = localStorage.focusId

    watch(layout, () => (localStorage.layout = JSON.stringify(layout)))
    watch(focusId, () => (localStorage.focusId = focusId.value))
    watch(winbox, () => {
        for (const id in winbox) {
            const wb = winbox[id]
            if (wb.x < 0) wb.move(0, wb.y)
            if (wb.y < 30) wb.move(wb.x, 30)
            if (wb.x + wb.width > window.innerWidth) wb.resize(window.innerWidth - wb.x, wb.height)
            if (wb.y + wb.height > window.innerHeight) wb.resize(wb.width, window.innerHeight - wb.y)
        }
    })

    return { layout, focusId, winbox, unmounting }
})
