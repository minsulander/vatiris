// Displace labels only; their time anchors remain at the scheduled time.
// Lay out the whole queue before clipping it to the viewport. Scrolling then
// translates every label equally instead of repacking labels at the edges.
export function scrollingLabelPositions(items:{id:string;y:number;side:string}[],spacing=23,obstacles:{side:string;top:number;bottom:number}[]=[]) {
    if(!items.length)return {}
    const points=[...items.map(row=>row.y),...obstacles.flatMap(o=>[o.top,o.bottom])]
    const padding=spacing*(items.length+1)+30
    const top=Math.min(...points)-padding,bottom=Math.max(...points)+padding
    const positions=labelPositions(items.map(row=>({...row,y:row.y-top})),bottom-top,spacing,obstacles.map(o=>({...o,top:o.top-top,bottom:o.bottom-top})))
    return Object.fromEntries(Object.entries(positions).map(([id,y])=>[id,y+top]))
}
export function labelPositions(items:{id:string;y:number;side:string}[],height:number,spacing=23,obstacles:{side:string;top:number;bottom:number}[]=[]) {
    const result:Record<string,number>={}
    for(const side of new Set(items.map(i=>i.side))){
        const rows=items.filter(i=>i.side===side).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id))
        const blocked=obstacles.filter(o=>o.side===side&&o.bottom>0&&o.top<height).sort((a,b)=>a.top-b.top)
        if(blocked.length){
            const merged:{top:number;bottom:number}[]=[]
            for(const block of blocked){const last=merged.at(-1);if(last&&block.top<=last.bottom)last.bottom=Math.max(last.bottom,block.bottom);else merged.push({...block})}
            const bands:{top:number;bottom:number}[]=[];let start=0
            for(const block of merged){if(block.top>start)bands.push({top:start,bottom:Math.min(height,block.top)});start=Math.max(start,block.bottom)}
            if(start<height)bands.push({top:start,bottom:height})
            for(const band of bands){
                const assigned=rows.filter(row=>bands.reduce((best,b)=>{
                    const distance=(range:typeof b)=>Math.max(range.top-row.y,row.y-range.bottom,0)
                    return distance(b)<distance(best)?b:best
                },bands[0])===band)
                Object.assign(result,Object.fromEntries(Object.entries(labelPositions(assigned.map(row=>({...row,y:row.y-band.top})),band.bottom-band.top,spacing)).map(([id,y])=>[id,y+band.top])))
            }
            continue
        }
        let last=-spacing+10
        for(const row of rows){result[row.id]=Math.max(10,row.y,last+spacing);last=result[row.id]}
        let next=height-10+spacing
        for(const row of rows.slice().reverse()){result[row.id]=Math.min(result[row.id],next-spacing);
            for(const obstacle of obstacles.filter(o=>o.side===side).sort((a,b)=>b.top-a.top))
                if(result[row.id]+spacing/2>=obstacle.top && result[row.id]-spacing/2<=obstacle.bottom) result[row.id]=obstacle.top-spacing/2-1
            next=result[row.id]}
    }
    return result
}
