import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, rename, readFile, stat } from 'node:fs/promises'

export function validateTiming(value, now = Date.now()) {
    if (value?.airport !== 'ESSA' || !Number.isFinite(value.generatedAt) ||
        Math.abs(now - value.generatedAt) > 10000 || !Array.isArray(value.flights) || value.flights.length > 500)
        throw new Error('Expected a fresh ESSA timing snapshot with at most 500 flights')
    const callsigns = new Set()
    const flights = value.flights.map(f => {
        if (typeof f.callsign !== 'string' || !/^[A-Z0-9_-]{2,16}$/.test(f.callsign) || callsigns.has(f.callsign) ||
            !['01L', '01R', '08', '19L', '19R', '26'].includes(f.runway) ||
            !Number.isFinite(f.eta) || !Number.isFinite(f.sta) || Math.abs(f.sta - now) > 86400000 || Math.abs(f.eta - now) > 86400000)
            throw new Error('Invalid or duplicate flight')
        callsigns.add(f.callsign)
        const deltaSeconds = f.deltaSeconds === undefined ? Math.round((f.sta-f.eta)/1000) : f.deltaSeconds
        if (!Number.isFinite(deltaSeconds) || Math.abs(deltaSeconds)>86400) throw new Error('Invalid instruction')
        return { callsign: f.callsign, runway: f.runway, eta: f.eta, sta: f.sta, deltaSeconds:Math.round(deltaSeconds) }
    })
    return { airport: 'ESSA', generatedAt: now, flights }
}

export function createBridge(output, extraOrigin) {
    const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173',
        'http://127.0.0.1:4173', 'https://vatiris.se', 'https://www.vatiris.se', ...(extraOrigin ? [extraOrigin] : [])])
    let writeQueue = Promise.resolve()
    let nativeSequence = null
    let nativeTemplate = null
    const server = http.createServer(async (req, res) => {
        const port = server.address()?.port
        if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) { res.writeHead(403).end(); return }
        const origin = req.headers.origin
        if (origin && !origins.has(origin)) { res.writeHead(403).end(); return }
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
        res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        res.setHeader('Access-Control-Allow-Private-Network', 'true')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
        if (req.url === '/MAESTRO_sequence_data_ESSA.json' && req.method === 'GET') {
            const fresh = nativeSequence && Math.abs(Date.now() / 1000 - nativeSequence.data.timestamp) <= 30
            if (!fresh && !nativeTemplate) { res.writeHead(503).end('No shared sequence received'); return }
            const data = fresh ? nativeSequence : { ...nativeTemplate, data: { ...nativeTemplate.data, source: 'STALE', timestamp: Math.round(Date.now()/1000) }, sequence: [] }
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)); return
        }
        if (req.url === '/health' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ service: 'vatiris-maestro-bridge', output })); return
        }
        if (req.url === '/telemetry' && req.method === 'GET') {
            try {
                const filename = path.join(path.dirname(output), 'MAESTROTelemetry.json')
                if ((await stat(filename)).size > 5 * 1024 * 1024) throw new Error('oversized')
                const data = JSON.parse(await readFile(filename, 'utf8'))
                if (!Number.isFinite(data.timestamp) || Math.abs(Date.now() - data.timestamp) > 30000) throw new Error('stale')
                res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
            } catch { res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'No fresh EuroScope predictions; load the updated VatIRIS.dll beside the timing file' })) }
            return
        }
        if (req.url !== '/timing' || req.method !== 'PUT') { res.writeHead(404).end(); return }
        if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415).end(); return }
        let size = 0
        const chunks = []
        try {
            for await (const chunk of req) {
                size += chunk.length
                if (size > 1048576) { res.writeHead(413).end(); req.resume(); return }
                chunks.push(chunk)
            }
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const snapshot = validateTiming(body)
            if (body.nativeSequence && (body.nativeSequence.data?.icao !== 'ESSA' ||
                !Number.isFinite(body.nativeSequence.data?.timestamp) || Math.abs(Date.now() / 1000 - body.nativeSequence.data.timestamp) > 30 ||
                !Array.isArray(body.nativeSequence.sequence) || body.nativeSequence.sequence.length > 1000)) throw new Error('Invalid native sequence')
            if (body.nativeSequence) {
                const instructions = new Map(snapshot.flights.map(f=>[f.callsign,f.deltaSeconds]))
                snapshot.nativeSequence = {...body.nativeSequence, sequence:body.nativeSequence.sequence.filter(f=>f.ades==='ESSA').map(f=>({...f,ttlttg_ff:instructions.get(f.callsign)??f.ttlttg_ff}))}
            }
            const job = writeQueue.then(async () => {
                await mkdir(path.dirname(output), { recursive: true })
                await writeFile(`${output}.tmp`, JSON.stringify(snapshot), 'utf8')
                await rename(`${output}.tmp`, output)
            })
            writeQueue = job.catch(() => {})
            await job
            nativeSequence = snapshot.nativeSequence || null
            if (nativeSequence) nativeTemplate = { ...nativeSequence, sequence: [] }
            res.writeHead(204).end()
        } catch (error) {
            const status = error instanceof SyntaxError || !error.code ? 400 : 500
            if (status === 500) console.error('MAESTRO timing file write failed:', error.code)
            res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: status === 500 ? 'Could not write timing file' : error.message }))
        }
    })
    server.requestTimeout = 5000
    server.headersTimeout = 5000
    return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const index = process.argv.indexOf('--output')
    if (index !== -1 && !process.argv[index + 1]) throw new Error('--output requires a filename')
    const output = path.resolve(index !== -1 ? process.argv[index + 1] : fileURLToPath(new URL('../MAESTROTiming.json', import.meta.url)))
    const server = createBridge(output, process.env.MAESTRO_ALLOWED_ORIGIN)
    server.on('error', error => { console.error(error.message); process.exitCode = 1 })
    server.listen(17777, '127.0.0.1', () => console.log(`MAESTRO bridge: http://127.0.0.1:17777 → ${output}`))
}
