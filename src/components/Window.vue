<template>
    <VueWinBox
        ref="wb"
        :options="options"
        @move="move"
        @resize="resize"
        @close="close"
        @focus="focus"
    >
        <slot></slot>
    </VueWinBox>
</template>

<script setup lang="ts">
import { VueWinBox } from "vue-winbox"
import { computed, ref } from "vue"
import { onUnmounted } from "vue"
import { onMounted } from "vue"
import { useWindowsStore } from "@/stores/windows"
import { nextTick } from "vue"

const props = defineProps<{
    id: string
    title?: string
    width?: string | number
    height?: string | number
    class?: string
}>()

const windows = useWindowsStore()

const wb = ref()
const options = computed(() => {
    const id = props.id
    const width = props.width || 640
    const height = props.height || 480
    return {
        title: props.title || "",
        class: `no-full ${props.class || ""}`,
        top: 30,
        border: 3,
        x: id in windows.layout ? windows.layout[id].x : 0,
        y: id in windows.layout ? windows.layout[id].y : 0,
        width: id in windows.layout ? windows.layout[id].width || width : width,
        height: id in windows.layout ? windows.layout[id].height || height : height
    }
})

let moveTimeout: any = undefined
function move(move: any) {
    if (move.id) {
        if (!(move.id in windows.layout)) windows.layout[move.id] = {}
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
            if (!windows.winbox[move.id].min && !windows.winbox[move.id].max) {
                windows.layout[move.id].x = move.x
                windows.layout[move.id].y = move.y
            }
        }, 100)
    }
}

let resizeTimeout: any = undefined
function resize(resize: any) {
    if (resize.id) {
        if (!(resize.id in windows.layout)) windows.layout[resize.id] = {}
        if (resizeTimeout) clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
            if (windows.winbox[resize.id].min) {
                windows.layout[resize.id].min = true
                windows.layout[resize.id].max = false
            } else if (windows.winbox[resize.id].max) {
                windows.layout[resize.id].max = true
                windows.layout[resize.id].min = false
            } else {
                windows.layout[resize.id].min = false
                windows.layout[resize.id].max = false
                windows.layout[resize.id].width = resize.width
                windows.layout[resize.id].height = resize.height
            }
        }, 100)
    }
}

function close(close: any) {
    if (close.id) {
        if (!(close.id in windows.layout)) windows.layout[close.id] = {}
        windows.layout[close.id].enabled = false
    }
}

function focus(focus: any) {
    if (focus.id) windows.focusId = focus.id
}

onMounted(() => {
    if (wb.value) {
        wb.value.winbox.id = props.id
    }
    nextTick(() => {
        if (wb.value && wb.value.winbox) {
            windows.winbox[props.id] = wb.value.winbox
            if (windows.focusId && props.id == windows.focusId) wb.value.winbox.focus()
            if (props.id in windows.layout && windows.layout[props.id].min) wb.value.winbox.minimize()
            if (props.id in windows.layout && windows.layout[props.id].max) wb.value.winbox.maximize()
        }
    })
})

onUnmounted(() => {
    wb.value?.winbox.close(true)
    delete windows.winbox[props.id]
})
</script>
