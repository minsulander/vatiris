import { ref, watch } from "vue"
const bus = ref(new Map())

export default function useEventBus() {
    function emit(event: string, ...args: any[]) {
        bus.value.set(event, args)
    }

    function on(event: string, callback: (...args: any[]) => void) {
        watch(() => bus.value.get(event), (args) => callback(...args))
    }

    return {
        emit,
        on,
        bus,
    }
}
