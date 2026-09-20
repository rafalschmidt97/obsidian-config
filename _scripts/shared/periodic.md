module.exports={create};
async function create(params,s,a) {
  const {app,quickAddApi:q}=params;
  const org=()=>s.choose(params,s.orgFolders(),s.orgFolders(),'org?',{back:false});
  async function write(template,path,values,open=true) {
    let file=app.vault.getAbstractFileByPath(path+'.md');
    if(!file || !(await app.vault.read(file)).trim()) {
      const text=s.render(await s.readVaultFile(params,`_templates/${template}.md`),{created:q.date.now('YYYY-MM-DDTHH:mm'),...values});
      await s.ensureFolder(params,path.split('/').slice(0,-1).join('/'));
      if(file) await app.vault.modify(file,text);
      else file=await app.vault.create(path+'.md',text);
    }
    return open?s.openFile(params,file):file;
  }
  async function chooseDate(kind='day',folder='daily',planName='') {
    const today=s.startOfDay(new Date()),options=[];
    const offsets=kind==='day'?[0,-1,-2,-3,-4,-5,-6,-7]:[-3,-2,-1,0,1,2,3];
    for(const offset of offsets) {
      const day=s.offsetDays(today,offset*(kind==='day'?1:7));
      const range=s.weekRange(day);
      const filename=kind==='day'?s.fmtLocal(day):`${range.start}--${range.shortEnd} ${planName}`;
      const label=`${offset===0?(kind==='day'?'today':'this week')+' · ':''}${filename}${app.vault.getAbstractFileByPath(folder+'/'+filename+'.md')?' (exists)':''}`;
      options.push({label,value:day});
    }
    const value=await s.choose(params,[...options.map(x=>x.label),'pick a date…'],[...options.map(x=>x.value),null],kind==='day'?'which day?':'which week?',{back:false});
    if(value) return value;
    const parsed=s.parseDay(await s.requiredInput(params,'date (YYYY-MM-DD)?'));
    if(!parsed) throw new Error('Invalid calendar date.');
    return parsed;
  }
  const dailyAt=(day,open=true)=>write('Daily',`daily/${s.fmtLocal(day)}`,s.dailyValues(s.orgFolders(),day),open);
  const weeklyAt=(org,day,open=true)=>{const values=s.weeklyValues(org,day);return write('Weekly',`${org}/weekly/${values.filename}`,values,open);};
  async function monthlyReflection() {
    const selectedOrg=await org(),cap=s.capitalize(selectedOrg),r=s.previousMonthRange(new Date());
    return write('Monthly Reflection',`${selectedOrg}/areas/journal/${r.month} ${cap} Monthly Reflection`,{
      org:selectedOrg,start:r.start,end:r.end,previous:`${r.previousMonth} ${cap} Monthly Reflection`,next:`${r.nextMonth} ${cap} Monthly Reflection`});
  }
  async function mealPlan() {
    let cfg={folder:'personal/areas/cooking',planName:'Cooking Schedule'};
    const file=app.vault.getAbstractFileByPath('_scripts/config/mealplan.json');
    if(file) cfg={...cfg,...JSON.parse(await app.vault.read(file))};
    const day=await chooseDate('week',cfg.folder,cfg.planName),r=s.weekRange(day);
    const prev=s.weekRange(s.offsetDays(r.monday,-7)),next=s.weekRange(s.offsetDays(r.monday,7));
    const ctx=await a.defaultContext(params,'mealPlan');
    return write('Meal Plan',`${cfg.folder}/${r.start}--${r.shortEnd} ${cfg.planName}`,{
      start:r.start,end:r.end,previous:`${prev.start}--${prev.shortEnd} ${cfg.planName}`,next:`${next.start}--${next.shortEnd} ${cfg.planName}`,
      relationshipLines:`area: ${JSON.stringify(ctx.fields.area)}`});
  }
  async function periodicAuto() {
    for(const value of s.orgFolders()) await weeklyAt(value,new Date(),false);
    await dailyAt(new Date(),false);
  }
  async function namedPeriodic(title) {
    if(/^\d{4}-\d{2}-\d{2}$/.test(title)) {
      const d=s.parseDay(title); if(!d) throw new Error('Invalid calendar date.');
      return dailyAt(d);
    }
    const match=title.match(/^(\d{4}-\d{2}-\d{2})--\d{2}-\d{2} (.+)$/);
    if(match&&s.orgFolders().includes(match[2].toLowerCase())) return weeklyAt(match[2].toLowerCase(),s.parseDay(match[1]));
    return null;
  }
  return {daily:async()=>dailyAt(await chooseDate()),weekly:async()=>weeklyAt(await org(),new Date()),monthlyReflection,mealPlan,periodicAuto,namedPeriodic};
}
