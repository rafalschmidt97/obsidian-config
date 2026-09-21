const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function parse(text) {
  const match=/^---\n([\s\S]*?)\n---/.exec(text); if(!match) return {};
  try{return JSON.parse(match[1]);}catch{}
  const fm={}; for(const line of match[1].split('\n')) {
    const m=/^(\w+):\s*(.*)$/.exec(line);if(!m) continue;
    try{fm[m[1]]=JSON.parse(m[2]);}catch{fm[m[1]]=m[2];}
  } return fm;
}
function fixture(seeds=[],answers=[]) {
  const files=new Map(),opened=[],prompts=[];
  function folder(p) {
    if(files.has(p)) return files.get(p);
    const parent=p?folder(p.split('/').slice(0,-1).join('/')):null;
    const f={path:p,name:p.split('/').pop(),children:[],parent};files.set(p,f);parent?.children.push(f);return f;
  }
  function add(p,content='',fm=parse(content)) {
    const parent=folder(p.split('/').slice(0,-1).join('/'));
    const f={path:p,name:p.split('/').pop(),basename:p.split('/').pop().replace(/\.md$/,''),parent,content,fm};
    files.set(p,f);parent.children.push(f);return f;
  }
  folder('');folder('personal');folder('work');
  for(const dir of ['_scripts/shared','_scripts/quickadd','_scripts/templater','_templates']) {
    for(const file of fs.readdirSync(path.join(root,dir))) if(file.endsWith('.md')) add(`${dir}/${file}`,fs.readFileSync(path.join(root,dir,file),'utf8'));
  }
  add('_scripts/config/areas.example.json',fs.readFileSync(path.join(root,'_scripts/config/areas.example.json'),'utf8'));
  for(const seed of seeds) add(...seed);
  const app={
    vault:{getRoot:()=>files.get(''),getAbstractFileByPath:p=>files.get(p),getMarkdownFiles:()=>[...files.values()].filter(f=>f.path.endsWith('.md')),
      read:async f=>f.content,cachedRead:async f=>f.content,createFolder:async p=>folder(p),
      create:async(p,text)=>{assert.ok(!files.has(p),`Collision ${p}`);return add(p,text);},
      modify:async(f,text)=>{f.content=text;f.fm=parse(text);},
      delete:async f=>{files.delete(f.path);f.parent.children=f.parent.children.filter(x=>x!==f);}},
    metadataCache:{getFileCache:f=>({frontmatter:f.fm}),getFirstLinkpathDest:t=>[...files.values()].find(f=>f.basename===t)},
    workspace:{getLeaf:()=>({openFile:async f=>opened.push(f.path)}),openLinkText:async p=>opened.push(p)},
    fileManager:{
      processFrontMatter:async(f,fn)=>{const m=/^---\n[\s\S]*?\n---/.exec(f.content);const body=m?f.content.slice(m[0].length):'\n\n'+f.content;fn(f.fm);f.content=`---\n${JSON.stringify(f.fm)}\n---${body}`;},
      renameFile:async(f,p)=>{
        assert.ok(!files.has(p));const old=f.path;
        const children=[...files.values()].filter(c=>c.path.startsWith(old+'/'));
        files.delete(old);f.parent.children=f.parent.children.filter(x=>x!==f);f.parent=folder(p.split('/').slice(0,-1).join('/'));f.parent.children.push(f);
        f.path=p;f.name=p.split('/').pop();f.basename=f.name.replace(/\.md$/,'');files.set(p,f);
        for(const c of children){files.delete(c.path);c.path=p+c.path.slice(old.length);files.set(c.path,c);}
      }
    }
  };
  const dates={'YYYY-MM-DDTHH:mm':'2026-09-20T12:00','YYYY-MM-DD HH-mm':'2026-09-20 12-00','YYYY-MM-DD':'2026-09-20','YYYY-MM-DD HH-mm-ss':'2026-09-20 12-00-00'};
  const quickAddApi={date:{now:format=>dates[format]},
    suggester:async(labels,values,prompt)=>{prompts.push(prompt);const answer=answers.shift();if(answer==='CANCEL')throw new Error('Cancelled');const index=labels.indexOf(answer);assert.notEqual(index,-1,`Answer ${answer} for ${prompt}: ${labels}`);return values[index];},
    inputPrompt:async prompt=>{prompts.push(prompt);assert.ok(answers.length,`No answer: ${prompt}`);const answer=answers.shift();if(answer==='CANCEL')throw new Error('Cancelled');return answer;}};
  const load=relative=>{const context=vm.createContext({module:{exports:{}},console,setTimeout,clearTimeout});vm.runInContext(`(function(require,module,exports){${fs.readFileSync(path.join(root,relative),'utf8')}\n})(()=>undefined,module,module.exports)`,context);return context.module.exports;};
  const run=(flow)=>load('_scripts/quickadd/templates.md').entry({app,quickAddApi},{flow});
  async function templater(p) {
    const f=files.get(p);const tp={file:{content:f.content,title:f.basename,path:()=>p},date:quickAddApi.date,system:{prompt:quickAddApi.inputPrompt,suggester:(l,v,r,p)=>quickAddApi.suggester(l,v,p)}};
    const body=fs.readFileSync(path.join(root,'_scripts/templater/apply-templateq-folder-template.md'),'utf8').replace(/^<%\*\s*/,'').replace(/-%>\s*$/,'');
    await vm.runInNewContext(`(async()=>{${body}})()`,{app,tp,Notice:class{},console});
  }
  return {files,opened,prompts,app,quickAddApi,add,folder,load,run,templater};
}
const area=(org='personal',slug='health')=>[`${org}/areas/${slug}/${slug[0].toUpperCase()+slug.slice(1)}.md`,'About',{org,category:'area',status:'active'}];

