import { ref } from "vue"

export const cdmPrefillReady = ref("")
export const cdmPrefillDelay = ref("")

export function setCdmPrefill(ready?: string, delay?: string) {
    cdmPrefillReady.value = ready ?? ""
    cdmPrefillDelay.value = delay ?? ""
}

export function clearCdmPrefill() {
    cdmPrefillReady.value = ""
    cdmPrefillDelay.value = ""
}
