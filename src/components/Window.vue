<template>
    <VueWinBox ref="wb" :options="options" @move="move" @resize="resize" @close="close" @focus="focus">
        <slot></slot>
    </VueWinBox>
</template>

<script setup lang="ts">
import { VueWinBox } from "vue-winbox"
import { computed, ref } from "vue"
import { onUnmounted } from "vue";
import { onMounted } from "vue";
import { useWindowsStore } from "@/stores/windows"
import { nextTick } from "vue";

const props = defineProps<{id: string, title: string, width: string | number, height: string | number}>()

const windows = useWindowsStore()

const wb = ref()
const options = computed(() => {
    return {
        title: props.title,
        class: "no-full no-min no-max",
        top: 25,
        border: 3,
        x: props.id in windows.layout ? windows.layout[props.id].x : 0,
        y: props.id in windows.layout ? windows.layout[props.id].y : 0,
        width: props.id in windows.layout ? windows.layout[props.id].width || props.width : props.width,
        height: props.id in windows.layout ? windows.layout[props.id].height || props.height : props.height,
    }
})

function move(move: any) {
    if (move.id) {
        if (!(move.id in windows.layout)) windows.layout[move.id] = {}
        windows.layout[move.id].x = move.x
        windows.layout[move.id].y = move.y
    }
}

function resize(resize: any) {
    if (resize.id) {
        if (!(resize.id in windows.layout)) windows.layout[resize.id] = {}
        windows.layout[resize.id].width = resize.width
        windows.layout[resize.id].height = resize.height
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
    if (windows.focusId && props.id == windows.focusId) nextTick(() => wb.value?.winbox.focus())
})

onUnmounted(() => {
    wb.value?.winbox.close(true)
})
</script>