test('meeting drafts and person occurrences use short profile links through both capture paths',async()=>{
  for(const category of ['meeting','person']) for(const mode of ['quickadd','folder']) {
    const name=category==='meeting'?'Planning':'Alex';
    const folder=`work/areas/${category==='meeting'?'meetings':'people'}/${name}`;
    const timing=category==='meeting'?'draft':'now';
    const answers=mode==='quickadd'?['work',timing,category==='meeting'?'Meeting':'Person',`${name} (${folder})`]:[timing];
    const f=fixture([[`${folder}/${name}.md`,'',{org:'work',category}]],answers);
    if(mode==='quickadd')await f.load('_scripts/quickadd/journal.md').entry(f);
    else {f.add(`${folder}/Untitled.md`);await f.templater(`${folder}/Untitled.md`);}
    const out=f.files.get(`${folder}/${timing==='draft'?'Draft':'2026-09-20 12-00'} ${name}.md`);
    assert.equal(category==='meeting'?out.fm.meeting:out.fm.attendees[0],`[[${name}]]`);
  }
});

test('duplicate profile names retain an exact target with a readable alias',async()=>{
  const f=fixture([
    ['work/areas/people/Alex/Alex.md','',{org:'work',category:'person'}],
    ['archive/former/areas/people/Alex/Alex.md','',{org:'former',category:'person'}],
  ],['work','now','Person','Alex (work/areas/people/Alex)']);
  await f.load('_scripts/quickadd/journal.md').entry(f);
  assert.equal(f.files.get('work/areas/people/Alex/2026-09-20 12-00 Alex.md').fm.attendees[0],
    '[[work/areas/people/Alex/Alex|Alex]]');
});

