import "dotenv/config"
import express, { Request, Response } from "express"
import cors from "cors"
import bodyparser from "body-parser"
import db from "./db"
import auth from "./auth"

const vatsimAuthBaseUri = process.env.VATSIM_AUTH_BASE_URI || "https://auth-dev.vatsim.net/"
const clientId = process.env.CLIENT_ID || "682"
const clientSecret = process.env.CLIENT_SECRET || "cXrGCBzSezuc0Ud12bGgWdX45H5EjJgMDCvscKib"
const redirectUri = process.env.REDIRECT_URI || "http://localhost:5173/login"

const app = express()
const port = process.env.PORT || 5172

app.use(cors())
app.use(bodyparser.json())

app.listen(port, async () => {
    console.log(`Server running at http://localhost:${port}`)
    console.log("  Using VATSIM Auth Base URI:", vatsimAuthBaseUri)
    console.log("  Using Client ID:", clientId)
    console.log("  Using Redirect URI:", redirectUri)
    try {
        console.log("  DB Time:", await db.testQuery())
    } catch (e) {
        console.error(e)
    }
})

import axios from "axios"

app.get("/", async (req: Request, res: Response) => {
    res.redirect("https://vatiris.se/")
})

app.get("/token", async (req: Request, res: Response) => {
    try {
        const result = await axios.post(`${vatsimAuthBaseUri}oauth/token`, {
            grant_type: req.query.refresh_token ? "refresh_token" : "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: req.query.code,
            refresh_token: req.query.refresh_token,
        })
        res.send(result.data)
        console.log("Token")
    } catch (error: any) {
        console.log("Token error", error.response.data)
        res.status(error.response.status).json(error.response.data)
    }
})

app.post("/login", async (req: Request, res: Response) => {
    const user = await auth.requireUser(req, res)
    console.log("Login", user.cid, user.personal.name_full)
    await db.upsertUserAtLogin(user.cid, user.personal.name_full, user.vatsim.division.name, user.vatsim.subdivision.name)
    res.send("kthx")
})

import dataRoutes from "./routes/data"
app.use("/data", dataRoutes)

import wikiRoutes from "./routes/wiki"
app.use("/wiki", wikiRoutes)

import esdataRoutes from "./routes/esdata"
app.use("/esdata", esdataRoutes)

import eaipRoutes from "./routes/eaip"
app.use("/eaip", eaipRoutes)

app.use(express.static("public"))
app.get(/.*/, (req, res) => {
    res.status(404).send()
})
