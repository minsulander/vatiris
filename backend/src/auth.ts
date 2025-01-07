import { Request, Response } from "express"
import axios from "axios"

const vatsimAuthBaseUri = process.env.VATSIM_AUTH_BASE_URI || "https://auth-dev.vatsim.net/"

const tokenCidCache = {} as { [key: string]: number }

export async function requireCid(req: Request, res: Response) {
    const token = getToken(req)
    if (!token) {
        res.status(401).send("Unauthorized")
        return undefined
    }
    if (tokenCidCache[token]) {
        return tokenCidCache[token]
    } else {
        const user = await requireUser(req, res)
        if (!user) return undefined
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
    const token = getToken(req)
    if (!token) return undefined
    const result = await axios.get(`${vatsimAuthBaseUri}api/user`, { headers: { Authorization: `Bearer ${token}` } })
    const user = result.data.data
    tokenCidCache[token] = user.cid
    return user
}

function getToken(req: Request) {
    let token = undefined
    if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.slice(7)
    } else if (req.query.token) {
        token = req.query.token as string
        if (token && token.endsWith(".pdf")) token = token.slice(0, -4)
        if (token == "undefined") token = undefined
    }
    return token
}

export default {
    requireCid,
    requireUser,
    getUser,
}
