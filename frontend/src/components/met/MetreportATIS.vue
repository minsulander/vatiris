<template>
    <div v-if="!atis" class="pa-3 text-center">NO DATA</div>
    <div
        v-else
        class="atis"
        :class="{
            flash: changed && settings.metreportFlash,
            'flash-long': changedLong && settings.metreportFlash,
        }"
        style="height: 100%"
        @click="click"
    >
        <div class="float-right text-caption font-weight-bold text-orange-darken-4" v-if="outdated">
            {{ moment(time).utc().format("YYYY-MM-DD HH:mm:ss") }}
        </div>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="formattedAtis"
        ></pre>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue"
import { useVatsimStore } from "@/stores/vatsim"
import { useSettingsStore } from "@/stores/settings"
import moment from "moment"
import { useWxStore } from "@/stores/wx"

const props = defineProps<{ id: string; type?: "ARR" | "DEP" }>()

const wx = useWxStore()
const vatsim = useVatsimStore()
const settings = useSettingsStore()

const outdated = ref(false)
const atis = computed(() => {
    if (props.id === "ESSA") {
        const atisType = props.type === "DEP" ? "ESSA_D" : "ESSA_A"
        const atisData =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith(atisType))
        if (atisData) {
            return {
                text: atisData.text_atis || [],
                last_updated: atisData.last_updated,
            }
        }
    } else {
        const atisData =
            vatsim.data.atis &&
            vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
        if (atisData) {
            return {
                text: atisData.text_atis || [],
                last_updated: atisData.last_updated,
            }
        }
    }
    return null
})

const time = computed(() => {
    if (atis.value) return atis.value.last_updated
    return ""
})

const formattedAtis = computed(() => {
    if (!atis.value) return ""
    return formatAtisText(atis.value.text?.join("\n") || "")
})

const atisLetters = {
    A: "ALF",
    B: "BRA",
    C: "CHA",
    D: "DEL",
    E: "ECH",
    F: "FOX",
    G: "GOL",
    H: "HOT",
    I: "IND",
    J: "JUL",
    K: "KIL",
    L: "LIM",
    M: "MIK",
    N: "NOV",
    O: "OSC",
    P: "PAP",
    Q: "QUE",
    R: "ROM",
    S: "SIE",
    T: "TAN",
    U: "UNI",
    V: "VIC",
    W: "WHI",
    X: "X-R",
    Y: "YAN",
    Z: "ZUL",
}

const metarAuto = computed(() => wx.metar(props.id) && wx.metar(props.id).includes(" AUTO "))

const rwyDiffersToVatsim = computed(() => {
    const rwy = wx.rwy(props.id)
    if (!rwy) return false
    if (props.id == "ESSA") {
        const arrAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_A"))
        const depAtis =
            vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_D"))
        if (!arrAtis || !arrAtis.text_atis || arrAtis.text_atis.length == 0) return false
        if (!depAtis || !depAtis.text_atis || depAtis.text_atis.length == 0) return false
        const arrRwyInUse = arrAtis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const depRwyInUse = depAtis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const rwyText = rwy.replace(/<[^>]*>?/gm, "")
        return (
            arrRwyInUse &&
            depRwyInUse &&
            (!rwyText.includes(`ARR: ${arrRwyInUse}`) || !rwyText.includes(`DEP: ${depRwyInUse}`))
        )
    } else {
        const atis =
            vatsim.data.atis &&
            vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
        if (!atis || !atis.text_atis || atis.text_atis.length == 0) return false
        const rwyInUse = atis.text_atis.join(" ")?.match(/RWY\s+(\d+[LRC]?) IN USE/)?.[1]
        const rwyText = rwy.replace(/<[^>]*>?/gm, "")
        return rwyInUse && !rwyText.endsWith(rwyInUse)
    }
})

const formatRunwayInUse = (text: string) => {
    const regex = /\b(?:RNP|RNP Z|ILS)?\s*RWY\s+(\d{2}[LCR]?)\s+IN USE\b/gi
    return text.replace(regex, (match, runway) => {
        return `<span style="font-size: 18px; font-weight: bold;">RWY ${runway}</span>`
    })
}

