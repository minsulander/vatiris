import {validateConfig,type EngineConfig} from './maestro-engine'
export const OPERATIONAL_KEYS=['active','departureRunway','rates','slots','pending','pendingRate','manualFlights'] as const
function canonical(value:any):any{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value}
export function sharedSettings(config:EngineConfig){return Object.fromEntries(Object.entries(validateConfig(config)).filter(([key])=>!(OPERATIONAL_KEYS as readonly string[]).includes(key)))}
export function settingsUnchanged(before:EngineConfig,after:EngineConfig){return JSON.stringify(canonical(sharedSettings(before)))===JSON.stringify(canonical(sharedSettings(after)))}
export function mergeSharedSettings(config:EngineConfig,settings:Record<string,unknown>):EngineConfig{
    if(!settings||Array.isArray(settings)||typeof settings!=='object')throw new Error('Invalid settings')
    const allowed=Object.keys(sharedSettings(config))
    if(Object.keys(settings).some(key=>!allowed.includes(key)))throw new Error('Only calculation and presentation settings can be changed here')
    return validateConfig({...config,...settings})
}
