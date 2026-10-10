import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DEFAULT_CONFIG,validateConfig} from '../src/maestro-engine.ts'
import {mergeSharedSettings,settingsUnchanged,sharedSettings} from '../src/maestro-settings.ts'
import {supervisorAllowed} from '../../backend/src/maestro-access.ts'
test('supervision is restricted to explicit CIDs, with an empty override denying everybody',()=>{
    assert.equal(supervisorAllowed(1396125,'1396125'),true)
    assert.equal(supervisorAllowed(1396126,'1396125'),false)
    assert.equal(supervisorAllowed(1396125,''),false)
    assert.equal(supervisorAllowed(1396126,'1396125, 1396126'),true)
})
test('supervisor changes preserve the operational plan while synchronizing display settings',()=>{
    const before=validateConfig(DEFAULT_CONFIG)
    const next=mergeSharedSettings(before,{starApproachSpeed:240,displayPreferences:{...before.displayPreferences,panels:{winds:true,rates:true,tracks:false}}})
    assert.deepEqual(next.active,before.active);assert.deepEqual(next.rates,before.rates);assert.deepEqual(next.slots,before.slots)
    assert.equal(next.starApproachSpeed,240);assert.equal(next.displayPreferences.panels.winds,true)
    assert.equal(settingsUnchanged(before,next),false)
    assert.throws(()=>mergeSharedSettings(before,{active:['ESSA/26']}),/Only calculation/)
    assert.throws(()=>mergeSharedSettings(before,{starApproachSpeed:500}),/Invalid STAR/)
})
test('ordinary MASTER edits may change rates and slots but cannot change phase, wind or presentation settings',()=>{
    const before=structuredClone(DEFAULT_CONFIG),next=structuredClone(before)
    next.rates['ESSA/19R']=130;next.slots=[{id:'gap',runway:'ESSA/19R',begin:1000,end:2000}]
    assert.equal(settingsUnchanged(before,next),true)
    for(const patch of [{frozenMinutes:3},{surfaceWindSpeed:20},{starDistanceMethod:'ese'},{displayPreferences:{labels:{type:true,feeder:false,totalDelay:false,currentDelay:true,runway:false},panels:{winds:false,rates:false,tracks:true}}}])assert.equal(settingsUnchanged(before,{...before,...patch}),false)
    assert.equal('rates' in sharedSettings(before),false)
    assert.throws(()=>validateConfig({...before,displayPreferences:{labels:{type:'yes'},panels:{}}}),/Invalid display/)
})