const extractExtraRunway = (text: string) => {
    if (props.type === "ARR") {
        const match = text.match(/DEP RWY (\d{2}[LCR]?)\./)
        return match ? match[0].slice(0, -1) : ""
    } else if (props.type === "DEP") {
        const match = text.match(/ARR RWY (\d{2}[LCR]?)\./)
        return match ? match[0].slice(0, -1) : ""
    }
    return ""
}

const extraRunway = computed(() => {
    if (!atis.value) return ""
    return extractExtraRunway(atis.value.text.join("\n"))
})

const extractWind = (text: string) => {
    const windPatterns = [
        /WIND (\d{3}\/\d{2,3}KT\s+VRB BTN \d{3}\/ AND \d{3}\/)/, // WIND {wind_dir}/{wind_spd}KT VRB BTN {wind_vmin}/ AND {wind_vmax}/
        /WIND (\d{3}\/\d{2,3}KT(?:\s+MAX \d+)?)/, // WIND {wind_dir}/{wind_spd}KT [MAX {wind_gust}]
        /WIND (VRB \d{2,3}KT(?:\s+MAX \d+)?)/, // WIND VRB {wind_spd}KT [MAX {wind_gust}]
        /WIND (CALM)/, // WIND CALM
    ]

    for (const pattern of windPatterns) {
        const match = text.match(pattern)
        if (match) {
            return match[1]
        }
    }

    return ""
}
//TODO cardinal directions (single/multiple vis values)
const extractVisibility = (text: string) => {
    if (text.includes("CAVOK")) {
        return "CAVOK"
    }

    const visRegex = /VIS\s+(\d{4}|\d{1,2}KM|CAVOK|(?:\d{4}[NSEW]\s*)+)/i
    const match = text.match(visRegex)

    if (!match) return ""

    const visData = match[1]

    if (visData.includes("KM")) {
        return `VIS ${visData}`
    }

    const formatVisibility = (value: string) => {
        const num = parseInt(value)
        return num > 4999 ? `${Math.floor(num / 1000)}KM` : `${num}M`
    }

    if (visData.match(/^\d{4}$/)) {
        return `VIS ${formatVisibility(visData)}`
    }

    if (visData.match(/(?:\d{4}[NSEW]\s*)+/)) {
        const directions = visData.match(/\d{4}[NSEW]/g) || []
        return `VIS ${directions.map((dir) => `${dir.slice(-1)} ${formatVisibility(dir.slice(0, 4))}`).join(" ")}`
    }

    return `VIS ${visData}`
}

