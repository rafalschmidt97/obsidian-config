// All non-periodic content capture uses the same area/context model.
module.exports={create};
async function create(params,s,a) {
  const {app,quickAddApi:q}=params;
  const now=()=>q.date.now('YYYY-MM-DDTHH:mm');
  const date=()=>q.date.now('YYYY-MM-DD');
  const org=()=>s.choose(params,s.orgFolders(),s.orgFolders(),'org?',{back:false});
  const lines=fields=>Object.entries(fields).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n');
  async function write(template,ctx,name,values={},open=true) {
    const content=s.render(await s.readVaultFile(params,`_templates/${template}.md`),{org:ctx.org,created:now(),relationshipLines:lines(ctx.fields),...values});
    const path=await s.uniqueMarkdownPath(params,`${ctx.folder}/${s.safeFilename(name)}`);
    await a.materialize(ctx,now()); await s.ensureFolder(params,ctx.folder);
    const file=await app.vault.create(path,content);
    return open?s.openFile(params,file):file;
  }
  async function note() {
    const ctx=await a.route(params,await org());
    return write('Note',ctx,await s.requiredInput(params,'title?'));
  }
  async function area() {
    const ctx=a.planned(await org(),await s.requiredInput(params,'area name?'));
    await a.materialize(ctx,now()); return s.openFile(params,ctx.profile);
  }
  async function resourceContext(selectedOrg,collection) {
    const ctx=await a.select(params,selectedOrg,{loose:true});
    if(ctx.kind==='loose') ctx.folder=`${selectedOrg}/areas/resources/${collection}`;
    return ctx;
  }
  async function entity(kind) {
    const selectedOrg=await org();
    let folder=`${selectedOrg}/areas/${kind==='person'?'people':kind+'s'}`;
    let ctx={org:selectedOrg,folder,fields:{},kind:'loose'}, parentLine='';
    if(kind==='project') {
      const parent=await s.choose(params,['Top level',...a.profiles(selectedOrg,'project').map(f=>f.basename)],[null,...a.profiles(selectedOrg,'project')],'parent?');
      if(parent) {ctx=a.context(parent); folder=`${ctx.folder}/projects`; parentLine=`parent: ${JSON.stringify(a.link(parent))}`; delete ctx.fields.project;}
      else {ctx=await a.select(params,selectedOrg,{loose:true}); folder=`${selectedOrg}/projects`;}
    } else if(kind==='meeting') {
      const where=await s.choose(params,['Loose','Area','Project','Team'],['loose','area','project','team'],'where?');
      if(where!=='loose') {ctx=await a.route(params,selectedOrg,'note',where); folder=`${ctx.folder}/meetings`;}
    }
    const name=s.safeFilename(await s.requiredInput(params,`${kind}?`));
    const destination={...ctx,folder:`${folder}/${name}`,pending:undefined};
    const existing=app.vault.getAbstractFileByPath(`${destination.folder}/${name}.md`);
    if(existing) throw new Error('A profile already exists at that path. Select it instead.');
    // Resolve pending area only after validating all capture inputs and collisions.
    await a.materialize(ctx,now());
    const fields={...destination.fields}; delete fields.attendees;
    destination.fields=fields;
    return write(s.capitalize(kind),destination,name,{parentLine,contextLine:lines(fields),detailsBlock:selectedOrg==='personal'?'':s.detailsBlock()});
  }
  async function book() {
    const ctx=await resourceContext('personal','books');
    const status=await s.choose(params,['to-read','reading','read'],['to-read','reading','read'],'status?');
    return write('Book',ctx,await s.requiredInput(params,'title?'),{statusLine:`status: ${status}`});
  }
  async function clipping() {
    const ctx=await resourceContext(await org(),'clippings');
    const type=await s.choose(params,['read','listen','watch'],['read','listen','watch'],'type?');
    return write('Clipping',ctx,await s.requiredInput(params,'title?'),{type});
  }
  async function invoice() {
    const ctx=await resourceContext('personal','invoices');
    return write('Invoice',ctx,`${date()} ${await s.requiredInput(params,'title?')}`);
  }
  async function document() {
    const ctx=await resourceContext('personal','documents');
    return write('Note',ctx,await s.requiredInput(params,'title?'));
  }
  async function place() {
    const ctx=await resourceContext('personal','places');
    const type=await s.choose(params,['entry','recommendation'],['entry','recommendation'],'type?');
    const kinds=['restaurant','bar','cafe','spot','city','country'];
    const placeKind=await s.choose(params,kinds,kinds,'place kind?');
    return write('Place',ctx,await s.requiredInput(params,'title?'),{type,placeKind});
  }
  async function trip() {
    const ctx=await resourceContext('personal','trips');
    const type=await s.choose(params,['entry','recommendation'],['entry','recommendation'],'type?');
    let dateLines='';
    if(type==='entry') {
      const start=await q.inputPrompt('start?','YYYY-MM-DD'),end=await q.inputPrompt('end?','YYYY-MM-DD');
      dateLines=[start?`start: ${start}`:'',end?`end: ${end}`:''].filter(Boolean).join('\n');
    }
    return write('Trip',ctx,await s.requiredInput(params,'title?'),{type,dateLines});
  }
  async function transcript() {
    const selectedOrg=await org();
    const journals=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(selectedOrg+'/')&&a.active(f)&&s.getFrontmatter(params,f)?.category==='journal'&&!f.basename.startsWith('Draft '));
    const file=await s.choose(params,['Standalone',...journals.map(f=>f.basename)],[null,...journals],'journal?');
    const ctx={org:selectedOrg,folder:`${selectedOrg}/areas/resources/transcripts`,fields:{}};
    if(file) {
      const area=a.context(file).fields.area;
      if(area) ctx.fields.area=area;
    }
    const name=file?`${file.basename} - Transcript`:`${date()} ${await s.requiredInput(params,'title?')} - Transcript`;
    const created=await write('Transcript',ctx,name,{journalLine:file?`journal: ${JSON.stringify(a.link(file))}`:''});
    if(file) await app.fileManager.processFrontMatter(file,fm=>{fm.transcript=a.link(created);});
    return created;
  }
  async function move(source,isInbox=false) {
    const fm=s.getFrontmatter(params,source)||{};
    if(!isInbox&&['area','person','team','project','meeting'].includes(fm.category)) throw new Error('Move the context folder, not its profile alone.');
    if(!isInbox&&(fm.project||fm.meeting||fm.team)) throw new Error('This entry belongs to a context. Reassign that context first.');
    const selectedOrg=await org();
    const ctx=await a.route(params,selectedOrg,fm.category==='journal'?'journal':'note');
    const title=await s.requiredInput(params,'title?');
    const target=await s.uniqueMarkdownPath(params,`${ctx.folder}/${s.safeFilename(title)}`);
    await a.materialize(ctx,now()); await s.ensureFolder(params,ctx.folder);
    await app.fileManager.processFrontMatter(source,meta=>{
      meta.org=selectedOrg;
      if(isInbox) {meta.category='note';if(meta.type==='inbox') delete meta.type;}
      if(!meta.created) meta.created=now();
      delete meta.area; delete meta.topic;
      Object.assign(meta,ctx.fields);
    });
    await app.fileManager.renameFile(source,target); return s.openFile(params,source);
  }
  async function triage() {
    const files=app.vault.getMarkdownFiles().filter(f=>a.active(f)&&s.orgFolders().includes(f.path.split('/')[0])&&f.path.split('/')[1]==='inbox'&&!['index'].includes(s.getFrontmatter(params,f)?.category)&&s.getFrontmatter(params,f)?.topic!=='indexes');
    if(!files.length) throw new Error('No inbox notes to triage.');
    const source=await s.choose(params,files.map(f=>f.path),files,'note?',{back:false});
    const action=await s.choose(params,['move','open','delete'],['move','open','delete'],'action?');
    if(action==='open') return s.openFile(params,source);
    if(action==='delete') {
      if(await s.choose(params,['no','yes'],[false,true],'delete?',{back:false})) await app.vault.trash(source,false);
      return;
    }
    return move(source,true);
  }
  async function reassign() {
    const file=app.workspace.getActiveFile?.();
    if(!file||!a.active(file)) throw new Error('Open an active content note first.');
    return move(file);
  }
  async function archive() {
    const selectedOrg=await org();
    const kind=await s.choose(params,['area','project','person','meeting','team'],['area','project','person','meeting','team'],'what?');
    const items=a.profiles(selectedOrg,kind);
    if(!items.length) throw new Error('No active profiles to archive.');
    const file=await s.choose(params,items.map(f=>f.path),items,`${kind}?`);
    const source=file.parent;
    if(kind==='area') {
      const external=a.profiles(selectedOrg,'project').filter(f=>a.resolve(s.getFrontmatter(params,f)?.area)?.path===file.path);
      if(external.length) throw new Error('Reassign or archive linked active projects first.');
    }
    const parts=source.path.split('/');
    if(!['areas','projects'].includes(parts[1])||parts.length<3||['people','meetings','teams','resources','loose','journal'].includes(parts.slice(2).join('/'))) throw new Error('Select a concrete context folder.');
    const target=`${selectedOrg}/${parts[1]}/archive/${parts.slice(2).join('/')}`;
    if(app.vault.getAbstractFileByPath(target)) throw new Error('Archive destination exists; resolve the collision first.');
    if(!await s.choose(params,['no','yes'],[false,true],`archive ${file.basename}?`,{back:false})) return;
    await s.ensureFolder(params,target.split('/').slice(0,-1).join('/'));
    await app.fileManager.renameFile(source,target);
  }
  async function folderCapture(folder,title='') {
    const ctx=a.infer(folder), parts=folder.split('/');
    if(s.isArchived(folder)) throw new Error('Capture into an active context.');
    if(parts[1]==='inbox') return write('Note',ctx,q.date.now('YYYY-MM-DD HH-mm-ss'),{typeLine:'type: inbox'});
    const entityRoots={people:'person',teams:'team',meetings:'meeting',projects:'project'};
    const tail=parts.at(-1);
    if(entityRoots[tail]) {
      const kind=entityRoots[tail], name=title||await s.requiredInput(params,`${kind}?`);
      const dest={...ctx,folder:`${folder}/${s.safeFilename(name)}`};
      if(app.vault.getAbstractFileByPath(`${dest.folder}/${s.safeFilename(name)}.md`)) throw new Error('A profile already exists at that path. Select it instead.');
      const fields={...ctx.fields};
      const parentLine=kind==='project'&&fields.project?`parent: ${JSON.stringify(fields.project)}`:'';
      if(kind==='project') delete fields.project;
      dest.fields=fields;
      return write(s.capitalize(kind),dest,name,{parentLine,contextLine:lines(fields),detailsBlock:ctx.org==='personal'?'':s.detailsBlock()});
    }
    const defaultJournal=ctx.kind==='person'||ctx.kind==='meeting'||folder.endsWith('/areas/journal');
    const kind=defaultJournal?'journal':await s.choose(params,['Note','Journal'],['note','journal'],'category?');
    if(kind==='journal') {
      const runtime=await s.loadModule(app,'_scripts/quickadd/journal.md');
      return runtime.captureFolder(params,folder,{title});
    }
    return write('Note',ctx,title||await s.requiredInput(params,'title?'));
  }
  return {note,area,setupAreas:()=>a.setup(params),person:()=>entity('person'),meeting:()=>entity('meeting'),project:()=>entity('project'),team:()=>entity('team'),
    book,clipping,invoice,document,place,trip,transcript,triage,reassign,archive,folderCapture,
    inbox:()=>write('Note',{org:'personal',folder:'personal/inbox',fields:{}},q.date.now('YYYY-MM-DD HH-mm-ss'),{typeLine:'type: inbox'})};
}
