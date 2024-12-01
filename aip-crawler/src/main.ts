import * as cheerio from "cheerio"
import fs from "fs"
import path from "path"

const baseUrl = "https://aro.lfv.se"

async function main() {
    const aipUrl = await getAIP()
    console.log("AIP", aipUrl)
    const adUrl = await getAD(aipUrl)
    console.log("AD", adUrl)
    const ad2Url = await getAD2(adUrl)
    console.log("AD 2", ad2Url)
    const airports = (await getAirports(ad2Url)) as any[]
    for (const airport of airports) {
        console.log(airport.icao, airport.name)
        airport.documents = await getDocuments(airport.url, airport.icao)
    }
    const enrUrl = await getENR(aipUrl)
    console.log("ENR", enrUrl)
    const enr6Url = await getENR6(enrUrl)
    console.log("ENR 6", enr6Url)
    const enroute = await getDocuments(enr6Url, "ENR 6")
    console.log("Enroute documents")
    const fileName = path.join(__dirname, "..", "..", "frontend", "src", "data", "aip.json")
    fs.writeFileSync(fileName, JSON.stringify({ airports, enroute }, null, 2))
    return fileName
}

async function getAIP() {
    const $ = await cheerio.fromURL(`${baseUrl}/Editorial/View/IAIP`)
    const links = $("a.folder-link")
    const aipLink = links.toArray().find((link) => $(link).find(".folder-name").text() == "AIP")
    return `${baseUrl}/${$(aipLink).attr("href")}`
}

async function getAD(aipUrl: string) {
    const $ = await cheerio.fromURL(aipUrl)
    const links = $("a.folder-link")
    const adLink = links.toArray().find((link) => $(link).find(".folder-name").text() == "AD")
    return `${baseUrl}/${$(adLink).attr("href")}`
}

async function getAD2(adUrl: string) {
    const $ = await cheerio.fromURL(adUrl)
    const links = $("a.folder-link")
    const ad2Link = links.toArray().find((link) => $(link).find(".folder-prefix").text() == "AD 2")
    return `${baseUrl}/${$(ad2Link).attr("href")}`
}

async function getAirports(ad2Url: string) {
    const $ = await cheerio.fromURL(ad2Url)
    const airports = []
    const rows = $("tbody tr")
    for (const row of rows.toArray()) {
        const href = $(row).find("a").attr("href")
        const icao = $(row).find("td").first().text()
        const name = $(row).find("td").last().text()
        airports.push({ icao, name, url: `${baseUrl}/${href}` })
    }
    return airports
}

async function getENR(aipUrl: string) {
    const $ = await cheerio.fromURL(aipUrl)
    const links = $("a.folder-link")
    const adLink = links.toArray().find((link) => $(link).find(".folder-name").text() == "ENR")
    return `${baseUrl}/${$(adLink).attr("href")}`
}

async function getENR6(aipUrl: string) {
    const $ = await cheerio.fromURL(aipUrl)
    const links = $("a.folder-link")
    const adLink = links.toArray().find((link) => $(link).find(".folder-prefix").text() == "ENR 6")
    return `${baseUrl}/${$(adLink).attr("href")}`
}

async function getDocuments(url: string, filterPrefix: string = "") {
    const $ = await cheerio.fromURL(url)
    const documents = []
    const items = $(".document-item")
    for (const item of items.toArray()) {
        const href = $(item).find("a").attr("href")
        const prefix = $(item).find(".document-prefix").text()
        if (filterPrefix && !prefix.startsWith(filterPrefix)) continue
        const name = $(item).find(".document-name").text()
        documents.push({ prefix, name, url: `${baseUrl}/${href}` })
    }
    return documents
}

main().then((stuff) => {
    console.log(stuff)
})
