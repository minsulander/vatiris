import * as cheerio from "cheerio"
import fs from "fs"
import path from "path"
import URL from "url"

const eaipBaseUrl = `https://aro.lfv.se/content/eaip`

const aipData = { airports: [] } as any

export async function crawlAIP() {
    const aipUrl = await getAIP()
    console.log("AIP", aipUrl)
    const dataSourceUrl = await getDataSource(aipUrl)
    console.log("DataSource", dataSourceUrl)
    let data = {} as any
    const datajs = await loadData(dataSourceUrl)
    eval(datajs + "; data = DATASOURCE")
    const aipTab = data.tabs.find((tab: any) => tab.title == "AIP")
    const aipContents = aipTab.contents["en-GB"]
    const adPart = aipContents.menu.find((menu: any) => menu.title.includes("AERODROME"))?.children
    const ads = adPart.find((ad: any) => ad.title.includes("AD 2 Aerodromes"))?.children
    for (const ad of ads) {
        let name = ad.title.replace(/^AD 2 /, "")
        const icao = name.slice(0, 4)
        name = name.substring(5).trim()
        const adUrl = URL.resolve(aipUrl, `./eAIP/${ad.href}`)

        console.log(icao, name)

        const adData = {
            icao,
            name,
            url: adUrl,
            documents: [] as any[],
        }

        let count = 1

        // Text document - url by convention...
        adData.documents.push({
            prefix: adData.icao + `-${count++}`, // TODO doc nr according to AIP
            name: "Text",
            url: URL.resolve(aipUrl, `documents/PDF/ES-AD 2 ${icao} ${name} 1.pdf`),
        })

        const $ = await cheerio.fromURL(adUrl)
        for (const tr of $("tr").toArray()) {
            const a = $(tr).find("a[href]")
            const href = a.attr("href")
            if (a.length == 1 && href) {
                const url = URL.resolve(adUrl, href)
                if (!url.startsWith(eaipBaseUrl)) continue
                const name = $(tr)
                    .text()
                    .trim()
                    .replace(/^IAC - ICAO /, "")
                    .replace(" - ICAO", "")
                adData.documents.push({
                    prefix: adData.icao + `-${count++}`, // TODO doc nr according to AIP
                    name,
                    url,
                })
            }
        }
        aipData.airports.push(adData)
    }
    return aipData
}

async function getAIP() {
    const $ = await cheerio.fromURL(`${eaipBaseUrl}/default_offline.html`)
    const links = $("a")
    const aipLink = links.toArray().find((link) => $(link).attr("href")?.includes("AIRAC"))
    return `${eaipBaseUrl}/${$(aipLink).attr("href")}`
}

async function getDataSource(url: string) {
    const $ = await cheerio.fromURL(url)
    const scripts = $("script")
    const script = scripts.toArray().find((script) => $(script).attr("src")?.includes("datasource"))
    return URL.resolve(url, `${$(script).attr("src")}`)
}

async function loadData(url: string) {
    const response = await fetch(url)
    const text = await response.text()
    return text
}
