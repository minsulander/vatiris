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
import { useSettingsStore } from "@/stores/settings"
import { useWindowsStore } from "@/stores/windows"
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"
import { VueWinBox } from "vue-winbox"

const props = defineProps<{
    id: string
    title?: string
    width?: string | number
    height?: string | number
    class?: string
}>()

const windows = useWindowsStore()
const settings = useSettingsStore()

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
        x:
            id in windows.layout && "x" in windows.layout[id]
                ? windows.layout[id].x
                : typeof width == "number"
                  ? window.innerWidth / 2 - width / 2
                  : 0,
        y:
            id in windows.layout && "y" in windows.layout[id]
                ? windows.layout[id].y
                : typeof height == "number"
                  ? window.innerHeight / 2 - height / 2
                  : 0,
        width:
            id in windows.layout && "width" in windows.layout[id]
                ? windows.layout[id].width
                : width,
        height:
            id in windows.layout && "height" in windows.layout[id]
                ? windows.layout[id].height
                : height,
    }
})

let moveTimeout: any = undefined
let lastSnap = Date.now()
let lastMove = Date.now()
let lastResize = Date.now()

const topY = 30
const snapT = 10

function move(move: any) {
    if (move.id) {
        lastMove = Date.now()
        if (!(move.id in windows.layout)) windows.layout[move.id] = {}
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
            moveTimeout = undefined
            if (windows.winbox[move.id].min || windows.winbox[move.id].max) return
            windows.layout[move.id].x = move.x
            windows.layout[move.id].y = move.y

            // snapping
            if (settings.windowSnapping && Date.now() - lastSnap >= 300)
                setTimeout(() => {
                    if (wb.value && wb.value.winbox) {
                        const own = wb.value.winbox
                        snap(own)
                    }
                }, 150)
        }, 100)
    }
}

function resize(resize: any) {
    if (resize.id) {
        lastResize = Date.now()
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
                if (settings.windowSnapping && Date.now() - lastSnap >= 300)
                    setTimeout(() => {
                        if (wb.value && wb.value.winbox) {
                            const own = wb.value.winbox
                            snap(own)
                        }
                    }, 150)
            }
        }, 100)
    }
}

function snap(own: any) {
    lastSnap = Date.now()
    const moved = Date.now() - lastMove < 500
    const resized = Date.now() - lastResize < 500
    if (moved) {
        let snapX = -1
        let snapY = -1
        // snap to static boundaries
        if (own.x < snapT) snapX = 0
        if (own.y < topY + snapT) snapY = topY
        // snap to other windows
        for (const id in windows.winbox) {
            if (id == own.id) continue
            const win = windows.winbox[id]
            // snap left to left
            if (
                snapX < 0 &&
                Math.abs(win.x - own.x) < snapT &&
                own.y > win.y - snapT &&
                own.y < win.y + win.height + snapT
            )
                snapX = win.x
            // snap left to right
            if (
                snapX < 0 &&
                Math.abs(win.x + win.width - own.x) < snapT &&
                own.y > win.y - snapT &&
                own.y < win.y + win.height + snapT
            )
                snapX = win.x + win.width
            // snap top to top
            if (
                snapY < 0 &&
                Math.abs(win.y - own.y) < snapT &&
                own.x > win.x - snapT &&
                own.x < win.x + win.width + snapT
            )
                snapY = win.y
            // snap top to bottom
            if (
                snapY < 0 &&
                Math.abs(win.y + win.height - own.y) < snapT &&
                own.x > win.x - snapT &&
                own.x < win.x + win.width + snapT
            )
                snapY = win.y + win.height
            // TODO if not resized, snap right and bottom
            if (snapX > 0 && snapY > 0) break
        }
        if (snapX >= 0 || snapY >= 0) {
            if (snapX < 0) snapX = own.x
            if (snapY < 0) snapY = own.y
            if (resized) own.resize(own.width + (own.x - snapX), own.height + (own.y - snapY))
            own.move(snapX, snapY)
        }
    }
    let snapW = -1
    let snapH = -1
    // snap to static boundaries
    if (own.x + own.width > window.innerWidth - snapT) snapW = window.innerWidth - own.x
    if (own.y + own.height > window.innerHeight - snapT) snapH = window.innerHeight - own.y
    // snap to other windows
    for (const id in windows.winbox) {
        if (id == own.id) continue
        const win = windows.winbox[id]
        // snap right to right
        if (
            snapW < 0 &&
            Math.abs(own.x + own.width - (win.x + win.width)) < snapT &&
            own.y > win.y - snapT &&
            own.y < win.y + win.height + snapT
        )
            snapW = win.x + win.width - own.x
        // snap right to left
        if (
            snapW < 0 &&
            Math.abs(own.x + own.width - win.x) < snapT &&
            own.y > win.y - snapT &&
            own.y < win.y + win.height + snapT
        )
            snapW = win.x - own.x
        // snap bottom to bottom
        if (
            snapH < 0 &&
            Math.abs(own.y + own.height - (win.y + win.height)) < snapT &&
            ((own.x > win.x + win.width - snapT && own.x < win.x + win.width + snapT) ||
                (own.x + own.width > win.x - snapT &&
                    own.x + own.width < win.x + win.width + snapT))
        )
            snapH = win.y + win.height - own.y
        // snap bottom to top
        if (
            snapH < 0 &&
            Math.abs(own.y + own.height - win.y) < snapT &&
            ((own.x > win.x + win.width - snapT && own.x < win.x + win.width + snapT) ||
                (own.x + own.width > win.x - snapT &&
                    own.x + own.width < win.x + win.width + snapT))
        )
            snapH = win.y - own.y
        if (snapW >= 0 && snapH >= 0) break
    }
    if (snapW >= 0 || snapH >= 0) {
        if (snapW < 0) snapW = own.width
        if (snapH < 0) snapH = own.height
        own.resize(snapW, snapH)
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
            if (props.id in windows.layout && windows.layout[props.id].min)
                wb.value.winbox.minimize()
            if (props.id in windows.layout && windows.layout[props.id].max)
                wb.value.winbox.maximize()
        }
    })
})

onUnmounted(() => {
    wb.value?.winbox.close(true)
    delete windows.winbox[props.id]
})
</script>
