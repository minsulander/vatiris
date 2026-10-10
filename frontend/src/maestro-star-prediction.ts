import data from './data/essa-star-distances.json'
import {localPosition,headingDifference,bearingBetween,type GeoPoint,type RunwayGeometry} from './maestro-geometry'
import type {TelemetryFlight,EngineConfig,EngineFlight} from './maestro-engine'
export interface StarProfile {id:string;runway:string;feeder:string;procedure:string;kind:string;shortest:number|null;ese:number|null;vectors:number|null;sourceRange:string}
export const STAR_PROFILES=data.profiles as StarProfile[]
export const STAR_SOURCE=data.source
export const STAR_FEEDERS=data.feeders as Record<string,GeoPoint>
export const STAR_RUNWAYS=data.runways as Record<string,RunwayGeometry>
const navigation=data.navigation as Record<string,GeoPoint>
const rad=(v:number)=>v*Math.PI/180
const valid=(p:any):p is GeoPoint=>Number.isFinite(p?.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p?.longitude)&&Math.abs(p.longitude)<=180
export function distanceNm(a:GeoPoint,b:GeoPoint){
    const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude)
    const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2
    return 3440.065*2*Math.asin(Math.sqrt(Math.min(1,h)))
}
export function canonicalFeeder(point:{name:string;latitude?:number;longitude?:number}){
    if(point.name in STAR_FEEDERS)return point.name
    return valid(point)?Object.keys(STAR_FEEDERS).find(ff=>distanceNm(point,STAR_FEEDERS[ff])<.05):undefined
}
export function preFeederSeconds(distance:number,p:TelemetryFlight,config:EngineConfig){
    if(distance<=0)return 0
    const observed=Math.max(100,p.groundspeed),light=p.wake==='L',prop=/^(AT|DH8|DHC|SF|SB20)/.test(p.aircraft)
    const nearDeparture=valid(p)&&valid(p.route[0])&&distanceNm(p,p.route[0])<40&&p.altitude<20000
    const climbing=(p.verticalSpeed??0)>300||nearDeparture&&(p.verticalSpeed??0)>=-300
    const cruise=climbing?Math.max(observed,light?180:prop?300:config.starCruiseSpeed??450):observed
    const descent=Math.min(40,distance),available=Math.max(0,distance-descent)
    const climbMinutes=climbing?Math.max(0,(30000-p.altitude)/(config.starClimbRate??1800)):0
    const climbDistance=Math.min(available,(observed+cruise)/2*climbMinutes/60)
    const climb=climbDistance/Math.max(100,(observed+cruise)/2)*3600
    const level=(available-climbDistance)/cruise*3600
    const entryAltitude=Math.min(config.starEntryAltitude??18000,Math.max(150,p.altitude+(climbing?(config.starClimbRate??1800)*(climb+level)/60:0)))
    const approach=Math.min(p.assignedSpeed&&p.assignedSpeed>0?p.assignedSpeed:Infinity,light?180:prop?220:config.starApproachSpeed??250)
    const finalSpeed=iasToTas(approach,entryAltitude)
    const starting=available>0?cruise:observed
    return climb+level+descent/Math.max(100,(starting+finalSpeed)/2)*3600
}
export function iasToTas(ias:number,altitudeFeet:number){
    // ISA troposphere; IAS is treated as CAS (instrument error is unavailable).
    const temperature=1-.0065*Math.max(0,Math.min(30000,altitudeFeet))*.3048/288.15
    const pressure=temperature**5.25588,impact=(1+.2*(ias/661.4786)**2)**3.5-1
    return 661.4786*Math.sqrt(temperature)*Math.sqrt(5*((1+impact/pressure)**(2/7)-1))
}
export function starTravelSeconds(distance:number,altitude:number,heading:number,config:EngineConfig,assignedSpeed=0,wake='M'){
    if(distance<=0)return 0
    const finalNm=config.starFinalNm??10,baseNm=config.starBaseNm??20
    const light=wake==='L',finalIas=light?Math.min(110,config.landingSpeedKnots):config.landingSpeedKnots
    const cap=assignedSpeed>0?assignedSpeed:Infinity
    const headwind=config.surfaceWindDirection===0?0:config.surfaceWindSpeed*Math.cos(rad(config.surfaceWindDirection-heading))
    let seconds=0
    for(let remaining=distance;remaining>1e-7;){
        const step=Math.min(1,remaining),middle=remaining-step/2
        const ias=Math.min(cap,middle<=finalNm?finalIas:middle<=baseNm?(light?Math.min(150,config.starBaseSpeed??180):config.starBaseSpeed??180):(light?Math.min(180,config.starApproachSpeed??250):config.starApproachSpeed??250))
        const height=150+Math.max(0,altitude-150)*middle/distance
        seconds+=step/Math.max(60,iasToTas(ias,height)-headwind)*3600;remaining-=step
    }
    return Math.max(seconds,Math.max(0,altitude-150)/(config.starDescentRate??1800)*60)
}
type Point=GeoPoint&{name:string}
function cumulative(points:Point[]){const result=[0];for(let i=1;i<points.length;i++)result.push(result[i-1]+distanceNm(points[i-1],points[i]));return result}
function locate(points:Point[],position:GeoPoint){
    let best={index:0,t:0,distance:Infinity}
    for(let i=0;i<points.length-1;i++){
        const a=localPosition(position,points[i]),b=localPosition(points[i+1],points[i]),length=b.x*b.x+b.y*b.y
        if(length<1e-10)continue
        const t=Math.max(0,Math.min(1,(a.x*b.x+a.y*b.y)/length)),d=Math.hypot(a.x-b.x*t,a.y-b.y*t)
        if(d<best.distance)best={index:i,t,distance:d}
    }
    return best
}
export function matchStarProfile(p:TelemetryFlight,old?:EngineFlight){
    if(p.arrivalProfile)return STAR_PROFILES.find(row=>row.id===p.arrivalProfile&&row.runway===p.runway)
    const normalized=(p.star??'').toUpperCase().replace(/[^A-Z0-9]/g,'')
    const feeder=Object.keys(STAR_FEEDERS).find(ff=>normalized.startsWith(ff))??p.route.map(canonicalFeeder).find(Boolean)??(old?.passedFeeder?old.ff:undefined)
    const candidates=STAR_PROFILES.filter(row=>row.runway===p.runway&&row.feeder===feeder)
    return candidates.find(row=>row.kind==='star'&&row.procedure.replace(/[^A-Z0-9]/g,'')===normalized)??candidates.find(row=>row.kind==='star')
}
export function starPrediction(p:TelemetryFlight,config:EngineConfig,old?:EngineFlight){
    const profile=matchStarProfile(p,old),threshold=p.threshold??STAR_RUNWAYS[p.runway]
    if(!profile)return {seconds:0,error:'No workbook arrival profile matches the feeder and runway; select Arrival route'}
    if(!valid(p)||!valid(threshold))return {seconds:0,error:'No fresh aircraft position or runway threshold for STAR prediction'}
    if((p.positionAgeSeconds??0)>15)return {seconds:0,error:'Aircraft position is stale'}
    const method=profile.kind==='rnp'?'shortest':config.starDistanceMethod??'vectors'
    const total=profile[method]
    if(!Number.isFinite(total)||total!<=0)return {seconds:0,error:'The selected workbook distance is unavailable'}
    const feeder=p.route.find(point=>canonicalFeeder(point)===profile.feeder&&valid(point))??STAR_FEEDERS[profile.feeder]
    if(!valid(feeder))return {seconds:0,error:'Feeder coordinates are unavailable'}
    const route=p.route.filter(valid).map(point=>({...point,name:canonicalFeeder(point)??point.name})) as Point[]
    let ffIndex=route.findIndex(point=>point.name===profile.feeder)
    const namedThreshold=route.findIndex(point=>point.name===`SA${p.runway}`)
    let star=ffIndex>=0?route.slice(ffIndex,namedThreshold>ffIndex?namedThreshold+1:undefined):[]
    if(profile.kind==='rnp'){
        const name=profile.procedure.split(' ')[0],iaf=route.find(point=>point.name===name)??(navigation[name]?{...navigation[name],name}:undefined)
        if(!iaf)return {seconds:0,error:'The selected RNP approach has no IAF geometry'}
        star=[{...feeder,name:profile.feeder},iaf,{...threshold,name:`SA${p.runway}`}]
    }
    if(star.length<2)star=[{...feeder,name:profile.feeder},{...threshold,name:`SA${p.runway}`}]
    if(distanceNm(star.at(-1)!,threshold)>.1)star.push({...threshold,name:`SA${p.runway}`})
    const lengths=cumulative(star),full=lengths.at(-1)!
    if(full<.1)return {seconds:0,error:'STAR geometry has no usable length'}
    const checkpoints=[{at:0,remaining:total!},{at:full,remaining:0}]
    if(profile.kind==='rnp'&&star.length===3){
        const remaining=total!-lengths[1]
        if(remaining>0)checkpoints.splice(1,0,{at:lengths[1],remaining})
    }else{
        const anchors=data.trajectories.filter(row=>row.runway===p.runway&&row.method===method&&row.remainingNm<total!).map(row=>({...row,index:star.findIndex(point=>point.name===row.fix)})).filter(row=>row.index>0&&row.index<star.length-1).sort((a,b)=>b.index-a.index)
        if(anchors[0])checkpoints.splice(1,0,{at:lengths[anchors[0].index],remaining:anchors[0].remainingNm})
    }
    const remainingAt=(at:number)=>{
        const i=checkpoints.findIndex((point,index)=>index>0&&point.at>=at),upper=checkpoints[i<0?checkpoints.length-1:i],lower=checkpoints[Math.max(0,(i<0?checkpoints.length-1:i)-1)]
        return Math.max(0,lower.remaining+(upper.remaining-lower.remaining)*Math.min(1,Math.max(0,(at-lower.at)/Math.max(1e-9,upper.at-lower.at))))
    }
    const starLeg=locate(star,p),whole=route.length>1?locate(route,p):undefined
    const directIndex=p.direct?star.findIndex(point=>point.name===p.direct):-1
    const directBeforeIndex=p.direct&&ffIndex>=0?route.findIndex(point=>point.name===p.direct):-1
    const vector=localPosition(p,feeder),towards=localPosition(threshold,feeder)
    const oldPassed=!!old?.passedFeeder&&old.distanceProfile?.id===profile.id
    let passed=oldPassed||(ffIndex>=0&&whole?whole.index>=ffIndex:(vector.x*towards.x+vector.y*towards.y>0&&distanceNm(p,threshold)<distanceNm(feeder,threshold)))
    let before=0,remaining=total!,shortcut=false
    if(!passed){
        if(whole&&ffIndex>whole.index){
            before=distanceNm(p,route[whole.index+1]);for(let i=whole.index+1;i<ffIndex;i++)before+=distanceNm(route[i],route[i+1])
            if(directBeforeIndex>whole.index&&directBeforeIndex<=ffIndex){before=distanceNm(p,route[directBeforeIndex]);for(let i=directBeforeIndex;i<ffIndex;i++)before+=distanceNm(route[i],route[i+1]);shortcut=true}
        }else before=distanceNm(p,feeder)
    }
    if(directIndex>0){
        const toDirect=distanceNm(p,star[directIndex]),fromFeeder=distanceNm(feeder,star[directIndex])
        before=oldPassed?0:Math.max(0,toDirect-fromFeeder);passed=before<=.1
        remaining=(passed?toDirect:Math.min(toDirect,fromFeeder))+remainingAt(lengths[directIndex]);shortcut=true
    }else if(passed){
        const next=starLeg.index+1,ratio=(remainingAt(lengths[starLeg.index])-remainingAt(lengths[next]))/Math.max(.01,lengths[next]-lengths[starLeg.index])
        remaining=distanceNm(p,star[next])*ratio+remainingAt(lengths[next])
    }
    const preSeconds=preFeederSeconds(before,p,config)
    const climbing=(p.verticalSpeed??0)>300||valid(p.route[0])&&distanceNm(p,p.route[0])<40&&p.altitude<20000&&(p.verticalSpeed??0)>=-300
    const predictedAltitude=climbing?Math.min(config.starEntryAltitude??18000,p.altitude+(config.starClimbRate??1800)*preSeconds/60):Math.max(Math.min(p.altitude,config.starEntryAltitude??18000),p.altitude-(config.starDescentRate??1800)*preSeconds/60)
    const entryAltitude=passed?p.altitude:predictedAltitude
    const heading=passed?bearingBetween(p,star[Math.min(starLeg.index+1,star.length-1)]):bearingBetween(feeder,star[1])
    const starSeconds=starTravelSeconds(remaining,entryAltitude,heading,config,p.assignedSpeed,p.wake)
    return {seconds:preSeconds+starSeconds,feederSeconds:passed?-1:preSeconds,passedFeeder:passed,feeder:profile.feeder,
        distanceProfile:{id:profile.id,procedure:profile.procedure,runway:p.runway,method:profile.kind==='rnp'?'rnp':method,fullNm:total!,remainingNm:remaining,beforeFeederNm:before,sourceRange:profile.sourceRange,shortcut,workbookSha256:STAR_SOURCE.sha256},error:undefined}
}
