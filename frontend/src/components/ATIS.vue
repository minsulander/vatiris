<template>
    <div v-if="!atis && !localAtis" class="pa-3 text-center">NO DATA</div>
    <div
        v-else
        class="atis"
        :class="{ flash: changed && settings.metreportFlash, 'flash-long': changedLong && settings.metreportFlash }"
        style="height: 100%"
        @click="click"
    >
        <div class="float-right text-caption text-grey-darken-2">
            {{ time }}
        </div>
        <v-text-field
            v-if="settings.enableLocalAtis"
            v-model="localAtisInput"
            label="Enter local ATIS"
            @input="updateLocalAtis"
        ></v-text-field>
        <pre
            class="pa-1"
            style="font-size: 14px; line-height: 16px; white-space: pre-wrap"
            v-html="formattedAtis"
        ></pre>
    </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from "vue"
import { useVatsimStore } from "@/stores/vatsim"
import { useSettingsStore } from "@/stores/settings"
import moment from "moment"

const props = defineProps<{ id: string }>()

const vatsim = useVatsimStore()
const settings = useSettingsStore()

const localAtisInput = ref("")
const localAtis = ref(null)

const atis = computed(() => {
    if (localAtis.value) return localAtis.value

    if (props.id === "ESSA") {
        const arrAtis = vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_A"))
        const depAtis = vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith("ESSA_D"))
        if (arrAtis && depAtis) {
            return {
                arr: arrAtis.text_atis || [],
                dep: depAtis.text_atis || [],
                last_updated: Math.max(arrAtis.last_updated, depAtis.last_updated)
            }
        }
    } else {
        const atisData = vatsim.data.atis && vatsim.data.atis.find((atis) => atis.callsign.startsWith(props.id + "_"))
        if (atisData) {
            return {
                text: atisData.text_atis || [],
                last_updated: atisData.last_updated
            }
        }
    }
    return { text: [], last_updated: 0 }
})

const time = computed(() => {
    if (localAtis.value) return moment().format("YYYY-MM-DD HH:mm:ss")
    if (atis.value) {
        return moment.unix(atis.value.last_updated).format("YYYY-MM-DD HH:mm:ss")
    }
    return ""
})

const formattedAtis = computed(() => {
    if (localAtis.value) return formatAtisText(localAtis.value.text.join("\n"))
    if (!atis.value) return ""
    if (props.id === "ESSA") {
        return formatAtisText(atis.value.arr?.join("\n") || "") + "\n\n" + formatAtisText(atis.value.dep?.join("\n") || "")
    } else {
        return formatAtisText(atis.value.text?.join("\n") || "")
    }
})

const atisLetters = {
    A: "ALF", B: "BRA", C: "CHA", D: "DEL", E: "ECH", F: "FOX", G: "GOL", H: "HOT",
    I: "IND", J: "JUL", K: "KIL", L: "LIM", M: "MIK", N: "NOV", O: "OSC", P: "PAP",
    Q: "QUE", R: "ROM", S: "SIE", T: "TAN", U: "UNI", V: "VIC", W: "WHI", X: "X-R",
    Y: "YAN", Z: "ZUL"
}

const formatRunwayInUse = (text: string) => {
    const regex = /\b(?:RNP|RNP Z|ILS)?\s*RWY\s+(\d{2}[LCR]?)\s+IN USE\b/gi;
    return text.replace(regex, (match, runway) => {
        return `<span style="font-size: 18px; font-weight: bold;">RWY ${runway}</span>`;
    });
}

const extractWind = (text: string) => {
    const windPatterns = [
        /WIND (\d{3}\/\d{2,3}KT\s+VRB BTN \d{3}\/ AND \d{3}\/)/,  // WIND {wind_dir}/{wind_spd}KT VRB BTN {wind_vmin}/ AND {wind_vmax}/
        /WIND (\d{3}\/\d{2,3}KT(?:\s+MAX \d+)?)/,                 // WIND {wind_dir}/{wind_spd}KT [MAX {wind_gust}]
        /WIND (VRB \d{2,3}KT(?:\s+MAX \d+)?)/,                    // WIND VRB {wind_spd}KT [MAX {wind_gust}]
        /WIND (CALM)/                                             // WIND CALM
    ];

    for (const pattern of windPatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return "";
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
        return `VIS ${directions.map(dir => `${dir.slice(-1)} ${formatVisibility(dir.slice(0, 4))}`).join(' ')}`
    }

    return `VIS ${visData}`
}

