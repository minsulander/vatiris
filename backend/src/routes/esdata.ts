import { Router, Request, Response } from "express"

import auth from "../auth"
import moment from "moment"

const esdata = Router()

// just storing in memory for now...
const euroscopeData: {[key: string]: any} = {}

esdata.get("/", async (req: Request, res: Response) => {
    // const cid = await auth.requireCid(req, res)

    // clean up old data
    for (const key in euroscopeData) {
        const data = euroscopeData[key]
        if (data.timestamp) {
            const timestamp = moment(data.timestamp)
            if (moment().diff(timestamp, "hours") > 6) {
                delete euroscopeData[key]
            }
        }
    }

    res.send(euroscopeData)
})

esdata.get("/:key", async (req: Request, res: Response) => {
    // const cid = await auth.requireCid(req, res)
    if (req.params.key in euroscopeData) {
        res.send(euroscopeData[req.params.key])
    } else {
        res.status(404).send("Not found")
    }
})

esdata.post("/:key", async (req: Request, res: Response) => {
    // TODO some kind of auth but not oauth... could validate cid though
    console.log(`esdata for ${req.params.key}`, req.body)
    if (!(req.params.key in euroscopeData)) euroscopeData[req.params.key] = {}
    const data = euroscopeData[req.params.key]
    Object.assign(data, req.body)
    if (!("count" in data)) data.count = 0
    data.count++
    data.timestamp = moment().utc().toISOString()
    res.send(data)
})

esdata.delete("/:key", async (req: Request, res: Response) => {
    // TODO some kind of auth but not oauth... could validate cid though
    delete euroscopeData[req.params.key]
    res.send("ok")
})

export default esdata
