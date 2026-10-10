export function supervisorAllowed(cid:number,configured=process.env.MAESTRO_SUPERVISOR_CIDS??'1396125'){
    return Number.isInteger(cid)&&configured.split(',').map(v=>v.trim()).filter(Boolean).includes(String(cid))
}
