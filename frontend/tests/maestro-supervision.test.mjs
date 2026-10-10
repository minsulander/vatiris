import {test} from 'node:test'
import assert from 'node:assert/strict'
import {observeSnapshot} from '../src/maestro-supervision.ts'
const flight={callsign:'SAS1015',state:1,mode:'sequenced',delay:0,sta:100000,order:0,ff:'ELTOK',passedFeeder:false,predictionSource:'star-distance',issue:''}
const packet=(flights,time=1000,source='LIVE')=>({timestamp:time,source,flights})
test('records actual promotion, instruction, slot and feeder changes without altering snapshots',()=>{
    const before=packet([flight]),after=packet([{...flight,state:2,delay:120,sta:220000,passedFeeder:true}],2000)
    const saved=JSON.stringify([before,after]),events=observeSnapshot(before,after)
    assert.deepEqual(events.map(e=>e.kind),['State','Instruction','Landing slot','Feeder'])
    assert.match(events[0].detail,/STABLE → SUPERSTABLE/)
    assert.equal(JSON.stringify([before,after]),saved)
})
test('repeated snapshots do not duplicate events; removed aircraft are recorded',()=>{
    assert.deepEqual(observeSnapshot(packet([flight]),packet([{...flight}],2000)),[])
    assert.equal(observeSnapshot(packet([flight]),packet([],2000))[0].kind,'Removed')
})
test('a source switch observes new flights rather than inventing state changes',()=>{
    assert.deepEqual(observeSnapshot(packet([flight]),packet([{...flight,state:3}],2000,'DEMO')).map(e=>e.kind),['Observed'])
    assert.deepEqual(observeSnapshot(packet([flight],2000),packet([],1000)),[])
})
