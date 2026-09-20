// Synchronous QuickAdd exports; vault modules load per invocation on desktop/mobile.
module.exports = Object.fromEntries(['entry','journal','generic','sport','reflection','draft','future','person','meeting','project','team','activateFolderDraft','captureFolder']
  .map(name=>[name,async(params,...args)=>{
    const file=params.app.vault.getAbstractFileByPath('_scripts/shared/runtime.md');
    if(!file) throw new Error('Shared runtime missing: _scripts/shared/runtime.md');
    const runtime=new Function('module',`${await params.app.vault.read(file)}\nreturn module.exports;`)({exports:{}});
    const s=await runtime.create(params.app);
    const a=await (await runtime.loadModule(params.app,'_scripts/shared/areas.md')).create(params.app,s);
    return flows(params,s,a)[name](...args);
  }]));

function flows(params,s,a) {
  const {app,quickAddApi:q}=params;
  const now=()=>q.date.now('YYYY-MM-DDTHH:mm');
  const stamp=()=>q.date.now('YYYY-MM-DD HH-mm');
  const org=()=>s.choose(params,s.orgFolders(),s.orgFolders(),'org?',{back:false});
  const typeFor=ctx=>({person:'1-1',meeting:'meeting',project:'project',team:'team'}[ctx.kind]||'event');
  const fmLines=fields=>Object.entries(fields).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n');
  function matches(f,ctx,type) {
    const fm=s.getFrontmatter(params,f)||{};
    if(!a.active(f)||!s.isDraftJournal(fm,ctx.org,f)||fm.type!==type) return false;
    const keys=['area','project','meeting','team','attendees'];
    const normalize=v=>{
      if(Array.isArray(v)) return v.length?v.map(normalize).sort():null;
      if(!v) return null;
      return a.resolve(v)?.path || v;
    };
    return keys.every(k=>JSON.stringify(normalize(fm[k]))===JSON.stringify(normalize(ctx.fields[k])));
  }
  function drafts(ctx,type) {
    return app.vault.getMarkdownFiles().filter(f=>f.parent.path===ctx.folder&&matches(f,ctx,type))
      .sort((x,y)=>String(s.getFrontmatter(params,y)?.created).localeCompare(String(s.getFrontmatter(params,x)?.created)));
  }
  async function activate(file,ctx) {
    const subject=file.basename.replace(/^Draft\s+/,'');
    const target=await s.uniqueMarkdownPath(params,`${ctx.folder}/${stamp()} ${s.safeFilename(subject)}`);
    await app.fileManager.processFrontMatter(file,fm=>{if(fm.created) fm.drafted=fm.created; fm.created=now();});
    await app.fileManager.renameFile(file,target);
    return s.openFile(params,file);
  }
  async function offer(ctx,type,select) {
    const existing=drafts(ctx,type);
    if(!existing.length) return null;
    const labels=[...existing.map(f=>`use draft: ${f.basename}`),'create new'];
    const values=[...existing,null];
    const picked=select ? await select(labels,values) : await s.choose(params,labels,values,'draft?');
    return picked ? activate(picked,ctx) : null;
  }
  async function capture(ctx,type,{draft=false,title,open=true,select}={}) {
    if(['sport','reflection'].includes(type)) draft=false;
    else if(!draft) {const activated=await offer(ctx,type,select); if(activated) return activated;}
    const subject=title || ctx.profile?.basename || await s.requiredInput(params,'title?');
    const filename=draft ? `Draft ${s.safeFilename(subject)}` : `${stamp()} ${s.safeFilename(subject)}`;
    const existing=app.vault.getAbstractFileByPath(`${ctx.folder}/${filename}.md`);
    if(draft&&existing) {
      if(matches(existing,ctx,type)) return s.openFile(params,existing);
      throw new Error('That draft filename belongs to different content. Choose another title.');
    }
    const template='_templates/'+({sport:'Journal Sport','1-1':'Journal Person',meeting:'Journal Meeting',project:'Journal Project',team:'Journal Team'}[type]||'Journal')+'.md';
    const fields={...ctx.fields};
    if(type==='event'&&!fields.attendees) fields.attendees=[];
    const content=s.render(await s.readVaultFile(params,template),{
      org:ctx.org,created:now(),typeLine:`type: ${type}`,relationshipLines:fmLines(fields),
      history:fields.area&&type!=='sport'?'## Previous entries\n\n![[area-history.base]]':'',
      draftPlanningSection:draft?'## Talking Points\n\n- ':''
    });
    const target=await s.uniqueMarkdownPath(params,`${ctx.folder}/${filename}`);
    await a.materialize(ctx,now()); await s.ensureFolder(params,ctx.folder);
    const file=await app.vault.create(target,content);
    return open ? s.openFile(params,file) : file;
  }
  async function start(settings={}) {
    const flow=settings.flow;
    const selectedOrg=settings.org || (flow==='sport'?'personal':await org());
    if(flow==='sport') {
      const ctx=await a.defaultContext(params,'sport');
      return capture(ctx,'sport',{title:await s.requiredInput(params,'title?')});
    }
    if(flow==='reflection') {
      const ctx=await a.select(params,selectedOrg,{loose:true,kind:'journal'});
      return capture(ctx,'reflection',{title:await s.requiredInput(params,'title?')});
    }
    const draft=settings.draft ?? (['draft','future'].includes(flow) || await s.choose(params,['now','draft'],[false,true],'mode?'));
    const forced=['person','meeting','project','team'].includes(flow)?flow:undefined;
    let ctx=await a.route(params,selectedOrg,'journal',forced);
    // Area profiles name the context, not the subject of every occurrence.
    const type=typeFor(ctx);
    if(['area','loose'].includes(ctx.kind)) {
      ctx={...ctx,profile:undefined};
    }
    return capture(ctx,type,{draft});
  }
  async function captureFolder(folder,options={}) {
    const ctx=a.infer(folder); const type=options.type || typeFor(ctx);
    const draft=['sport','reflection'].includes(type)?false:await s.choose(params,['now','draft'],[false,true],'mode?');
    if(['area','loose'].includes(ctx.kind)) ctx.profile=undefined;
    return capture(ctx,type,{draft,title:options.title,select:options.select});
  }
  return {
    entry:(settings={})=>s.runBackable(()=>start(settings)),
    ...Object.fromEntries(['journal','generic','sport','reflection','draft','future','person','meeting','project','team'].map(flow=>[flow,(selectedOrg,options={})=>start({flow,org:selectedOrg,...options})])),
    captureFolder,
    activateFolderDraft:async(folder,context,select)=>{
      const ctx=a.infer(folder); return !!(await offer(ctx,context.type||typeFor(ctx),select));
    }
  };
}
