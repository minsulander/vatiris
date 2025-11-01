import { ref } from 'vue'

// Shared state for FSP runway override
// This allows both FSP.vue and DepartureList.vue to access the same runway override
const manualRunwayOverride = ref<string | null>(null)

export function useFspRunway() {
    return {
        manualRunwayOverride
    }
}

