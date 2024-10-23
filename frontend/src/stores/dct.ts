import { defineStore } from "pinia"
import { ref, computed } from "vue"
import directsData from '@/data/dct/directs.json'

export const useDctStore = defineStore("dct", () => {
    const directs = ref(directsData)

    const menuItems = computed(() => {
        return directs.value.reduce((acc, direct) => {
            const id = direct.id.toLowerCase().replace(/\s+/g, '-')
            acc[direct.id] = `coord-${id}`
            return acc
        }, {} as { [key: string]: string })
    })

    return {
        directs,
        menuItems
    }
})