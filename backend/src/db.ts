import { Pool } from "pg"
import { DEFAULT_CONFIG, runEngine, validateLockedEdits, type Telemetry, type EngineConfig, type FlightEdit } from '../../frontend/src/maestro-engine'
import {settingsUnchanged,mergeSharedSettings} from '../../frontend/src/maestro-settings'

const pool = new Pool()

export async function getMaestroPlan() {
    const row = (await pool.query("SELECT * FROM maestro_plan WHERE airport = 'ESSA'")).rows[0]
    if (row) { row.engine_config ||= structuredClone(DEFAULT_CONFIG); row.engine_edits ||= {} }
    return row
}
export async function claimMaestroMaster(cid: number, release = false) {
    return (await pool.query(release ?
        `UPDATE maestro_plan SET master_cid=NULL, master_expires_at=NULL WHERE airport='ESSA' AND master_cid=$1 RETURNING *` :
        `UPDATE maestro_plan SET master_cid=$1, master_expires_at=NOW()+INTERVAL '30 seconds'
         WHERE airport='ESSA' AND (master_cid=$1 OR master_cid IS NULL OR master_expires_at<NOW()) RETURNING *`, [cid])).rows[0]
}
export async function processMaestroTelemetry(cid: number, telemetry: Telemetry) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const row = (await client.query("SELECT * FROM maestro_plan WHERE airport='ESSA' FOR UPDATE")).rows[0]
        if (!row || row.master_cid !== Number(cid) || new Date(row.master_expires_at).getTime() < Date.now()) {
            await client.query('ROLLBACK'); return undefined
        }
        const snapshot = runEngine(telemetry, row.engine_config || structuredClone(DEFAULT_CONFIG), row.engine_edits || {}, row.engine_snapshot || undefined)
        const result = (await client.query(`UPDATE maestro_plan SET telemetry=$1, engine_snapshot=$2,
            master_expires_at=NOW()+INTERVAL '30 seconds' WHERE airport='ESSA' RETURNING *`, [telemetry, snapshot])).rows[0]
        await client.query('COMMIT')
        return result
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
}
export async function saveMaestroEnginePlan(cid: number, revision: number, config: EngineConfig, edits: Record<string, FlightEdit>) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const row = (await client.query("SELECT * FROM maestro_plan WHERE airport='ESSA' FOR UPDATE")).rows[0]
        if (!row || row.master_cid !== Number(cid) || new Date(row.master_expires_at).getTime() < Date.now()) {
            await client.query('ROLLBACK'); return { error: 'master' }
        }
        if (row.revision !== revision) { await client.query('ROLLBACK'); return { error: 'revision' } }
        if(!settingsUnchanged(row.engine_config||structuredClone(DEFAULT_CONFIG),config)){await client.query('ROLLBACK');return {error:'Shared settings require supervisor access'}}
        try { validateLockedEdits(row.engine_snapshot,row.engine_edits || {},edits,config) }
        catch (error) { await client.query('ROLLBACK'); return { error: (error as Error).message } }
        // Re-run the same raw prediction on an edit, without adding elapsed time to its ETA.
        const old = row.engine_snapshot ? { ...row.engine_snapshot, timestamp: row.engine_snapshot.timestamp - 1 } : undefined
        const snapshot = row.telemetry ? runEngine(row.telemetry, config, edits, old) : null
        const result = (await client.query(`UPDATE maestro_plan SET engine_config=$1, engine_edits=$2, engine_snapshot=$3,
            revision=revision+1, updated_by=$4, updated_at=NOW() WHERE airport='ESSA' RETURNING *`, [config, edits, snapshot, cid])).rows[0]
        await client.query('COMMIT'); return { row: result }
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
}
export async function saveMaestroSettings(cid:number,revision:number,settings:Record<string,unknown>){
    const client=await pool.connect()
    try{
        await client.query('BEGIN')
        const row=(await client.query("SELECT * FROM maestro_plan WHERE airport='ESSA' FOR UPDATE")).rows[0]
        if(!row||row.revision!==revision){await client.query('ROLLBACK');return {error:'revision'}}
        let config:EngineConfig
        try{config=mergeSharedSettings(row.engine_config||structuredClone(DEFAULT_CONFIG),settings)}
        catch(error){await client.query('ROLLBACK');return {error:(error as Error).message}}
        const old=row.engine_snapshot?{...row.engine_snapshot,timestamp:row.engine_snapshot.timestamp-1}:undefined
        const next=row.telemetry?runEngine(row.telemetry,config,row.engine_edits||{},old):null
        const result=(await client.query(`UPDATE maestro_plan SET engine_config=$1,engine_snapshot=$2,
            revision=revision+1,updated_by=$3,updated_at=NOW() WHERE airport='ESSA' RETURNING *`,[config,next,cid])).rows[0]
        await client.query('COMMIT');return {row:result}
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
}
export async function updateMaestroPlan(revision: number, config: object, edits: object, cid: number) {
    return (await pool.query(`UPDATE maestro_plan SET config = $2, edits = $3, revision = revision + 1,
        updated_by = $4, updated_at = NOW() WHERE airport = 'ESSA' AND revision = $1 RETURNING *`,
        [revision, config, edits, cid])).rows[0]
}

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

export default {
    testQuery,
    upsertUserAtLogin,
    upsertUserData,
    getUserData,
    deleteUserData,
    deleteAllUserData,
}
