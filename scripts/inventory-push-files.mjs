import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const files=[],symlinks=[],errors=[];
function walk(directory){
  let entries;
  try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{errors.push(path.relative(root,directory).replaceAll('\\','/'));return;}
  for(const entry of entries){
    const absolute=path.join(directory,entry.name),relative=path.relative(root,absolute).replaceAll('\\','/');
    if(entry.isSymbolicLink()){symlinks.push(relative);continue;}
    if(entry.isDirectory()){if(relative!=='.git')walk(absolute);continue;}
    if(!entry.isFile())continue;
    try{files.push({file:relative,bytes:fs.statSync(absolute).size});}catch{errors.push(relative);}
  }
}
walk(root);
const git=args=>{const result=spawnSync('git',args,{maxBuffer:32*1024*1024});if(result.status!==0)throw new Error(`Inventory Git read failed (${result.error?.code || result.status}).`);return result.stdout.toString('utf8').split('\0').filter(Boolean);};
const ignored=new Set(git(['ls-files','--others','--ignored','--exclude-standard','-z']));
const candidates=new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']));
const staged=git(['diff','--cached','--name-only','-z']);
const ignoredTracked=git(['ls-files','--cached','--ignored','--exclude-standard','-z']);
const groups={};for(const {file} of files){const group=file.includes('/')?file.split('/')[0]:'root files';groups[group]=(groups[group] || 0)+1;}
const candidateFiles=files.filter(({file})=>candidates.has(file));
const reviewFiles=candidateFiles.filter(({file,bytes})=>bytes>5*1024*1024 || /\.(?:zip|7z|rar|tar|gz|bak|backup|sqlite3?|db|dump|csv|xlsx?|pem|key|p12|pfx|jks|keystore)$/i.test(file) || /(?:credentials|service.account|firebase.adminsdk|id_rsa|id_ed25519)/i.test(file));
const ignoredFiles=files.filter(({file})=>ignored.has(file)).length;
const report={totalFilesOutsideGit:files.length,groups,ignoredFiles,ignoredGitPaths:ignored.size,eligibleFiles:candidateFiles.length,stagedFiles:staged,ignoredTracked,reviewFiles,symlinks,unreadablePaths:errors,largestEligibleFiles:[...candidateFiles].sort((a,b)=>b.bytes-a.bytes).slice(0,12),privateEnvFiles:files.filter(({file})=>/(^|\/)\.env(?!\.example$)/.test(file)).map(({file})=>({file,ignored:ignored.has(file),eligible:candidates.has(file)}))};
fs.mkdirSync('.audit',{recursive:true});fs.writeFileSync('.audit/push-inventory.json',JSON.stringify(report,null,2));
fs.writeFileSync('.audit/push-candidate-files.txt',[...candidates].sort().join('\n')+'\n');
console.log(JSON.stringify(report));
if(errors.length || ignoredTracked.length || reviewFiles.length || symlinks.some(file=>candidates.has(file)))process.exitCode=2;
