<template>
    <div v-if="wx.noData(props.id)" class="pa-3 text-center">
        NO DATA
    </div>
    <div v-else style="height: 100%">
        <div style="position: relative">
            <div style="position: absolute; right: 3px; z-index: 100" class="text-caption text-grey-darken-2">
                {{ time.replace("T", " ") }}
            </div>
        </div>
        <div style="height: 100%; display: flex; justify-content: center; align-items: center">
            <pre class="pa-1" style="display: inline-block; text-align: left; font-size: 14px; line-height: 16px" v-html="metsensorStylized"></pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue"
import { useWxStore } from "@/stores/wx";

const props = defineProps<{ id: string }>()

const wx = useWxStore()

const time = computed(() => wx.time(props.id))
const metsensor = computed(() => wx.metsensor(props.id))
const metsensorStylized = computed(() => {
    if (!metsensor.value) return ""
    const inLines = metsensor.value.split(/\n+/)
    const outLines = []
    for (const line of inLines) {
        if (line.startsWith("RWY")) outLines.push(blue(line))
        else if (line.match(/^T (SURF|BODY)\s+\/\/\.\//)) { /* pass */ }
        else if (line.match(/^(MEAN02|VRB|MIN\/MAX|COMP|RVR|VIS|PRW|QFETHR|T SURF|T BODY|CLD)/)) outLines.push(blueFirstWord(line))
        else if (line.startsWith("QNH")) {
            const m = line.match(/QNH\s+(\S+)\s+TRL\s+(\S+)\s+QFE\s+(\S+)/)
            if (m) {
                outLines.push(`<hr class="my-2"/><div class="text-center">${blue("QNH")} <span style="font-size: 20px">${m[1]}</span></div><hr class="mt-2"/>`)
                outLines.push(`${blue("TRL")}  ${m[2].padEnd(8)} ${blue("QFE")}  ${m[3]}`)
            } else outLines.push(line)

        } else if (line.startsWith("T") && line.includes("DP")) {
            const m = line.match(/T\s+(\S+)\s+DP\s+(\S+)\s+RH\s+(\S+)/)
            if (m) outLines.push(`${blue("T")}    ${m[1].padEnd(8)} ${blue("DP")}   ${m[2].padEnd(7)} ${blue("RH")}   ${m[3]}`)
            else outLines.push(line)
        } else outLines.push(line)
    }
    return outLines.join("\n")
})

const blue = (text: string) => `<span style="color: #33f">${text}</span>`

const blueFirstWord = (text: string) => text.replace(/^(\S+)/, blue("$1"))

let subscription = ""

onMounted(() => {
    subscription = wx.subscribe(props.id)
})

onUnmounted(() => {
    wx.unsubscribe(subscription)
})
</script>
