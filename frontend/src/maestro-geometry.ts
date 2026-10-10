// Dubins length equations adapted from PythonRobotics (MIT), Atsushi Sakai
// and contributors. See AMAN-THIRD-PARTY-NOTICES.txt in the repository root.
export interface GeoPoint { latitude: number; longitude: number }
export interface RunwayGeometry extends GeoPoint { heading: number }
const tau = 2 * Math.PI
const mod = (v: number) => ((v % tau) + tau) % tau
const rad = (v: number) => v * Math.PI / 180
export function localPosition(point: GeoPoint, origin: GeoPoint) {
    return { x: (point.longitude-origin.longitude)*60*Math.cos(rad(origin.latitude)), y: (point.latitude-origin.latitude)*60 }
}
export function finalPosition(point: GeoPoint, runway: RunwayGeometry) {
    const {x,y}=localPosition(point,runway), h=rad(runway.heading)
    return { along: -(x*Math.sin(h)+y*Math.cos(h)), cross: x*Math.cos(h)-y*Math.sin(h) }
}
export function headingDifference(a: number,b: number) { return Math.abs(((a-b+540)%360)-180) }
export function dubinsLength(dx:number,dy:number,startYaw:number,endYaw:number,radius:number) {
    const direction=Math.atan2(dy,dx), a=mod(startYaw-direction), b=mod(endYaw-direction)
    const d=Math.hypot(dx,dy)/radius, sa=Math.sin(a),sb=Math.sin(b),ca=Math.cos(a),cb=Math.cos(b),cab=Math.cos(a-b)
    const costs:number[]=[]
    let p2=2+d*d-2*cab+2*d*(sa-sb), t=Math.atan2(cb-ca,d+sa-sb)
    if(p2>=-1e-10)costs.push(mod(-a+t)+Math.sqrt(Math.max(0,p2))+mod(b-t))
    p2=2+d*d-2*cab+2*d*(sb-sa);t=Math.atan2(ca-cb,d-sa+sb)
    if(p2>=-1e-10)costs.push(mod(a-t)+Math.sqrt(Math.max(0,p2))+mod(-b+t))
    p2=-2+d*d+2*cab+2*d*(sa+sb)
    if(p2>=0){const p=Math.sqrt(p2);t=Math.atan2(-ca-cb,d+sa+sb)-Math.atan2(-2,p);costs.push(mod(-a+t)+p+mod(-b+t))}
    p2=d*d-2+2*cab-2*d*(sa+sb)
    if(p2>=0){const p=Math.sqrt(p2);t=Math.atan2(ca+cb,d-sa-sb)-Math.atan2(2,p);costs.push(mod(a-t)+p+mod(b-t))}
    let v=(6-d*d+2*cab+2*d*(sa-sb))/8
    if(Math.abs(v)<=1){const p=mod(tau-Math.acos(v));t=mod(a-Math.atan2(ca-cb,d-sa+sb)+p/2);costs.push(t+p+mod(a-b-t+p))}
    v=(6-d*d+2*cab+2*d*(-sa+sb))/8
    if(Math.abs(v)<=1){const p=mod(tau-Math.acos(v));t=mod(-a-Math.atan2(ca-cb,d+sa-sb)+p/2);costs.push(t+p+mod(b-a-t+p))}
    return Math.min(...costs)*radius
}
// Independent replacement model: horizontal bounded-turn path to a configured
// final intercept, then straight final. This is not Juha's recovered algorithm.
export function vectoringDistance(point:GeoPoint,heading:number,runway:RunwayGeometry,finalLength:number,groundspeed:number) {
    const relative=localPosition(point,runway), approach=finalPosition(point,runway), h=rad(runway.heading)
    const yaw=Math.PI/2-rad(heading), finalYaw=Math.PI/2-h
    if(approach.along>=0 && Math.abs(approach.cross)<.25 && headingDifference(heading,runway.heading)<15)
        return {turnNm:0,finalNm:approach.along}
    const speed=Math.max(100,groundspeed), radius=Math.max(.3,(speed*.514444)**2/(9.80665*Math.tan(rad(25)))/1852)
    const gx=-finalLength*Math.sin(h),gy=-finalLength*Math.cos(h)
    return {turnNm:dubinsLength(gx-relative.x,gy-relative.y,yaw,finalYaw,radius),finalNm:finalLength}
}
export function vectoringSeconds(point:GeoPoint,heading:number,runway:RunwayGeometry,finalLength:number,groundspeed:number,finalGroundspeed:number) {
    const path=vectoringDistance(point,heading,runway,finalLength,groundspeed)
    return path.turnNm/Math.max(100,groundspeed)*3600+path.finalNm/Math.max(50,finalGroundspeed)*3600
}
export function bearingBetween(a:GeoPoint,b:GeoPoint){
    const lat1=a.latitude*Math.PI/180,lat2=b.latitude*Math.PI/180,d=(b.longitude-a.longitude)*Math.PI/180
    return (Math.atan2(Math.sin(d)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(d))*180/Math.PI+360)%360
}
