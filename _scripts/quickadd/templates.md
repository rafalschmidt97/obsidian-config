// QuickAdd's synchronous export contract; implementations load through the vault API.
const names=['inbox','triage','archive','reassign','area','setupAreas','note','person','meeting','project','team','book','clipping','invoice','document','place','trip','transcript','daily','weekly','monthlyReflection','mealPlan','periodicAuto','folderCapture'];
module.exports={entry:async(params,settings={})=>dispatch(params,settings.flow||'note'),
  ...Object.fromEntries(names.map(name=>[name,(params,...args)=>dispatch(params,name,...args)]))};
async function dispatch(params,name,...args) {
  const {app}=params;
  const file=app.vault.getAbstractFileByPath('_scripts/shared/runtime.md');
  if(!file) throw new Error('Shared runtime missing: _scripts/shared/runtime.md');
  const runtime=new Function('module',`${await app.vault.read(file)}\nreturn module.exports;`)({exports:{}});
  const s=await runtime.create(app);
  const a=await (await runtime.loadModule(app,'_scripts/shared/areas.md')).create(app,s);
  const content=await (await runtime.loadModule(app,'_scripts/shared/capture.md')).create(params,s,a);
  const periodic=await (await runtime.loadModule(app,'_scripts/shared/periodic.md')).create(params,s,a);
  const flow={...content,...periodic}[name];
  if(!flow) throw new Error(`Unknown capture flow: ${name}`);
  return s.runBackable(()=>flow(...args));
}
