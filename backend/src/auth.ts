import { Request, Response } from "express"
import axios from "axios"

const vatsimAuthBaseUri = process.env.VATSIM_AUTH_BASE_URI || "https://auth-dev.vatsim.net/"

const tokenCidCache = {} as { [key: string]: number }

export async function requireCid(req: Request, res: Response) {
    if (!req.headers.authorization?.startsWith("Bearer ")) {
        res.status(401).send("Unauthorized")
        return undefined
    }
    const token = req.headers.authorization.slice(7)
    if (tokenCidCache[token]) {
        return tokenCidCache[token]
    } else {
        const user = await requireUser(req, res)
        return user.cid
    }
}

export async function requireUser(req: Request, res: Response) {
    const user = await getUser(req)
    if (!user) {
        res.status(401).send("Unauthorized")
        return undefined
    }
    return user
}

export async function getUser(req: Request) {
    if (!req.headers.authorization?.startsWith("Bearer ")) {
        console.warn("No Bearer token in Authorization header")
        return undefined
    }
    const token = req.headers.authorization.slice(7)
    const result = await axios.get(`${vatsimAuthBaseUri}api/user`, { headers: { Authorization: `Bearer ${token}` } })
    const user = result.data.data
    tokenCidCache[token] = user.cid
    return user
}

export default {
    requireCid,
    requireUser,
    getUser,
}