test('setup creates eight profiles idempotently without changing existing content',async()=>{
  const f=fixture();await f.run('setupAreas');const profiles=()=>[...f.files.values()].filter(x=>x.path.startsWith('personal/')&&x.fm?.category==='area');assert.equal(profiles().length,8);
  profiles()[0].content='User text';await f.run('setupAreas');assert.equal(profiles().length,8);assert.equal(profiles()[0].content,'User text');
});
test('area note and event share a folder; loose capture remains available',async()=>{
  const f=fixture([area()],['personal','Area','Health','Plan','personal','now','Area','Health','Visit','personal','Loose','Unsorted']);
  await f.run('note');await f.load('_scripts/quickadd/journal.md').entry(f);await f.run('note');
  assert.equal(f.files.get('personal/areas/health/Plan.md').fm.area,'[[personal/areas/health/Health]]');
  assert.equal(f.files.get('personal/areas/health/2026-09-20 12-00 Visit.md').fm.type,'event');
  assert.ok(f.files.has('personal/areas/loose/Unsorted.md'));
});
test('inline area creation waits for capture inputs, cancellation leaves no files',async()=>{
  for(const title of ['Plan','CANCEL']) {
    const f=fixture([],['work','Area','Create area…','Recruitment',title]);
    if(title==='CANCEL') {await assert.rejects(f.run('note'),/Cancelled/);assert.ok(!f.files.has('work/areas/recruitment'));}
    else {await f.run('note');assert.ok(f.files.has('work/areas/recruitment/Recruitment.md'));assert.ok(f.files.has('work/areas/recruitment/Plan.md'));}
  }
});
test('Sport title-only uses Health, Reflection is immediate and can be loose',async()=>{
  const f=fixture([area()],['Training','work','Loose','Thought']);
  const journal=f.load('_scripts/quickadd/journal.md');await journal.entry(f,{flow:'sport',draft:true});await journal.entry(f,{flow:'reflection',draft:true});
  assert.deepEqual(f.prompts,['title?','org?','area?','title?']);
  assert.match(f.files.get('personal/areas/health/2026-09-20 12-00 Training.md').content,/sport-history/);
  assert.equal(f.files.get('work/areas/journal/2026-09-20 12-00 Thought.md').fm.type,'reflection');
});
test('area event draft activation preserves body and capture time, excludes other areas',async()=>{
  const fm={org:'personal',category:'journal',type:'event',created:'2026-01-01T09:00',area:'[[personal/areas/health/Health]]',attendees:[]};
  const raw='---\n'+JSON.stringify(fm)+'\n---\n\nPreparation';
  const f=fixture([area(),['personal/areas/health/Draft Visit.md',raw,fm]],['personal','now','Area','Health','use draft: Draft Visit']);
  await f.load('_scripts/quickadd/journal.md').entry(f);
  const file=f.files.get('personal/areas/health/2026-09-20 12-00 Visit.md');assert.ok(file,JSON.stringify(f.opened));assert.equal(file.fm.drafted,'2026-01-01T09:00');assert.ok(file.content.endsWith('Preparation'));
});
test('context profiles inherit area; meeting and project disagreement is rejected',async()=>{
  const f=fixture([area('work','recruitment'),['work/projects/Hire/Hire.md','',{org:'work',category:'project',area:'[[work/areas/recruitment/Recruitment]]'}],
    ['work/projects/Hire/meetings/Review/Review.md','',{org:'work',category:'meeting',project:'[[work/projects/Hire/Hire]]'}]],
    ['work','now','Meeting','Review (work/projects/Hire/meetings/Review)']);
  await f.load('_scripts/quickadd/journal.md').entry(f);
  assert.equal(f.files.get('work/projects/Hire/meetings/Review/2026-09-20 12-00 Review.md').fm.area,'[[work/areas/recruitment/Recruitment]]');
  f.files.get('work/projects/Hire/meetings/Review/Review.md').fm.area='[[work/areas/health/Health]]';
  f.add(...area('work'));
  const s=await f.load('_scripts/shared/runtime.md').create(f.app);
  const a=await f.load('_scripts/shared/areas.md').create(f.app,s);
  assert.throws(()=>a.context(f.files.get('work/projects/Hire/meetings/Review/Review.md')),/different areas/);
});
test('folder click asks Note/Journal and infers area without invoice or attendee prompts',async()=>{
  for(const kind of ['Note','Journal']) {
    const f=fixture([area(),['personal/areas/health/Untitled.md','']],kind==='Note'?['Note','Record']:['Journal','now','Record']);
    await f.templater('personal/areas/health/Untitled.md');
    const out=f.files.get(`personal/areas/health/${kind==='Journal'?'2026-09-20 12-00 ':''}Record.md`);
    assert.equal(out.fm.area,'[[personal/areas/health/Health]]');assert.equal(out.fm.category,kind.toLowerCase());assert.ok(!f.files.has('personal/areas/health/Untitled.md'));
  }
});
test('entity folder-click and explicit team creation agree',async()=>{
  const a=fixture([],['work','Engineering']);await a.run('team');
  const b=fixture([['work/areas/teams/Untitled.md','']],['Engineering']);await b.templater('work/areas/teams/Untitled.md');
  assert.equal(a.files.get('work/areas/teams/Engineering/Engineering.md').content,b.files.get('work/areas/teams/Engineering/Engineering.md').content);
});
test('triage preserves custom metadata and exact body while dropping stale area/topic',async()=>{
  const fm={org:'personal',category:'note',type:'inbox',topic:'old',area:'[[Old]]',created:'2026-01-01T09:00',aliases:['Keep'],custom:{nested:42}};
  const body='\n\n\nBody\n';const f=fixture([area('work','recruitment'),['personal/inbox/Capture.md','---\n'+JSON.stringify(fm)+'\n---'+body,fm]],
    ['personal/inbox/Capture.md','move','work','Area','Recruitment','Plan']);await f.run('triage');
  const out=f.files.get('work/areas/recruitment/Plan.md');assert.deepEqual(out.fm.custom,{nested:42});assert.deepEqual(out.fm.aliases,['Keep']);assert.equal(out.fm.created,fm.created);assert.equal(out.fm.type,undefined);assert.equal(out.fm.topic,undefined);assert.ok(out.content.endsWith(body));
});
test('tasks include area profiles and draft journals but exclude all archive segments',async()=>{
  const fm={org:'work',category:'area',created:'2026-09-01'};
  const f=fixture([['work/areas/growth/Growth.md','## Tasks\n- [ ] Now #prio\n- [ ] Later #wl\n- [x] Done',fm],
    ['work/areas/growth/Draft Event.md','## Tasks\n- [ ] Prepare',{...fm,category:'journal'}],
    ['work/areas/archive/old/Old.md','## Tasks\n- [ ] Archived',fm],['work/projects/archive/Old.md','## Tasks\n- [ ] Archived project',{...fm,category:'project'}]],['work','tasks']);
  await f.load('_scripts/quickadd/actionpoints.md').entry(f);
  const tasks=f.files.get('work/bases/Work Tasks.md').content;assert.match(tasks,/Area Tasks/);assert.match(tasks,/Prepare/);assert.doesNotMatch(tasks,/Archived|Done|Later/);
  assert.match(f.files.get('work/bases/Work Priority.md').content,/Now #prio/);assert.match(f.files.get('work/bases/Work Wishlist.md').content,/Later/);
});
test('archive moves only selected context into the correct local archive',async()=>{
  const f=fixture([area()],['personal','area','personal/areas/health/Health.md','yes']);await f.run('archive');
  assert.ok(f.files.has('personal/areas/archive/health/Health.md'));assert.ok(!f.files.has('personal/areas/health/Health.md'));
});
test('periodic startup is idempotent, local calendar boundaries are valid',async()=>{
  const f=fixture();await f.run('periodicAuto');const count=f.files.size;await f.run('periodicAuto');assert.equal(f.files.size,count);assert.equal(f.opened.length,0);
  const s=await f.load('_scripts/shared/runtime.md').create(f.app);
  assert.equal(s.weeklyValues('work',new Date(2027,0,1)).filename,'2026-12-28--01-03 Work');assert.equal(s.parseDay('2026-02-30'),null);
});
test('Open Weekly obeys canonical config and explicit overrides',async()=>{
  const f=fixture([['_scripts/config/orgs.json','{"default":"personal"}']]);const open=f.load('_scripts/quickadd/Open Weekly.md');
  await open.entry(f);assert.ok(f.opened[0].startsWith('personal/weekly/'));await open.entry(f,{org:'work'});assert.ok(f.opened[1].startsWith('work/weekly/'));
});
test('resource captures retain category and area rather than topic',async()=>{
  for(const [flow,answers,category] of [
    ['invoice',['Health','Receipt'],'invoice'],['document',['Health','Record'],'note'],['book',['Health','reading','Book'],'book'],
    ['place',['Health','entry','cafe','Cafe'],'place'],['trip',['Health','recommendation','Trip'],'trip']]) {
    const f=fixture([area()],answers);await f.run(flow);const file=f.files.get(f.opened[0]);assert.equal(file.fm.category,category);assert.equal(file.fm.area,'[[personal/areas/health/Health]]');assert.equal(file.fm.topic,undefined);
  }
});
test('missing runtime fails before writes; exported entry points remain synchronous',async()=>{
  for(const script of ['templates.md','journal.md','actionpoints.md','Open Weekly.md']) {
    const f=fixture();const x=f.load('_scripts/quickadd/'+script);assert.equal(typeof x.entry,'function');f.files.delete('_scripts/shared/runtime.md');const count=f.files.size;await assert.rejects(x.entry(f),/Shared runtime missing/);assert.equal(f.files.size,count);
  }
});

test('project and area-owned meeting creation preserve distinct profile shapes',async()=>{
  const f=fixture([area('work','recruitment')],['work','Top level','Recruitment','Hire','work','Area','Recruitment','Review']);
  await f.run('project');await f.run('meeting');
  const project=f.files.get('work/projects/Hire/Hire.md');
  assert.equal(project.fm.category,'project');assert.equal(project.fm.area,'[[work/areas/recruitment/Recruitment]]');
  const meeting=f.files.get('work/areas/recruitment/meetings/Review/Review.md');
  assert.equal(meeting.fm.category,'meeting');assert.equal(meeting.fm.area,project.fm.area);
});
test('transcript inherits area and updates reciprocal links',async()=>{
  const j='work/areas/recruitment/Interview.md';
  const f=fixture([[j,'---\norg: work\ncategory: journal\narea: "[[work/areas/recruitment/Recruitment]]"\n---\nBody']],['work','Interview']);
  await f.run('transcript');const out=f.files.get('work/areas/resources/transcripts/Interview - Transcript.md');
  assert.equal(out.fm.journal,'[[work/areas/recruitment/Interview]]');
  assert.equal(out.fm.area,'[[work/areas/recruitment/Recruitment]]');
  assert.equal(f.files.get(j).fm.transcript,'[[work/areas/resources/transcripts/Interview - Transcript]]');
});
test('date placeholder is filled in place without blank or duplicate daily notes',async()=>{
  const f=fixture([['daily/2026-09-20.md','']]);await f.templater('daily/2026-09-20.md');
  assert.equal(f.files.get('daily/2026-09-20.md').fm.category,'daily');
  assert.equal([...f.files.keys()].filter(p=>p.startsWith('daily/')&&p.endsWith('.md')).length,1);
});
test('area names are validated and archived profiles are not capture choices',async()=>{
  const f=fixture([area(),['personal/areas/archive/Old/Old.md','',{org:'personal',category:'area'}]]);
  const s=await f.load('_scripts/shared/runtime.md').create(f.app),a=await f.load('_scripts/shared/areas.md').create(f.app,s);
  assert.equal(a.profiles('personal','area').length,1);assert.throws(()=>a.planned('personal','archive'),/reserved/);
  assert.equal(a.planned('personal','health').folder,'personal/areas/health');
});
test('public and private menus preserve order, stable IDs and area commands',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'.obsidian/plugins/quickadd/data.example.json'),'utf8'));
  assert.deepEqual(config.choices.map(x=>x.id),['inbox','journal','note','journal-sport','journal-reflection','monthly-reflection','invoice','document','meal-plan','transcript','clipping','actions-menu','entities-menu','system-menu']);
  const flatten=xs=>xs.flatMap(x=>[x,...flatten(x.choices||[])]);const all=flatten(config.choices);
  assert.equal(new Set(all.map(x=>x.id)).size,all.length);
  for(const flow of ['area','setupAreas','reassign'])assert.ok(all.some(x=>x.macro?.commands?.some(c=>c.settings?.flow===flow)));
  const localPath=path.join(root,'.obsidian/plugins/quickadd/data.json');
  if(fs.existsSync(localPath)) {
    const local=JSON.parse(fs.readFileSync(localPath,'utf8'));assert.deepEqual(local.choices.map(x=>x.id),config.choices.map(x=>x.id));
    for(const id of ['entities-menu','actions-menu'])assert.deepEqual(local.choices.find(x=>x.id===id),config.choices.find(x=>x.id===id));
  }
});
