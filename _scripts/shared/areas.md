// Context model shared by explicit capture, folder capture, and maintenance.
module.exports = { create };
async function create(app, s) {
  const p = { app };
  const link = file => `[[${file.path.replace(/\.md$/, '')}]]`;
  const active = file => !s.isArchived(file.path) && !['archived','obsolete'].includes(s.getFrontmatter(p,file)?.status);
  const profiles = (org, category) => app.vault.getMarkdownFiles()
    .filter(f => f.path.startsWith(org+'/') && active(f) && s.getFrontmatter(p,f)?.category === category)
    .sort((a,b)=>a.basename.localeCompare(b.basename));
  const resolve = value => {
    const target = String(value || '').replace(/^\[\[/,'').replace(/\]\]$/,'').split('|')[0];
    return app.vault.getAbstractFileByPath(target.endsWith('.md') ? target : target+'.md')
      || app.metadataCache.getFirstLinkpathDest?.(target, '');
  };
  function inherited(file) {
    const fm = s.getFrontmatter(p,file) || {};
    const result = {};
    if (fm.area) result.area = fm.area;
    if (fm.project) {
      result.project = fm.project;
      const project = resolve(fm.project);
      const area = project && s.getFrontmatter(p,project)?.area;
      if (area && result.area && (resolve(area)?.path || area) !== (resolve(result.area)?.path || result.area)) throw new Error('Meeting and project have different areas. Reassign the context first.');
      if (area) result.area = area;
    }
    if (fm.team) result.team = fm.team;
    return result;
  }
  function context(file) {
    const fm=s.getFrontmatter(p,file)||{};
    const fields=inherited(file);
    if (fm.category==='area') fields.area=link(file);
    else if (fm.category==='person') fields.attendees=[link(file)];
    else if (['project','meeting','team'].includes(fm.category)) fields[fm.category]=link(file);
    return { org:fm.org, folder:file.parent.path, fields, profile:file, kind:fm.category };
  }
  function infer(folder) {
    const org=folder.split('/')[0];
    const candidates=app.vault.getMarkdownFiles().filter(f => f.path.startsWith(org+'/') && active(f)
      && ['area','project','meeting','person','team'].includes(s.getFrontmatter(p,f)?.category)
      && (folder===f.parent.path || folder.startsWith(f.parent.path+'/')))
      .sort((a,b)=>b.parent.path.length-a.parent.path.length);
    if (!candidates.length) return {org,folder,fields:{},kind:'loose'};
    const ctx=context(candidates[0]);
    const area=candidates.find(f=>s.getFrontmatter(p,f)?.category==='area');
    if (area && !ctx.fields.area) ctx.fields.area=link(area);
    return {...ctx,folder};
  }
  async function config() {
    for (const path of ['_scripts/config/areas.json','_scripts/config/areas.example.json']) {
      const f=app.vault.getAbstractFileByPath(path);
      if (f) { try {return JSON.parse(await app.vault.read(f));} catch (_) {} }
    }
    return {personal:['home','cooking','travel','car','friends','health','growth','finances'],defaults:{sport:'personal/areas/health/Health',mealPlan:'personal/areas/cooking/Cooking'}};
  }
  const reserved=new Set(['archive','resources','journal','loose','people','meetings','teams']);
  function planned(org,name) {
    const title=s.safeFilename(name);
    const slug=title.toLowerCase().replace(/\s+/g,'-');
    if (!slug || slug.startsWith('.') || slug.startsWith('_') || reserved.has(slug)) throw new Error('Choose a non-reserved area name.');
    const existing=profiles(org,'area').find(f=>f.basename.toLowerCase()===title.toLowerCase() || f.parent.path.toLowerCase()===`${org}/areas/${slug}`);
    if(existing) return context(existing);
    const folder=`${org}/areas/${slug}`, path=`${folder}/${title}.md`;
    if (app.vault.getAbstractFileByPath(folder) && s.isArchived(folder)) throw new Error('Area destination is archived.');
    const collision=app.vault.getMarkdownFiles().find(f=>f.path.toLowerCase()===path.toLowerCase());
    if(collision) throw new Error(`Area profile path already contains another note: ${path}`);
    return {org,folder,fields:{area:`[[${path.slice(0,-3)}]]`},kind:'area',pending:{path,title}};
  }
  async function materialize(ctx, now) {
    if(!ctx.pending) return ctx;
    const {path}=ctx.pending;
    if(app.vault.getAbstractFileByPath(path)) throw new Error('Area was created concurrently. Select it again.');
    const text=s.render(await s.readVaultFile(p,'_templates/Area.md'),{org:ctx.org,created:now});
    await s.ensureFolder(p,ctx.folder);
    ctx.profile=await app.vault.create(path,text);
    delete ctx.pending;
    return ctx;
  }
  async function select(params,org,{loose=false,kind='note'}={}) {
    const items=profiles(org,'area').map(f=>({label:f.basename,value:context(f)}));
    if(loose) items.unshift({label:'Loose',value:{org,folder:`${org}/areas/${kind==='journal'?'journal':'loose'}`,fields:{},kind:'loose'}});
    items.push({label:'Create area…',value:'new'});
    const picked=await s.choose(params,items.map(x=>x.label),items.map(x=>x.value),'area?');
    return picked==='new' ? planned(org,await s.requiredInput(params,'area name?')) : picked;
  }
  async function route(params,org,kind='note',forced) {
    const where=forced || await s.choose(params,['Loose','Area','Project','Meeting','Person','Team'],['loose','area','project','meeting','person','team'],'where?');
    if(where==='loose') return {org,folder:`${org}/areas/${kind==='journal'?'journal':'loose'}`,fields:{},kind:'loose'};
    if(where==='area') return await select(params,org);
    const entries=profiles(org,where);
    if(!entries.length) throw new Error(`Create a ${where} profile first.`);
    const file=await s.choose(params,entries.map(f=>`${f.basename} (${f.parent.path})`),entries,`${where}?`);
    return context(file);
  }
  async function defaultContext(params,key) {
    const cfg=await config(); const path=cfg.defaults?.[key]; const file=resolve(path);
    if(file && active(file) && s.getFrontmatter(p,file)?.category==='area') return context(file);
    return await select(params,'personal');
  }
  async function setup(params) {
    const cfg=await config();
    if(!Array.isArray(cfg.personal)) throw new Error('Area config personal must be a list of names.');
    for(const slug of cfg.personal) {
      const ctx=planned('personal',s.capitalize(slug));
      if(ctx.pending) await materialize(ctx,params.quickAddApi.date.now('YYYY-MM-DDTHH:mm'));
    }
  }
  return {link,active,profiles,resolve,context,infer,config,planned,materialize,select,route,defaultContext,setup};
}
