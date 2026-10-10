import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateTiming } from './server.mjs'
import { createBridge } from './server.mjs'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import path from 'node:path'
const now = 1800000000000
const flight = { callsign: 'SAS1015', runway: '19R', eta: now + 600000, sta: now + 720000 }
test('assigned zero, gain and lose remain authoritative even when raw ETA differs', () => {
    for(const deltaSeconds of [0,-120,180]){
        const data=validateTiming({airport:'ESSA',generatedAt:now,flights:[{...flight,deltaSeconds}]},now)
        assert.equal(data.flights[0].deltaSeconds,deltaSeconds)
    }
    assert.throws(()=>validateTiming({airport:'ESSA',generatedAt:now,flights:[{...flight,deltaSeconds:86401}]},now))
})
test('TTG is negative STA minus ETA', () => {
    assert.equal(validateTiming({ airport: 'ESSA', generatedAt: now, flights: [{ ...flight, sta: flight.eta - 30000 }] }, now).flights[0].deltaSeconds, -30)
})
test('stale data, duplicate callsigns and invalid runways are rejected', () => {
    assert.throws(() => validateTiming({ airport: 'ESSA', generatedAt: now - 11000, flights: [flight] }, now))
    assert.throws(() => validateTiming({ airport: 'ESSA', generatedAt: now, flights: [flight, flight] }, now))
    assert.throws(() => validateTiming({ airport: 'ESSA', generatedAt: now, flights: [{ ...flight, runway: '30' }] }, now))
})
test('empty snapshots clear all published tag values', () => {
    assert.deepEqual(validateTiming({ airport: 'ESSA', generatedAt: now, flights: [] }, now).flights, [])
})
test('bridge request handler validates origin, persists native instructions and clears stale sequence', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(process.cwd(), '.maestro-bridge-test-'))
    const output = path.join(directory, 'MAESTROTiming.json')
    const server = createBridge(output)
    try {
        // Exercise the actual HTTP handler without requiring a network sandbox exception.
        server.address=()=>({port:17777})
        const handler=server.listeners('request')[0]
        async function request(url,method='GET',origin,body){
            let status=200,payload=''
            const req={url,method,headers:{host:'127.0.0.1:17777',origin,'content-type':'application/json'},resume(){},
                async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}}
            const res={setHeader(){},writeHead(code){status=code;return this},end(text){payload=text??'';return this}}
            await handler(req,res)
            return {status,json:async()=>JSON.parse(payload)}
        }
        const send=(origin,body)=>request('/timing','PUT',origin,body)
        const timestamp = Date.now()
        const body = { airport: 'ESSA', generatedAt: timestamp, flights: [{ ...flight, eta: timestamp + 600000, sta: timestamp + 660000 }] }
        assert.equal((await send('https://unexpected.example', body)).status, 403)
        assert.equal((await send('http://localhost:5173', body)).status, 204)
        const stored = JSON.parse(await readFile(output, 'utf8'))
        assert.equal(stored.flights[0].deltaSeconds, 60)
        assert.equal((await send('http://localhost:5173', { ...body, generatedAt: timestamp - 20000 })).status, 400)
        assert.equal(JSON.parse(await readFile(output, 'utf8')).flights.length, 1)
        assert.equal((await send('http://localhost:5173', { ...body, flights: [] })).status, 204)
        assert.equal(JSON.parse(await readFile(output, 'utf8')).flights.length, 0)
        const nativeSequence = { data: {icao:'ESSA',timestamp:Math.round(Date.now()/1000),source:'ESSA_C_APP'},
            wind:{},airports:[],runways:[],feeders:[],sequence:[{callsign:'SAS1015',ades:'ESSA',ttlttg_ff:999}] }
        assert.equal((await send('http://localhost:5173',{...body,nativeSequence})).status,204)
        const nativeUrl = '/MAESTRO_sequence_data_ESSA.json'
        const native = await (await request(nativeUrl)).json()
        assert.equal(native.sequence[0].ttlttg_ff,60)
        assert.equal(JSON.parse(await readFile(output,'utf8')).nativeSequence.sequence[0].ttlttg_ff,60)
        assert.equal((await send('http://localhost:5173',{...body,flights:[],nativeSequence:null})).status,204)
        assert.equal((await (await request(nativeUrl)).json()).sequence.length,0)
    } finally {
        await unlink(output).catch(() => {})
        await unlink(`${output}.tmp`).catch(() => {})
        await rmdir(directory)
    }
})
