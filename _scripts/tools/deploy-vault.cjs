#!/usr/bin/env node
// One-way deploy of the committed framework from this repo into another vault.
//
//   node _scripts/tools/deploy-vault.cjs <target-vault>           # dry run
//   node _scripts/tools/deploy-vault.cjs <target-vault> --apply   # write
//
// Only files committed at HEAD are copied, so a target vault receives exactly what is public.
// The target never gets a .git directory or a remote, and nothing is ever copied back.
// A manifest in the target records each deployed file's hash. A target-side edit (drift)
// stops the deploy and lists the files; port the change to this repo deliberately instead.
// Plugin binaries (main.js, manifest.json, styles.css) are refreshed for plugins the target
// enables. Plugin data.json and other per-vault settings are never copied.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const SHARED=['_obsidian_architecture/','_scripts/','_templates/','categories.md',
  '.obsidian/snippets/','.obsidian/appearance.json','.obsidian/types.json','.obsidian/backlink.json',
  '.obsidian/page-preview.json','.obsidian/graph.json','.obsidian/templates.json','.obsidian/daily-notes.json',
  '.obsidian/plugins/omnisearch/data.json'];
const PLUGIN_FILES=['main.js','manifest.json','styles.css'];
const MANIFEST='.obsidian/obsidian-config.manifest';

const source=path.resolve(__dirname,'../..');
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const targetArg=args.find(a=>!a.startsWith('--'));
if(!targetArg) fail('Usage: deploy-vault.cjs <target-vault> [--apply]');
const target=path.resolve(targetArg.replace(/^~(?=$|\/)/,process.env.HOME));
if(target===source) fail('Target is the source vault.');
if(!fs.existsSync(path.join(target,'.obsidian'))) fail(`Not an Obsidian vault: ${target}`);
if(fs.existsSync(path.join(target,'.git'))) fail('Target vault has a .git directory; deployed vaults must not be repositories.');

const git=(...a)=>execFileSync('git',['-C',source,...a],{maxBuffer:1<<28});
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const head=git('rev-parse','--short','HEAD').toString().trim();
const tracked=git('ls-tree','-r','-z','--name-only','HEAD').toString().split('\0').filter(Boolean)
  .filter(p=>SHARED.some(s=>s.endsWith('/')?p.startsWith(s):p===s));
const dirty=git('status','--porcelain','--',...SHARED.filter(s=>fs.existsSync(path.join(source,s)))).toString().trim();
if(dirty) console.warn(`Uncommitted framework changes are not deployed (HEAD ${head}):\n${dirty}\n`);

const desired=new Map(tracked.map(p=>[p,git('show',`HEAD:${p}`)]));
const previous=readManifest();
const drift=[], conflicts=[], writes=[], deletes=[];
for(const [p,buf] of desired) {
  const current=read(p);
  if(current&&sha(current)===sha(buf)) continue;
  if(current&&previous.has(p)&&sha(current)!==previous.get(p)) drift.push(p);
  else if(current&&!previous.has(p)) conflicts.push(p);
  else writes.push(p);
}
for(const [p,hash] of previous) {
  if(desired.has(p)) continue;
  const current=read(p);
  if(!current) continue;
  if(sha(current)!==hash) drift.push(p); else deletes.push(p);
}
const plugins=pluginUpdates();

if(drift.length||conflicts.length) {
  if(drift.length) console.error(`Edited in the target since the last deploy:\n  ${drift.join('\n  ')}`);
  if(conflicts.length) console.error(`Exist in the target but were never deployed:\n  ${conflicts.join('\n  ')}`);
  fail('Resolve these first: port wanted changes to the source repo, then delete or restore the target files.');
}
report('write',writes);report('delete',deletes);report('plugin',plugins.map(x=>x.rel));
if(!apply) { console.log(`Dry run against ${target} at ${head}. Re-run with --apply.`); process.exit(0); }
for(const p of writes) { fs.mkdirSync(path.dirname(path.join(target,p)),{recursive:true}); fs.writeFileSync(path.join(target,p),desired.get(p)); }
for(const p of deletes) fs.rmSync(path.join(target,p));
for(const {from,rel} of plugins) { fs.mkdirSync(path.dirname(path.join(target,rel)),{recursive:true}); fs.copyFileSync(from,path.join(target,rel)); }
fs.writeFileSync(path.join(target,MANIFEST),`# obsidian-config ${head}\n`+[...desired].map(([p,buf])=>`${sha(buf)}  ${p}`).join('\n')+'\n');
console.log(`Deployed ${head} to ${target}.`);

function read(p) { try { return fs.readFileSync(path.join(target,p)); } catch { return null; } }
function readManifest() {
  const text=read(MANIFEST); if(!text) return new Map();
  return new Map(text.toString().split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(66),l.slice(0,64)]));
}
function pluginUpdates() {
  let enabled=[]; try { enabled=JSON.parse(read('.obsidian/community-plugins.json')||'[]'); } catch {}
  const out=[];
  for(const id of enabled) for(const file of PLUGIN_FILES) {
    const from=path.join(source,'.obsidian/plugins',id,file), rel=`.obsidian/plugins/${id}/${file}`;
    if(!fs.existsSync(from)) continue;
    const current=read(rel);
    if(!current||sha(current)!==sha(fs.readFileSync(from))) out.push({from,rel});
  }
  return out;
}
function report(verb,list) { for(const p of list) console.log(`${verb}  ${p}`); }
function fail(message) { console.error(message); process.exit(1); }
