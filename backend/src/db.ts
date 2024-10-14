import { Client } from "pg"

export async function testQuery() {
    const client = new Client()
    await client.connect()
    try {
        return (await client.query("SELECT NOW() as foo")).rows[0].foo
    } finally {
        await client.end()
    }
}

export async function upsertUserAtLogin(cid: number, name: string, division: string, subdivision: string) {
    const client = new Client()
    await client.connect()
    try {
        await client.query(
            `INSERT INTO useraccount (cid, name, division, subdivision, lastlogin)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (cid) DO UPDATE SET name = $2, division = $3, subdivision = $4, lastlogin = NOW()`,
            [cid, name, division, subdivision]
        )
    } finally {
        await client.end()
    }
}

export async function upsertUserData(cid: number, key: string, data: object) {
    const client = new Client()
    await client.connect()
    try {
        await client.query(
            `INSERT INTO userdata (cid, key, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (cid, key) DO UPDATE SET data = $3`,
            [cid, key, data]
        )
    } finally {
        await client.end()
    }
}

export async function getUserData(cid: number, key: string) {
    const client = new Client()
    await client.connect()
    try {
        const result = await client.query(
            `SELECT data
             FROM userdata
             WHERE cid = $1 AND key = $2`,
            [cid, key]
        )
        return result.rows[0]?.data
    } finally {
        await client.end()
    }
}

export async function deleteUserData(cid: number, key: string) {
    const client = new Client()
    await client.connect()
    try {
        await client.query(
            `DELETE FROM userdata
             WHERE cid = $1 AND key = $2`,
            [cid, key]
        )
    } finally {
        await client.end()
    }
}

export async function deleteAllUserData(cid: number) {
    const client = new Client()
    await client.connect()
    try {
        await client.query(
            `DELETE FROM userdata
             WHERE cid = $1`,
            [cid]
        )
    } finally {
        await client.end()
    }
}

export default {
    testQuery,
    upsertUserAtLogin,
    upsertUserData,
    getUserData,
    deleteUserData,
    deleteAllUserData,
}
