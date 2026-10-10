import { Router, type Request, type Response } from 'express'
import auth from '../auth'
import { getMaestroPlan, claimMaestroMaster, processMaestroTelemetry, saveMaestroEnginePlan, saveMaestroSettings } from '../db'
import {supervisorAllowed} from '../maestro-access'
import { DEFAULT_CONFIG, validateConfig, validateEdits, validateTelemetry, toJuhaSequence } from '../../../frontend/src/maestro-engine'
const router = Router()
async function supervisor(req:Request,res:Response){
    const cid=await auth.requireCid(req,res);if(!cid)return undefined
    if(!supervisorAllowed(Number(cid))){res.status(403).json({error:'AMAN supervisor access required'});return undefined}
    return Number(cid)
}
async function editor(req: Request, res: Response) {
    const user = await auth.requireUser(req, res)
    if (!user) return undefined
    const rating = Number(user.vatsim?.rating?.id)
    const allowed = (process.env.MAESTRO_EDITOR_CIDS || '').split(',').map(v => v.trim()).filter(Boolean)
    if (!Number.isFinite(rating) || rating < 2 || (allowed.length && !allowed.includes(String(user.cid)))) {
        res.status(403).json({ error: 'Controller editing access required' }); return undefined
    }
    return Number(user.cid)
}
function snapshot(row: any) {
    const now = Date.now()
    return { revision: row.revision, config: row.engine_config || structuredClone(DEFAULT_CONFIG), edits: row.engine_edits || {},
        snapshot: row.engine_snapshot || null, masterCid: new Date(row.master_expires_at).getTime() > now ? row.master_cid : null,
        updatedBy: row.updated_by, updatedAt: row.updated_at, stale: !row.engine_snapshot || now - row.engine_snapshot.timestamp > 30000 }
}
router.get('/ESSA/supervision',async(req,res)=>{
    try{
        if(!await supervisor(req,res))return
        const row=await getMaestroPlan()
        if(!row){res.status(503).json({error:'Apply AMAN migrations 002 and 003'});return}
        res.setHeader('Cache-Control','no-store');res.json(snapshot(row))
    }catch{if(!res.headersSent)res.status(503).json({error:'Supervision unavailable'})}
})
router.put('/ESSA/settings',async(req,res)=>{
    try{
        const cid=await supervisor(req,res);if(!cid)return
        if(!Number.isInteger(req.body.revision)||req.body.revision<0){res.status(400).json({error:'Invalid revision'});return}
        const result=await saveMaestroSettings(cid,req.body.revision,req.body.settings)
        if(result.error){res.status(result.error==='revision'?409:400).json({error:result.error==='revision'?'Shared settings changed; reload and retry':result.error});return}
        res.json(snapshot(result.row))
    }catch{if(!res.headersSent)res.status(503).json({error:'Shared settings save failed'})}
})
router.get('/ESSA', async (req, res) => {
    try {
        if (!await auth.requireCid(req, res)) return
        const row = await getMaestroPlan()
        if (!row) { res.status(503).json({ error: 'Apply AMAN migrations 002 and 003' }); return }
        res.setHeader('Cache-Control', 'no-store'); res.json(snapshot(row))
    } catch { if (!res.headersSent) res.status(503).json({ error: 'Shared AMAN unavailable; check database migrations' }) }
})
// Documented public, read-only format consumed by TopSky's AMAN_URL.
// It contains virtual callsigns/timing, not user tokens, names or account data.
router.get('/MAESTRO_sequence_data_ESSA.json', async (req, res) => {
    try {
        const row = await getMaestroPlan()
        if (!row) { res.status(503).json({ error: 'Shared sequence unavailable' }); return }
        res.setHeader('Cache-Control', 'no-store')
        const fresh = row.engine_snapshot && Date.now() - row.engine_snapshot.timestamp <= 30000
        const state = fresh ? row.engine_snapshot : { timestamp: Date.now(), source: 'STALE', flights: [], diagnostics: [] }
        res.json(toJuhaSequence(state, row.engine_config || structuredClone(DEFAULT_CONFIG), row.engine_edits || {}))
    } catch { res.status(503).json({ error: 'Shared sequence unavailable' }) }
})
router.post('/ESSA/master', async (req, res) => {
    try {
        const cid = await editor(req, res); if (!cid) return
        const row = await claimMaestroMaster(cid, req.body.release === true)
        if (!row) { res.status(409).json({ error: 'Another controller owns MASTER' }); return }
        res.json(snapshot(row))
    } catch { if (!res.headersSent) res.status(503).json({ error: 'MASTER change failed' }) }
})
router.post('/ESSA/telemetry', async (req, res) => {
    try {
        const cid = await auth.requireCid(req, res); if (!cid) return
        let telemetry
        try { telemetry = validateTelemetry(req.body) }
        catch { res.status(400).json({ error: 'Stale or invalid EuroScope route predictions' }); return }
        const row = await processMaestroTelemetry(Number(cid), telemetry)
        if (!row) { res.status(409).json({ error: 'Acquire MASTER before sending predictions' }); return }
        res.json(snapshot(row))
    } catch { if (!res.headersSent) res.status(503).json({ error: 'Prediction processing failed' }) }
})
router.put('/ESSA', async (req, res) => {
    try {
        const cid = await editor(req, res); if (!cid) return
        let config, edits
        try {
            if (!Number.isInteger(req.body.revision) || req.body.revision < 0) throw new Error('revision')
            config = validateConfig(req.body.config); edits = validateEdits(req.body.edits)
        } catch { res.status(400).json({ error: 'Invalid AMAN plan' }); return }
        const result = await saveMaestroEnginePlan(cid, req.body.revision, config, edits)
        if (result.error) { res.status(409).json({ error: result.error === 'master' ? 'Only MASTER can edit' : result.error === 'revision' ? 'Plan changed; reload and retry' : result.error }); return }
        res.json(snapshot(result.row))
    } catch { if (!res.headersSent) res.status(503).json({ error: 'Plan save failed' }) }
})
export default router
