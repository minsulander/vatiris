import { Router, Request, Response } from "express"

import auth from "../auth"
import db from "../db"

const data = Router()

data.get("/:key", async (req: Request, res: Response) => {
    try {
        const cid = await auth.requireCid(req, res)
        const data = await db.getUserData(cid, req.params.key)
        res.send(data)
    } catch (e) {
        console.error(e)
        res.status(500).send("failed")
    }
})

data.post("/:key", async (req: Request, res: Response) => {
    try {
        const cid = await auth.requireCid(req, res)
        console.log("Post data", cid, req.params.key)
        await db.upsertUserData(cid, req.params.key, req.body)
        res.send("ok")
    } catch (e) {
        console.error(e)
        res.status(500).send("failed")
    }
})

data.delete("/:key", async (req: Request, res: Response) => {
    try {
        const cid = await auth.requireCid(req, res)
        console.log("Delete data", cid, req.params.key)
        await db.deleteUserData(cid, req.params.key)
        res.send("ok")
    } catch (e) {
        console.error(e)
        res.status(500).send("failed")
    }
})

data.delete("/", async (req: Request, res: Response) => {
    try {
        const cid = await auth.requireCid(req, res)
        console.log("Delete all data", cid)
        await db.deleteAllUserData(cid)
        res.send("ok")
    } catch (e) {
        console.error(e)
        res.status(500).send("failed")
    }
})

export default data
