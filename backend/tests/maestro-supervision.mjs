import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),frontend=path.resolve(backend,'../frontend')
const directory=await mkdtemp(path.join(tmpdir(),'vatiris-supervisor-')),bundle=path.join(directory,'backend.mjs')
const require=createRequire(path.join(backend,'package.json'))
globalThis.__testExpress=require('express')
globalThis.__testAuth={async requireCid(req,res){const cid=Number(req.headers['test-cid']);if(!cid){res.status(401).json({error:'Unauthorized'});return}return cid},async requireUser(req,res){const cid=await this.requireCid(req,res);return cid?{cid,vatsim:{rating:{id:3}}}:undefined}}
process.env.MAESTRO_SUPERVISOR_CIDS='1396125'
let row,reads=0,updates=0
globalThis.__testPg={async query(sql,args){
    if(sql.startsWith('SELECT')){reads++;return {rows:[structuredClone(row)]}}
    if(sql.startsWith('UPDATE maestro_plan SET engine_config=$1,engine_snapshot=$2')){updates++;row.engine_config=args[0];row.engine_snapshot=args[1];row.updated_by=args[2];row.revision++;return {rows:[structuredClone(row)]}}
    return {rows:[]}
},async connect(){return {...this,release(){}}}}
const {build}=createRequire(path.join(frontend,'package.json'))('esbuild')
await build({stdin:{contents:"export {default as router} from './src/routes/maestro';export {DEFAULT_CONFIG} from '../frontend/src/maestro-engine';",resolveDir:backend},bundle:true,platform:'node',format:'esm',outfile:bundle,plugins:[{name:'backend-test-boundaries',setup(b){
    b.onResolve({filter:/^(pg|express)$/},({path:p})=>({path:p,namespace:'stub'}))
    b.onResolve({filter:/^\.\.\/auth$/},()=>({path:'auth',namespace:'stub'}))
    b.onLoad({filter:/.*/,namespace:'stub'},({path:p})=>({contents:p==='pg'?'export class Pool {constructor(){return globalThis.__testPg}}':p==='express'?'export const Router=globalThis.__testExpress.Router':`export default globalThis.__testAuth`}))
}}]})
const {router,DEFAULT_CONFIG}=await import(pathToFileURL(bundle).href)
row={revision:3,engine_config:structuredClone(DEFAULT_CONFIG),engine_edits:{SAS1015:{order:0}},engine_snapshot:null,telemetry:null,master_cid:1396126,master_expires_at:new Date(Date.now()+60000)}
async function call(method,url,cid,body={}){
    const route=router.stack.find(layer=>layer.route?.path===url&&layer.route.methods[method.toLowerCase()])
    assert.ok(route,url)
    const res={code:200,headersSent:false,status(code){this.code=code;return this},setHeader(){},json(value){this.body=value;this.headersSent=true;return this},send(value){this.body=value;this.headersSent=true;return this}}
    await route.route.stack[0].handle({headers:{'test-cid':cid},body},res)
    return res
}
for(const cid of [undefined,1396126]){
    assert.equal((await call('GET','/ESSA/supervision',cid)).code,cid?403:401)
    assert.equal((await call('PUT','/ESSA/settings',cid,{revision:3,settings:{surfaceWindSpeed:20}})).code,cid?403:401)
}
assert.equal(reads,0,'unauthorized requests do not access supervisory data')
assert.equal(updates,0)
assert.equal((await call('GET','/ESSA/supervision',1396125)).code,200)
const bypass=await call('PUT','/ESSA',1396126,{revision:3,config:{...DEFAULT_CONFIG,surfaceWindSpeed:20},edits:row.engine_edits})
assert.equal(bypass.code,409);assert.match(bypass.body.error,/supervisor/)
assert.equal((await call('PUT','/ESSA/settings',1396125,{revision:3,settings:{surfaceWindSpeed:20}})).code,200)
assert.equal(row.engine_config.surfaceWindSpeed,20)
assert.equal(row.master_cid,1396126,'supervisory save does not take over MASTER')
assert.deepEqual(row.engine_edits,{SAS1015:{order:0}})
assert.equal((await call('PUT','/ESSA/settings',1396125,{revision:3,settings:{surfaceWindSpeed:15}})).code,409)
assert.equal(row.engine_config.surfaceWindSpeed,20)
console.log('Actual backend routes + plan transaction: CID gates, MASTER bypass rejection, independent supervisor save, preserved edits/lease and revision conflict passed')

if(path.dirname(path.resolve(directory))!==path.resolve(tmpdir())||!path.basename(directory).startsWith('vatiris-supervisor-'))throw new Error('Unexpected test directory')
await rm(directory,{recursive:true,force:true})