const extractWeatherConditions = (text: string) => {
    const visToCloudRegex = /VIS.*?(?=CLD)/s
    const match = text.match(visToCloudRegex)

    if (!match) return ""

    const conditionText = match[0]
    const conditionRegex =
        /(RE)?(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS){1,3}/g
    const conditions = []

    let conditionMatch
    while ((conditionMatch = conditionRegex.exec(conditionText)) !== null) {
        let condition = ""

        // Recent
        if (conditionMatch[1]) {
            condition += conditionMatch[1]
        }

        // Intensity or proximity
        if (conditionMatch[2]) {
            condition += conditionMatch[2]
        }

        // Descriptor
        if (conditionMatch[3]) {
            condition += conditionMatch[3]
        }

        // Precipitation, Obscuration, or Other (up to 3)
        if (conditionMatch[4]) {
            condition += conditionMatch[4]
        }

        conditions.push(condition)
    }

    if (conditionText.includes("NSW")) {
        conditions.push("NSW")
    }

    return conditions.join(" ")
}
const extractClouds = (text: string) => {
    const cloudRegex = /(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?/g
    const vvRegex = /VV(\d{3}|\/{3})/
    const specialCloudRegex = /\b(NSC|NCD|CLR|SKC)\b/
    const cldRegex = /CLD/

    let clouds = []
    let match
    let vertVisibility = ""
    let specialCloud = ""

    // Extract cloud layers
    while ((match = cloudRegex.exec(text)) !== null) {
        const cloudType = match[1]
        const heightInHundreds = parseInt(match[2])
        const heightInFeet = heightInHundreds * 100
        const convectiveCloud = match[3] ? `${match[3]} ` : ""
        clouds.push(`${cloudType} ${convectiveCloud}${heightInFeet}FT`)
    }

    // Extract vertical visibility
    const vvMatch = text.match(vvRegex)
    if (vvMatch) {
        if (vvMatch[1] === "///") {
            vertVisibility = "VER VIS ///"
        } else {
            const vvHeight = parseInt(vvMatch[1]) * 100
            vertVisibility = `VER VIS ${vvHeight}FT`
        }
    }

    // Extract special cloud conditions
    const specialCloudMatch = text.match(specialCloudRegex)
    if (specialCloudMatch) {
        specialCloud = specialCloudMatch[1]
    }

    // Combine cloud information
    if (clouds.length > 0) {
        return `CLD ${clouds.join(" ")}${vertVisibility ? " " + vertVisibility : ""}`
    }

    if (vertVisibility) {
        return `CLD ${vertVisibility}`
    }

    if (specialCloud) {
        return `CLD ${specialCloud}`
    }

    // Check for lone "CLD" without other data
    if (text.match(cldRegex) && !clouds.length && !vertVisibility && !specialCloud) {
        return ""
    }

    return ""
}

const extractTemperature = (text: string) => {
    const match = text.match(/T(M?)(\d{2})\//)
    if (match) {
        if (match[1] == "M") match[1] = "MS"
        return `T${match[1]}${match[2]}`
    }
    return ""
}

const extractDewpoint = (text: string) => {
    const match = text.match(/\/DP(M?)(\d{2})/)
    if (match) {
        if (match[1] == "M") match[1] = "MS"
        return `DP${match[1]}${match[2]}`
    }
    return ""
}

const formatAtisText = (text: string) => {
    if (!text) return ""

    // Remove all line breaks from the input text
    text = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim()

    const extractInfo = (regex: RegExp, defaultValue: string = "") => {
        const match = text.match(regex)
        return match ? match[1] : defaultValue
    }

    const extractOther = (text: string) => {
        let other = ""
        if (props.id === "ESSA" && props.type === "DEP") {
            const match = text.match(/ARR RWY \d{2}[LCR]?\.\s*([\s\S]*?)(?=MET REPORT|$)/i)
            if (match) other = match[1].trim()
        } else if (props.type === "ARR" || (!props.type && props.id === "ESSA")) {
            const match = text.match(/DEP RWY \d{2}[LCR]?\.\s*([\s\S]*?)(?=TRL \d\d|$)/i)
            if (match) other = match[1].trim()
            if (!props.type && props.id === "ESSA") {
                const text2 = vatsim.data.atis
                    .find((a) => a.callsign == "ESSA_D_ATIS")
                    ?.text_atis?.join(" ")
                if (text2) {
                    const match2 = text2.match(
                        /ARR RWY \d{2}[LCR]?\.\s*([\s\S]*?)(?=MET REPORT|$)/i,
                    )
                    if (match2) other += "\n\n" + match2[1].trim()
                }
            }
        } else {
            const match = text.match(/IN USE\.([\s\S]*?)TRL/i)
            if (match) other = match[1].trim()
        }
        return other
    }

    const otherDisplay = computed(() => {
        let processedOther = other
            .replace("SINGLE RWY OPERATIONS.", "")
            .replace("ADDNL SPACING ON FINAL DUE TO RWYS IN USE.", "")
            .trim()
        return processedOther
    })

    const icao = extractInfo(/^(ES[A-Z]{2})/)
    const atisLetter = extractInfo(/ATIS ([A-Z])/)
    let atisCode = atisLetters[atisLetter as keyof typeof atisLetters] || ""
    if (props.id === "ESSA" && !props.type) {
        const depAtis = vatsim.data.atis.find((a) => a.callsign == "ESSA_D_ATIS")
        if (depAtis) {
            const match = depAtis.text_atis?.join(" ").match(/ATIS ([A-Z])/)
            if (match && match[1] != atisLetter)
                atisCode += "/" + atisLetters[match[1] as keyof typeof atisLetters]
        }
    }
    const atisType = props.type
    let runway = extractInfo(/RWY\s+(\d{2}[LCR]?)/)
    if (props.id === "ESSA" && !props.type) {
        const match = text.match(/DEP RWY (\d{2}[LCR]?)\./)
        if (match && match[1] != runway) runway += "/" + match[1]
    }

    const time = extractInfo(/TIME (\d{4})Z/, "")
    const date = extractInfo(/(\d{6}Z)/)
    const wind = extractWind(text)
    const vis = extractVisibility(text)
    const conditions = extractWeatherConditions(text)
    const clouds = extractClouds(text)
    const temperature = extractTemperature(text)
    const dewpoint = extractDewpoint(text)
    const qnh = extractInfo(/QNH\s+(\d{3,4})\s+HPA/).padStart(4, "0")
    const qnhTrend = vatsim.qnhTrend(props.id)
    const trend =
        typeof qnhTrend == "undefined"
            ? ""
            : qnhTrend > 0
              ? " <div style='display: inline-block; transform: rotate(-90deg);'><i class='mdi mdi-play'></i></div>"
              : qnhTrend < 0
                ? " <div style='display: inline-block; transform: rotate(90deg);'><i class='mdi mdi-play'></i></div>"
                : " <i class='mdi mdi-play'></i>"
    const trl = extractInfo(/TRL\s+(\d+)/)
    const other = extractOther(text)

    const currentDate = moment.utc()
    const formattedDate = currentDate.format("YYMMDD")
    const formattedTime = `${currentDate.format("DD")}${time}`

    const runwayClass =
        rwyDiffersToVatsim.value && !metarAuto.value
            ? "text-orange-darken-3 font-weight-bold"
            : rwyDiffersToVatsim.value && metarAuto.value
              ? "text-grey-darken-1"
              : ""
    let otherRunway = extraRunway.value
    if (runwayClass)
        otherRunway = otherRunway.replace("RWY ", `RWY <span class="${runwayClass}">`) + "</span>"

    //Conditional for ARR/DEP
    const trlDisplay = props.type === "DEP" ? "" : `TRL ${trl}`

    return `
${icao}     ${atisType || "   "}   <span style="font-size: 16px; font-weight: bold;">${atisCode}</span>${" ".repeat(Math.max(0, 10 - atisCode.length))} ${formattedDate}
RWY <span class="${runwayClass}">${runway.padEnd(11)}</span>MET REPORT  <b>${formattedTime}Z</b> ${otherRunway}
WIND ${wind}

${vis}

${conditions}

${clouds}
${temperature.padEnd(11)}${dewpoint}
QNH <div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px">${qnh.split("").join(" ")}${trend}</div> HPA   ${trlDisplay}

${otherDisplay.value}
  `.trim()
}

const changed = ref(false)
const changedLong = ref(false)
let changeTimeouts: any[] = []

function click() {
    for (const timeout of changeTimeouts) clearTimeout(timeout)
    changeTimeouts.splice(0)
    changed.value = changedLong.value = false
}

const firstUpdate = ref(true)

watch(
    [
        () => atis.value?.text, // This covers the entire ATIS text, including atisLetter, atisCode, runway, etc.
    ],
    (newValues, oldValues) => {
        if (firstUpdate.value) {
            firstUpdate.value = false
            return
        }
        changed.value = false
        if (!settings.metreportFlash) return
        const newValue = newValues.join(" ")
        const oldValue = oldValues.join(" ")
        if (oldValue && newValue !== oldValue) {
            changed.value = true
        }
        if (changed.value) {
            changeTimeouts.splice(0)
            changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
            changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
            changeTimeouts.push(
                setTimeout(() => {
                    changed.value = false
                    changedLong.value = true
                }, 3000),
            )
            changeTimeouts.push(
                setTimeout(() => {
                    changed.value = false
                    changedLong.value = false
                }, 63000),
            )
        }
    },
)

let wxSubscription = ""
let checkOutdatedInterval: any = undefined
onMounted(() => {
    if (!vatsim.data.general) vatsim.fetchData()
    wxSubscription = wx.subscribe(props.id)
    checkOutdatedInterval = setInterval(() => {
        outdated.value =
            time.value.length > 0 && moment(time.value).isBefore(moment().subtract(5, "minutes"))
    }, 5000)
})

onUnmounted(() => {
    clearInterval(checkOutdatedInterval)
    wx.unsubscribe(wxSubscription)
})
</script>

<style scoped>
.atis.flash {
    background-color: #33f;
    color: #ddd;
    transition:
        background-color 0.5s,
        color 0.5s;
}
.atis.flash-long {
    color: #33f;
    transition: color 0.5s;
}
</style>