const extractWeatherConditions = (text: string) => {
    const visToCloudRegex = /VIS.*?(?=CLD)/s;
    const match = text.match(visToCloudRegex);
    
    if (!match) return "";

    const conditionText = match[0];
    const conditionRegex = /(RE)?(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS){1,3}/g;
    const conditions = [];

    let conditionMatch;
    while ((conditionMatch = conditionRegex.exec(conditionText)) !== null) {
        let condition = '';
        
        // Recent
        if (conditionMatch[1]) {
            condition += conditionMatch[1];
        }

        // Intensity or proximity
        if (conditionMatch[2]) {
            condition += conditionMatch[2];
        }

        // Descriptor
        if (conditionMatch[3]) {
            condition += conditionMatch[3];
        }

        // Precipitation, Obscuration, or Other (up to 3)
        if (conditionMatch[4]) {
            condition += conditionMatch[4];
        }

        conditions.push(condition);
    }

    if (conditionText.includes('NSW')) {
        conditions.push('NSW');
    }

    return conditions.join(' ');
}
const extractClouds = (text: string) => {
    const cloudRegex = /(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?/g;
    const vvRegex = /VV(\d{3}|\/{3})/;
    const specialCloudRegex = /\b(NSC|NCD|CLR|SKC)\b/;
    const cldRegex = /CLD/;

    let clouds = [];
    let match;
    let vertVisibility = '';
    let specialCloud = '';

    // Extract cloud layers
    while ((match = cloudRegex.exec(text)) !== null) {
        const cloudType = match[1];
        const heightInHundreds = parseInt(match[2]);
        const heightInFeet = heightInHundreds * 100;
        const convectiveCloud = match[3] ? `${match[3]} ` : '';
        clouds.push(`${cloudType} ${convectiveCloud}${heightInFeet}FT`);
    }

    // Extract vertical visibility
    const vvMatch = text.match(vvRegex);
    if (vvMatch) {
        if (vvMatch[1] === '///') {
            vertVisibility = 'VERT VIS ///';
        } else {
            const vvHeight = parseInt(vvMatch[1]) * 100;
            vertVisibility = `VERT VIS ${vvHeight}FT`;
        }
    }

    // Extract special cloud conditions
    const specialCloudMatch = text.match(specialCloudRegex);
    if (specialCloudMatch) {
        specialCloud = specialCloudMatch[1];
    }

    // Combine cloud information
    if (clouds.length > 0) {
        return `CLD ${clouds.join(' ')}${vertVisibility ? ' ' + vertVisibility : ''}`;
    }

    if (vertVisibility) {
        return `CLD ${vertVisibility}`;
    }

    if (specialCloud) {
        return `CLD ${specialCloud}`;
    }

    // Check for lone "CLD" without other data
    if (text.match(cldRegex) && !clouds.length && !vertVisibility && !specialCloud) {
        return '';
    }

    return '';
}

const extractTemperature = (text: string) => {
    const match = text.match(/T(\d{2})\//)
    if (match) {
        return `T${match[1]}`
    }
    return ''
}

const extractDewpoint = (text: string) => {
    const match = text.match(/\/DP(\d{2})/)
    if (match) {
        return `DP${match[1]}`
    }
    return ''
}

const formatAtisText = (text: string) => {
    if (!text) return ""

    // Remove all line breaks from the input text
    text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

    const extractInfo = (regex: RegExp, defaultValue: string = "") => {
        const match = text.match(regex)
        return match ? match[1] : defaultValue
    }

    const extractOther = (text: string) => {
        const match = text.match(/IN USE\.([\s\S]*?)TRL/i)
        return match ? match[1].trim() : ""
    }

    const icao = extractInfo(/^(ES[A-Z]{2})/)
    const time = extractInfo(/TIME (\d{4})Z/, "")
    const atisLetter = extractInfo(/ATIS ([A-Z])/)
    const atisCode = atisLetters[atisLetter as keyof typeof atisLetters] || ""
    const runway = extractInfo(/RWY\s+(\d{2}[LCR]?)/)
    const date = extractInfo(/(\d{6}Z)/)
    const wind = extractWind(text)
    const vis = extractVisibility(text)
    const conditions = extractWeatherConditions(text)
    const clouds = extractClouds(text)
    const temperature = extractTemperature(text)
    const dewpoint = extractDewpoint(text)
    const qnh = extractInfo(/QNH\s+(\d{4})\s+HPA/)
    const trl = extractInfo(/TRL\s+(\d+)/)
    const other = extractOther(text)

    const currentDate = moment.utc()
    const formattedDate = currentDate.format("YYMMDD")
    const formattedTime = `${currentDate.format("DD")}${time}`

    return `
${icao.padEnd(15)} <span style="font-size: 16px; font-weight: bold;">${atisCode}</span>${" ".repeat(Math.max(0, 5 - atisCode.length))} ${formattedDate}
RWY ${runway.padEnd(7)}MET REPORT  <b>${formattedTime}Z</b>
WIND ${wind}

${vis}

${conditions}

${clouds}
${temperature.padEnd(9)}${dewpoint}
QNH <div style="display: inline-block; font-size: 20px; font-weight: bold; margin-top: 7px">${qnh.split('').join(' ')}</div> HPA   TRL ${trl}

${other}
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

watch([
    time,
    () => atis.value?.text,  // This covers the entire ATIS text, including atisLetter, atisCode, runway, etc.
    () => localAtis.value?.text
], (newValues, oldValues) => {
    if (firstUpdate.value) {
        firstUpdate.value = false
        return
    }
    changed.value = false
    if (!settings.metreportFlash) return
    for (let i = 0; i < newValues.length; i++) {
        if (oldValues[i] && oldValues[i].length > 0 && JSON.stringify(newValues[i]) !== JSON.stringify(oldValues[i])) {
            changed.value = true
            break
        }
    }
    if (changed.value) {
        changeTimeouts.splice(0)
        changeTimeouts.push(setTimeout(() => (changed.value = false), 1000))
        changeTimeouts.push(setTimeout(() => (changed.value = true), 2000))
        changeTimeouts.push(
            setTimeout(() => {
                changed.value = false
                changedLong.value = true
            }, 3000)
        )
        changeTimeouts.push(
            setTimeout(() => {
                changed.value = false
                changedLong.value = false
            }, 63000)
        )
    }
})

watch(() => settings.enableLocalAtis, (newValue) => {
    if (!newValue) {
        localAtisInput.value = ""
        localAtis.value = null
    }
})

onMounted(() => {
    if (!vatsim.data.general) vatsim.fetchData()
})

</script>

<style scoped>
.atis.flash {
    background-color: #33f;
    color: #ddd;
    transition: background-color 0.5s, color 0.5s;
}
.atis.flash-long {
    color: #33f;
    transition: color 0.5s;
}
</style>
