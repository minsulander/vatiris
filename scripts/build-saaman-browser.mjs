import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

// Pin a reviewed SAAMAN commit; never deploy a moving branch or tag.
export const SAAMAN_REF='d6fd8236254c7522379e763bed85e795f974b8a3'
export function buildSaamanBrowser({frontend=fileURLToPath(new URL('../frontend',import.meta.url)),ref=SAAMAN_REF,run}={}){
 if(!/^[a-f0-9]{40}$/.test(ref))throw Error('Set SAAMAN_REF to the reviewed 40-character SAAMAN commit')
 const npm=process.env.npm_execpath
 if(!npm&&!run)throw Error('Run this helper through npm run build:saaman')
 const tempRoot=path.resolve(os.tmpdir()),checkout=fs.mkdtempSync(path.join(tempRoot,'saaman-browser-'))
 const execute=(command,args,cwd=checkout)=>{
  const result=run?run(command,args,cwd):spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024})
  if(result.error||result.status!==0)throw Error(`SAAMAN browser build failed: ${command}\n${result.error?.message||result.stderr||result.stdout||''}`)
  return String(result.stdout||'').trim()
 }
 try{
  execute('git',['init','--quiet'])
  execute('git',['fetch','--quiet','--depth=1','https://github.com/Kaskobiii/SAAMAN.git',ref])
  execute('git',['checkout','--quiet','--detach','FETCH_HEAD'])
  if(execute('git',['rev-parse','HEAD'])!==ref)throw Error('SAAMAN checkout does not match the pinned commit')
  const ui=path.join(checkout,'source','ui')
  execute(process.execPath,[npm||'npm-cli.js','ci','--no-audit','--no-fund'],ui)
  execute(process.execPath,[npm||'npm-cli.js','run','build:web'],ui)
  const source=path.join(ui,'dist-browser'),dist=path.resolve(frontend,'dist'),target=path.join(dist,'aman')
  if(!fs.statSync(path.join(source,'index.html')).isFile())throw Error('SAAMAN browser build has no index.html')
  if(!fs.statSync(path.join(source,'assets')).isDirectory())throw Error('SAAMAN browser build has no assets directory')
  if(fs.realpathSync(dist)!==dist||path.dirname(target)!==dist)throw Error('Unsafe SAAMAN output directory')
  fs.rmSync(target,{recursive:true,force:true})
  fs.cpSync(source,target,{recursive:true})
 }finally{
  if(path.dirname(path.resolve(checkout))!==tempRoot||!path.basename(checkout).startsWith('saaman-browser-'))throw Error('Unsafe SAAMAN temporary directory')
  fs.rmSync(checkout,{recursive:true,force:true})
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildSaamanBrowser()
