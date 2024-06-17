import axios from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { computed, reactive, ref } from "vue"

interface Notam {
    inEffect: boolean,
    permanent: boolean,
    content: string,
    id?: string,
    from?: Date,
    to?: Date,
    reported?: Date
}

export const useNotamStore = defineStore("notam", () => {
    const originalText = ref("")
    const lastFetch = ref(undefined as Date | undefined)

    const header = ref("")
    const ad = reactive({} as { [key: string]: Notam[] })
    const enroute = reactive([] as Notam[])
    const nav = reactive([] as Notam[])
    const footer = ref("")

    const allText = computed(() => {
        if (typeof(lastFetch.value) === "undefined") fetch()
        return originalText.value.replace(/\s+CONTINUES ON NEXT PAGE/g, "").replace(/ISSUED:.*PAGE:.*/g, "").replace(/PAGE: 1.*\n/g, "")
    })

    function fetch() {
        lastFetch.value = new Date()
        axios.get(`https://api.vatiris.se/notam`).then((response) => {
            const el = document.createElement("div")
            el.innerHTML = response.data
            originalText.value = el.getElementsByTagName("pre")[0].innerText
            lastFetch.value = new Date()
            parse()
        })
    }

    function parse() {
        let section = "header"
        let icao = ""
        let currentNotam: Notam | undefined = undefined
        header.value = ""
        footer.value = ""

        function parseNotamLine(notam: Notam, line: string) {
            const m = line.match(/FROM: (.*?)\s+TO: (.*?)\s+(\w\w\/\w\w\w\w\w\/\d\d)/)
            const mrep = line.match(/REPORTED: (.*)/)
            if (m) {
                const from = moment.utc(m[1], "DD MMM YYYY HH:mm")
                if (from.isValid()) notam.from = from.toDate()
                else console.warn("invalid notam from", m[1])
                const to = moment.utc(m[2], "DD MMM YYYY HH:mm")
                if (to.isValid()) notam.to = to.toDate()
                else if (m[2] == "PERM") notam.permanent = true
                else console.warn("invalid notam to", m[2])
                notam.id = m[3]
            } else if (mrep) {
                const reported = moment.utc(mrep[1], "DD MMM YYYY HH:mm")
                if (reported.isValid()) notam.reported = reported.toDate()
                else console.warn("invalid notam reported", mrep[1])
            } else {
                notam.content += `\n${line}`
            }

        }

        for (let line of allText.value.split("\n")) {
            line = line.trimEnd()
            if (line.length == 0 && section != "header" && section != "footer") continue
            if (line.startsWith(">>>> ESAA")) section = "fir"
            else if (line.startsWith("AERODROMES") && section == "fir") section = "ad"
            else if (line.startsWith("EN-ROUTE") && section == "ad") section = "enroute"
            else if (line.startsWith("NAV WARNINGS") && section == "enroute") section = "nav"
            else if (section == "ad") {
                if (line.startsWith(">>> ")) {
                    icao = line.substring(4, 8)
                    ad[icao] = []
                    currentNotam = undefined
                } else if (icao) {
                    if (line.startsWith("- ") || line.startsWith("+ ")) {
                        currentNotam = { inEffect: line.startsWith("- "), permanent: false, content: line.substring(1).trimStart() }
                        ad[icao].push(currentNotam)
                    } else if (line == "NIL") {
                        currentNotam = undefined
                        icao = ""
                    } else if (currentNotam) {
                        parseNotamLine(currentNotam, line)
                        if (currentNotam.id) currentNotam = undefined // assume all notams end with id
                    } else {
                        console.warn("invalid notam ad line", line)
                    }
                } else {
                    console.warn("wat dis ad but no icao?", line)
                }
            } else if (section == "enroute") {
                if (line.startsWith("- ") || line.startsWith("+ ")) {
                    currentNotam = { inEffect: line.startsWith("- "), permanent: false, content: line.substring(1).trimStart() }
                    enroute.push(currentNotam)
                } else if (currentNotam) {
                    parseNotamLine(currentNotam, line)
                    if (currentNotam.id) currentNotam = undefined // assume all notams end with id
                } else {
                    console.warn("invalid notam enroute line", line)
                }
            } else if (section == "nav") {
                if (line.startsWith("- ") || line.startsWith("+ ")) {
                    currentNotam = { inEffect: line.startsWith("- "), permanent: false, content: line.substring(1).trimStart() }
                    nav.push(currentNotam)
                    if (currentNotam.content.includes(" IN SECTION ")) currentNotam = undefined // one-lin reference
                } else if (currentNotam) {
                    parseNotamLine(currentNotam, line)
                    if (currentNotam.id) currentNotam = undefined // assume all notams end with id
                } else {
                    // a wild footer appears
                    footer.value = line
                    section = "footer"
                }
            } else if (section == "header") {
                header.value += `${line}\n`
            } else if (section == "footer") {
                footer.value += `\n${line}`
            } else {
                console.warn("wat dis?", line)
            }
        }
        if (!footer.value.trimEnd().endsWith("END OF PIB")) console.warn("notam footer doesn't end with END OF PIB")
    }

    return {
        originalText,
        allText,
        lastFetch,
        header,
        ad,
        enroute,
        nav,
        footer,
        fetch
    }
})
