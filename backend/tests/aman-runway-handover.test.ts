import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import axios from 'axios'

// Invoke the real Express handlers without opening a listening socket.
test('original AMAN API: priority and acknowledged runway handover', async t => {
    let now = 100000
    const originalNow = Date.now, originalInterval = global.setInterval, originalAdapter = axios.defaults.adapter
    const timers: ReturnType<typeof setInterval>[] = []
    Date.now = () => now
    global.setInterval = ((...args: any[]) => { const timer = (originalInterval as any)(...args); timer.unref(); timers.push(timer); return timer }) as typeof setInterval
    axios.defaults.adapter = async config => ({data:{controllers:['ESOS_1_CTR','ESSA_FMP','ESSA_E_APP','ESSA_E__APP','ESSA_W_APP','ESMM_2_CTR','ESSA_TWR'].map(callsign=>({callsign,facility:5}))},status:200,statusText:'OK',headers:{},config})
    const oldKey = process.env.AMAN_SWEATBOX_KEY
    delete process.env.AMAN_SWEATBOX_KEY
    try {
        const {default: router} = await import('../src/routes/aman')
        async function call(method:string,path:string,body:any={},net='sweatbox1',icao='ESSA') {
            const layer = (router as any).stack.find((l:any)=>l.route?.path===path&&l.route.methods[method])
            assert.ok(layer,`${method} ${path}`)
            const res:any = new EventEmitter(); res.statusCode=200
            res.status=(n:number)=>{res.statusCode=n;return res};res.set=()=>res
            res.send=(value:any)=>{res.body=value;res.writableEnded=true;return res}
            await layer.route.stack[0].handle({params:{net,icao},body},res)
            assert.equal(res.writableEnded,true,'use immediate polls in this suite')
            return {status:res.statusCode,body:res.body}
        }
        const poll=(callsign:string,priority=false,net='sweatbox1',version='1.3.34')=>call('post','/:net/:icao/poll',{callsign,role:'',...(priority?{sequencerPolicy:'essa-priority-1',engineVersion:version}:{})},net)
        const cmd=(callsign:string,extra:any={})=>call('post','/:net/:icao/command',{callsign,cmd:{op:'plan'},takeSequencer:true,...extra})
        const pub=(callsign:string,extra:any={})=>call('put','/:net/:icao',{callsign,sequence:{data:{icao:'ESSA'},sequence:[],marker:now},...extra})
        const leave=(callsign:string)=>call('post','/:net/:icao/leave',{callsign})
        async function reset(){for(const c of ['ESSA_E_APP','ESSA_E__APP','ESSA_FMP','ESOS_1_CTR','ESSA_W_APP'])await leave(c);now+=100000}

        await t.test('capabilities are additive and old callers retain first-owner behavior',async()=>{
            assert.deepEqual((await call('get','/capabilities')).body,{runwayHandover:1,essaPriority:1})
            assert.equal((await poll('ESOS_1_CTR')).body.role,'sequencer')
            assert.equal((await poll('ESSA_E_APP')).body.role,'editor')
            assert.equal((await pub('ESOS_1_CTR')).status,200)
        })
        await t.test('E APP immediately supersedes FMP, which supersedes centre; peer polling cannot churn owner',async()=>{
            await reset();await poll('ESOS_1_CTR',true);await pub('ESOS_1_CTR')
            assert.equal((await poll('ESSA_FMP',true)).body.role,'sequencer')
            assert.equal((await poll('ESSA_E_APP',true)).body.role,'sequencer')
            assert.equal((await poll('ESSA_FMP',true)).body.sequencer,'ESSA_E_APP')
            assert.equal((await pub('ESSA_FMP')).status,409)
            const owner=await poll('ESSA_E_APP',true)
            assert.ok(owner.body.handover);assert.ok(owner.body.sequence)
            assert.equal(owner.body.sequencerVersion,'1.3.34')
        })
        await t.test('runway Apply by FMP succeeds without displacing E APP',async()=>{
            const c=(await cmd('ESSA_FMP')).body.id
            assert.equal((await poll('ESSA_FMP',true)).body.role,'editor')
            await pub('ESSA_E_APP',{cmdAck:c,results:[{id:c,from:'ESSA_FMP',ok:true}]})
            assert.equal((await poll('ESSA_FMP',true)).body.sequencer,'ESSA_E_APP')
        })
        await t.test('handover stores the accepted plan atomically and fences the previous writer',async()=>{
            await reset();await poll('ESOS_1_CTR');await pub('ESOS_1_CTR')
            const before=(await poll('ESSA_W_APP')).body.version,c=(await cmd('ESSA_W_APP')).body.id
            assert.equal((await poll('ESSA_W_APP')).body.role,'editor')
            assert.equal((await pub('ESOS_1_CTR',{cmdAck:c,results:[{id:c,from:'ESSA_W_APP',ok:true}],expectedVersion:before})).status,200)
            const taken=(await poll('ESSA_W_APP')).body
            assert.equal(taken.role,'sequencer');assert.equal(taken.handover.callsign,'ESSA_W_APP');assert.equal(taken.sequence.marker,now)
            assert.equal((await pub('ESOS_1_CTR')).status,409)
            assert.equal((await pub('ESSA_W_APP',{expectedVersion:before})).status,409)
        })
        await t.test('failure, missing ack, wrong sender and expired commands never transfer ownership',async()=>{
            for(const kind of ['failure','no-ack','wrong-sender','expired']){
                await reset();await poll('ESOS_1_CTR');const c=(await cmd('ESSA_W_APP')).body.id
                if(kind==='expired'){now+=61000;await poll('ESOS_1_CTR')}
                await pub('ESOS_1_CTR',{cmdAck:kind==='no-ack'?0:c,results:[{id:c,from:kind==='wrong-sender'?'ESSA_FMP':'ESSA_W_APP',ok:kind!=='failure'}]})
                assert.equal((await poll('ESSA_W_APP')).body.sequencer,'ESOS_1_CTR',kind)
            }
        })
        await t.test('latest acknowledged command wins regardless of result array order; replay cannot transfer',async()=>{
            await reset();await poll('ESOS_1_CTR')
            const a=(await cmd('ESSA_W_APP')).body.id,b=(await cmd('ESSA_FMP')).body.id
            const results=[{id:b,from:'ESSA_FMP',ok:true},{id:a,from:'ESSA_W_APP',ok:true}]
            await pub('ESOS_1_CTR',{cmdAck:b,results})
            assert.equal((await poll('ESSA_FMP')).body.role,'sequencer')
            await pub('ESSA_FMP',{cmdAck:b,results})
            assert.equal((await poll('ESSA_W_APP')).body.sequencer,'ESSA_FMP')
        })
        await t.test('departing or silent coordinator falls back to FMP and preserves confirmed plan',async()=>{
            await reset();await poll('ESSA_FMP',true);await poll('ESSA_E_APP',true);await pub('ESSA_E_APP')
            await leave('ESSA_E_APP');assert.equal((await poll('ESSA_FMP',true)).body.role,'sequencer')
            await poll('ESSA_E_APP',true);await pub('ESSA_E_APP');now+=9000
            const fallback=(await poll('ESSA_FMP',true)).body
            assert.equal(fallback.role,'sequencer');assert.ok(fallback.handover);assert.ok(fallback.sequence)
        })
        await t.test('handover spelling normalizes; TWR, ESMM and invalid options cannot claim policy',async()=>{
            await reset();await poll('ESSA_FMP',true)
            assert.equal((await poll('ESSA_E__APP',true)).body.role,'sequencer')
            for(const c of ['ESSA_TWR','ESMM_2_CTR']){
                assert.equal((await cmd(c)).status,403)
                assert.equal((await poll(c,true)).status,403)
            }
            assert.equal((await cmd('ESSA_FMP',{takeSequencer:'true'})).status,400)
            assert.equal((await call('post','/:net/:icao/command',{callsign:'ESSA_FMP',cmd:{op:'plan'},takeSequencer:true},'sweatbox1','ESSB')).status,403)
        })
        await t.test('existing live callsign and training-key authorization still applies',async()=>{
            assert.equal((await poll('UNKNOWN_APP',true,'live')).status,403)
            assert.equal((await poll('ESSA_E_APP',true,'live')).status,200)
            process.env.AMAN_SWEATBOX_KEY='test-only-key'
            assert.equal((await poll('ESSA_E_APP',true)).status,403)
            assert.equal((await call('post','/:net/:icao/poll',{callsign:'ESSA_E_APP',role:'',key:'test-only-key'})).status,200)
        })
    } finally {
        Date.now=originalNow;global.setInterval=originalInterval;axios.defaults.adapter=originalAdapter
        for(const timer of timers)clearInterval(timer)
        if(oldKey===undefined)delete process.env.AMAN_SWEATBOX_KEY;else process.env.AMAN_SWEATBOX_KEY=oldKey
    }
})
