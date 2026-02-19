import { Pool } from "pg"

const pool = new Pool()

export async function testQuery() {
    const client = await pool.connect()
    try {
        return (await client.query("SELECT NOW() as foo")).rows[0].foo
    } finally {
        await client.release()
    }
}

export async function upsertUserAtLogin(cid: number, name: string, division: string, subdivision: string) {
    const client = await pool.connect()
    try {
        await client.query(
            `INSERT INTO useraccount (cid, name, division, subdivision, lastlogin)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (cid) DO UPDATE SET name = $2, division = $3, subdivision = $4, lastlogin = NOW()`,
            [cid, name, division, subdivision]
        )
    } finally {
        await client.release()
    }
}

export async function upsertUserData(cid: number, key: string, data: object) {
    const client = await pool.connect()
    try {
        await client.query(
            `INSERT INTO userdata (cid, key, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (cid, key) DO UPDATE SET data = $3`,
            [cid, key, data]
        )
    } finally {
        await client.release()
    }
}

export async function getUserData(cid: number, key: string) {
    const client = await pool.connect()
    try {
        const result = await client.query(
            `SELECT data
             FROM userdata
             WHERE cid = $1 AND key = $2`,
            [cid, key]
        )
        return result.rows[0]?.data
    } finally {
        await client.release()
    }
}

export async function deleteUserData(cid: number, key: string) {
    const client = await pool.connect()
    try {
        await client.query(
            `DELETE FROM userdata
             WHERE cid = $1 AND key = $2`,
            [cid, key]
        )
    } finally {
        await client.release()
    }
}

export async function deleteAllUserData(cid: number) {
    const client = await pool.connect()
    try {
        await client.query(
            `DELETE FROM userdata
             WHERE cid = $1`,
            [cid]
        )
    } finally {
        await client.release()
    }
}

function todayUTC(): string {
    const d = new Date()
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

export async function getAupOverrides(fir: string): Promise<Record<string, boolean>> {
    try {
        const client = await pool.connect()
        try {
            const result = await client.query(
                `SELECT overrides, date FROM aup_overrides WHERE fir = $1`,
                [fir]
            )
            const row = result.rows[0]
            if (!row || row.date !== todayUTC()) return {}
            return (row.overrides as Record<string, boolean>) || {}
        } finally {
            await client.release()
        }
    } catch (e) {
        console.warn("[db] getAupOverrides failed (table may not exist):", (e as Error).message)
        return {}
    }
}

export async function setAupOverrides(
    fir: string,
    overrides: Record<string, boolean>
): Promise<void> {
    try {
        const client = await pool.connect()
        try {
            const date = todayUTC()
            await client.query(
                `INSERT INTO aup_overrides (fir, overrides, date, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (fir) DO UPDATE SET overrides = $2, date = $3, updated_at = NOW()`,
                [fir, JSON.stringify(overrides), date]
            )
        } finally {
            await client.release()
        }
    } catch (e) {
        console.warn("[db] setAupOverrides failed (table may not exist):", (e as Error).message)
        throw e
    }
}

export async function setAupOverride(fir: string, area: string, active: boolean): Promise<void> {
    const current = await getAupOverrides(fir)
    current[area] = active
    await setAupOverrides(fir, current)
}

export default {
    testQuery,
    upsertUserAtLogin,
    upsertUserData,
    getUserData,
    deleteUserData,
    deleteAllUserData,
    getAupOverrides,
    setAupOverrides,
    setAupOverride,
}
