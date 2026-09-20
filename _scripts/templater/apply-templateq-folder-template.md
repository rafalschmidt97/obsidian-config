<%*
if (tp.file.content?.trim()) return;
const path=tp.file.path(true), placeholder=app.vault.getAbstractFileByPath(path);
const folder=path.split('/').slice(0,-1).join('/');
const title=tp.file.title.startsWith('Untitled')?'':tp.file.title;
const file=app.vault.getAbstractFileByPath('_scripts/shared/runtime.md');
if(!file) throw new Error('Shared runtime missing: _scripts/shared/runtime.md');
const runtime=new Function('module',`${await app.vault.read(file)}\nreturn module.exports;`)({exports:{}});
const s=await runtime.create(app);
if(s.isArchived(path)) {new Notice('Capture into an active context.');return;}
const params={app,quickAddApi:{date:tp.date,
  inputPrompt:(label)=>tp.system.prompt(label,'',true),
  suggester:(labels,values,prompt)=>tp.system.suggester(labels,values,true,prompt)}};
const a=await (await runtime.loadModule(app,'_scripts/shared/areas.md')).create(app,s);
const periodic=await (await runtime.loadModule(app,'_scripts/shared/periodic.md')).create(params,s,a);
let result=await periodic.namedPeriodic(title);
if(!result) {
  if(folder==='daily') result=await periodic.namedPeriodic(tp.date.now('YYYY-MM-DD'));
  else if(folder.endsWith('/weekly')) {
    const values=s.weeklyValues(folder.split('/')[0],new Date());result=await periodic.namedPeriodic(values.filename);
  } else {
    const capture=await (await runtime.loadModule(app,'_scripts/shared/capture.md')).create(params,s,a);
    result=await capture.folderCapture(folder,title);
  }
}
// The created note already contains text, so the new-file trigger exits immediately.
if(result&&result!==placeholder&&placeholder&&!(await app.vault.read(placeholder)).trim()) await app.vault.delete(placeholder);
-%>
