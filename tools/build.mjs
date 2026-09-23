import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validatePublic} from './validate-public.mjs';
import {enrichSeo} from './seo.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=path.join(root,'dist');
const files=JSON.parse(fs.readFileSync(path.join(root,'tools/public-files.json'),'utf8'));
// Validate source before replacing the previous build. Never change bank baselines.
const validation=spawnSync(process.execPath,[path.join(root,'tools/validate-site.mjs')],{cwd:root,stdio:'inherit'});
if(validation.status!==0)process.exit(1);
validatePublic(root,files);
for(const name of files){
  if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').includes('..')||path.isAbsolute(name))throw Error(`Invalid public path: ${name}`);
  const file=path.join(root,name);
  if(!fs.lstatSync(file).isFile()||fs.realpathSync(file)!==file)throw Error(`Public entry must be a regular file: ${name}`);
}
// The only recursive deletion target is the resolved project's dist directory.
if(path.dirname(output)!==root||path.basename(output)!=='dist'||(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink()))throw Error('Unsafe build target');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output);
for(const name of files){
  fs.mkdirSync(path.dirname(path.join(output,name)),{recursive:true});
  if(name.endsWith('.html'))fs.writeFileSync(path.join(output,name),enrichSeo(fs.readFileSync(path.join(root,name),'utf8'),name));
  else fs.copyFileSync(path.join(root,name),path.join(output,name));
}
validatePublic(output,files,true);
const built=spawnSync(process.execPath,[path.join(root,'tools/validate-site.mjs')],{cwd:output,stdio:'inherit'});
if(built.status!==0)process.exit(1);
console.log(`Built and verified ${files.length} public files in dist/`);
