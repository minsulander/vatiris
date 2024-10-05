<template>
    <div v-if="wx.noData(props.id)" class="pa-3 text-center">NO DATA</div>
    <div
        v-else
        class="metsensor"
        :class="changed ? 'flash' : ''"
        style="height: 100%"
        @click="click"
    >
        <div style="position: relative">
            <div
                style="position: absolute; right: 3px; z-index: 100"
                class="text-caption text-grey-darken-2"
            >
                {{ time.replace("T", " ") }}
            </div>
        </div>
        <div style="height: 100%; display: flex; justify-content: center; align-items: center">
            <pre
                class="pa-1"
                style="display: inline-block; text-align: left; font-size: 14px; line-height: 16px"
                v-html="metsensorStylized"
            ></pre>
        </div>
    </div>
</template>

<style>
.metsensor span.changed {
    transition:
        background-color 0.25s,
        color 0.25s;
}
.metsensor.flash span.changed {
    background-color: #66f;
    color: #ddd;
}
.metsensor .leqnh,
.metsensor .leqnh span.changed {
    display: inline;
    font-size: 21px;
    font-weight: 700 !important;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue"
import { useWxStore } from "@/stores/wx"
import { diffWords } from "diff"
import { useSettingsStore } from "@/stores/settings"

const props = defineProps<{ id: string }>()

const wx = useWxStore()
const settings = useSettingsStore()

const time = computed(() => wx.time(props.id))
const metsensor = computed(() => wx.metsensor(props.id))
const metsensorStylized = ref("")
const changed = ref(false)

function stylize(newValue: string, oldValue: string = "") {
    function padEndHtml(s: string, n: number) {
        const text = s.replace(/<[^>]+>/g, "")
        return text + " ".repeat(n - text.length)
    }

    if (!newValue) {
        metsensorStylized.value = ""
        return
    }
    const inLines = newValue.split(/\n+/)
    const lastLines = oldValue.split(/\n+/)
    const outLines = []
    for (let no = 0; no < inLines.length; no++) {
        let line = inLines[no]
        if (inLines.length == lastLines.length) {
            const lastLine = lastLines[no]
            const diff = diffWords(lastLine.substring(5), line.substring(5), {
                ignoreCase: true,
                ignoreWhitespace: true,
            })
            line = line.substring(0, 5)
            for (const part of diff) {
                if (part.removed) continue
                if (part.added) line += `<span class="changed">${part.value}</span>`
                else line += part.value
            }
        }
        if (line.startsWith("RWY")) {
            outLines.push(blue(line))
        } else if (line.match(/^(T SURF|T BODY)\s+\/\/\.\/\s+\/\/\.\/\s+\/\/\.\//)) {
            // skip
        } else if (line.match(/^(MEAN02|VRB|MIN\/MAX|COMP|RVR|VIS|PRW|QFETHR|T SURF|T BODY|CLD)/)) {
            if (line.startsWith("CLD1")) line = "CLD " + line.substring(4)
            else if (line.startsWith("CLD2") || line.startsWith("CLD3"))
                line = "    " + line.substring(4)
            if (line.startsWith("RVR")) {
                const m = line.match(/RVR(\s+)(.+?)(\s\s+)(.+?)(\s\s+)(.+)/)
                if (m) {
                    const val1 = parseInt(m[2].replace(/\D/g, ""))
                    const val2 = parseInt(m[4].replace(/\D/g, ""))
                    const val3 = parseInt(m[6].replace(/\D/g, ""))
                    if (val1 < 2000 && val2 < 2000 && val3 < 2000) {
                        line = `RVR${m[1]}<b>${m[2]}</b>${m[3]}<b>${m[4]}</b>${m[5]}<b>${m[6]}</b>`
                    }
                }
                outLines.push("") // empty line between COMP and RVR
            }
            outLines.push(blueFirstWord(line))
        } else if (line.startsWith("QNH")) {
            const m = line.match(/QNH(\s+.+?\s+)TRL\s+(.+?)\s+QFE\s+(\S+)(.*)/)
            if (m) {
                outLines.push(
                    `<hr class="my-2"/><div class="text-center">${blue("QNH")}<div class="leqnh">${m[1]}</div></div><hr class="mt-2" style="margin-bottom: -8px"/>`,
                )
                if (m[2] != "//") {
                    outLines.push(
                        `${blue("TRL")}  ${padEndHtml(m[2], 8)} ${blue("QFE")}  ${m[3]}${m[4]}`,
                    )
                }
            } else outLines.push(line)
        } else if (line.startsWith("T") && line.includes("DP")) {
            const m = line.match(/T\s+(.+?)\s+DP\s+(.+?)\s+RH\s+(\S+)(.*)/)
            if (m) {
                line = `${blue("T")}    ${padEndHtml(m[1], 8)} ${blue("DP")}   ${padEndHtml(m[2], 7)} ${blue("HUM")}   ${m[3]}%${m[4]}`
                line = line.replace("</span%>", "</span>%") // fulfix för flashing... nåväl.
                outLines.push(line)
            } else {
                console.log("Metsensor no bueno", line)
                outLines.push(line)
            }
        } else {
            console.log("Metsensor no match", line)
            outLines.push(line)
        }
    }
    metsensorStylized.value = outLines.join("\n")
}

const blue = (text: string) => `<span style="color: #33f">${text}</span>`

const blueFirstWord = (text: string) => text.replace(/^(..\S+)/, blue("$1"))

let subscription = ""
let changeTimeouts: any[] = []

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = false
}

onMounted(() => {
    stylize(metsensor.value)
    subscription = wx.subscribe(props.id)
})

onUnmounted(() => {
    wx.unsubscribe(subscription)
})

watch(metsensor, (newValue: string, oldValue: string) => {
    stylize(newValue, oldValue)
    changed.value = false
    if (!settings.metsensorFlash) return
    changed.value = true
    changeTimeouts.splice(0)
    changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
    changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
    changeTimeouts.push(setTimeout(() => (changed.value = false), 3000))
})
</script>
