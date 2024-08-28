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
        x: id in windows.layout && "x" in windows.layout[id] ? windows.layout[id].x : typeof(width) == "number" ? (window.innerWidth / 2 - width / 2) : 0,
        y: id in windows.layout && "y" in windows.layout[id] ? windows.layout[id].y : typeof(height) == "number" ? (window.innerHeight / 2 - height / 2) : 0,
        width: id in windows.layout && "width" in windows.layout[id] ? windows.layout[id].width : width,
        height: id in windows.layout && "height" in windows.layout[id] ? windows.layout[id].height : height
    }
})

let moveTimeout: any = undefined
let lastSnap = Date.now()
function move(move: any) {
    if (move.id) {
        if (!(move.id in windows.layout)) windows.layout[move.id] = {}
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
            moveTimeout = undefined
            if (windows.winbox[move.id].min || windows.winbox[move.id].max) return
            windows.layout[move.id].x = move.x
            windows.layout[move.id].y = move.y

            // TODO prevent snapping when resizing left corner = moving

            // snapping
            if (Date.now() - lastSnap >= 300) setTimeout(() => {
                if (wb.value && wb.value.winbox) {
                    const own = wb.value.winbox
                    const threshold = 10
                    for (const id in windows.winbox) {
                        if (id == move.id) continue
                        const win = windows.winbox[id]
                        let snap = false
                        if (Math.abs(move.x - (win.x + win.width)) < threshold && Math.abs(move.y - win.y) < threshold) {
                            // top left corner
                            snap = true
                            move.y = win.y
                            move.x = win.x + win.width
                        } else if (Math.abs(move.x + own.width - win.x) < threshold && Math.abs(move.y - win.y) < threshold) {
                            // top right corner
                            snap = true
                            move.y = win.y
                            move.x = win.x - own.width
                        }
                        if (snap) {
                            lastSnap = Date.now()
                            own.move(move.x, move.y)
                            break
                        }
                    }
                }
            }, 150)
        }, 100)
    }
}

function resize(resize: any) {
    if (resize.id) {
        if (!(resize.id in windows.layout)) windows.layout[resize.id] = {}
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
            moveTimeout = undefined
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

                // snapping
                if (Date.now() - lastSnap >= 300) setTimeout(() => {
                    if (wb.value && wb.value.winbox) {
                        const own = wb.value.winbox
                        const threshold = 10
                        for (const id in windows.winbox) {
                            if (id == resize.id) continue
                            const win = windows.winbox[id]
                            let snap = false
                            if (Math.abs(resize.height - win.height) < threshold && win.y == own.y && (win.x + win.width == own.x || own.x + resize.width == win.x)) {
                                snap = true
                                resize.height = win.height
                            }
                            if (snap) {
                                lastSnap = Date.now()
                                own.resize(resize.width, resize.height)
                                break
                            }
                        }
                    }
                }, 150)
            }
        }, 100)
    }
}

function close(close: any) {
    if (close.id && !windows.unmounting) {
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
