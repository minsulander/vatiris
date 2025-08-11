import axios from "axios"
import { defineStore } from "pinia"
import { reactive, ref } from "vue"

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export const useEaipStore = defineStore("eaip", () => {
    const aipIndex = reactive({} as any)

    function fetchIndex() {
        console.log("Fetch AIP index")
        axios
            .get(`${backendBaseUrl}/eaip/index`)
            .then((response) => {
                Object.assign(aipIndex, response.data)
            })
            .catch((error) => {
                console.error("Failed to load AIP index:", error)
            })
    }

    fetchIndex()

    return {
        aipIndex,
        fetchIndex,
    }

})

