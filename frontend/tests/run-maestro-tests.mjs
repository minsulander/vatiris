import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'

const directory=await mkdtemp(path.join(tmpdir(),'vatiris-maestro-'))
try {
    const tests=['maestro-engine','maestro-star-prediction'].map(name=>({source:fileURLToPath(new URL(`./${name}.test.mjs`,import.meta.url)),output:path.join(directory,`${name}.mjs`)}))
    await Promise.all(tests.map(test=>build({entryPoints:[test.source],bundle:true,platform:'node',format:'esm',outfile:test.output})))
    const exit=await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,['--test',...tests.map(test=>test.output)],{stdio:'inherit'})
        child.on('error',reject);child.on('exit',code=>resolve(code??1))
    })
    process.exitCode=exit
} finally {
    if(path.dirname(path.resolve(directory))!==path.resolve(tmpdir())||!path.basename(directory).startsWith('vatiris-maestro-'))throw new Error('Unexpected test output directory')
    await rm(directory,{recursive:true,force:true})
}
