import { defineStore } from "pinia"
import { ref } from "vue"

export const useDeparturesForCdmStore = defineStore("departuresForCdm", () => {
    const callsigns = ref<string[]>([])

    function setCallsigns(list: string[]) {
        callsigns.value = list
    }

    return { callsigns, setCallsigns }
})
