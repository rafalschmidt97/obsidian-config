<%*
// Compatibility entry point for older device settings; use the unified folder adapter.
const file=app.vault.getAbstractFileByPath('_scripts/templater/apply-templateq-folder-template.md');
if(!file) throw new Error('Folder adapter missing.');
const body=(await app.vault.read(file)).replace(/^<%\*\s*/,'').replace(/-%>\s*$/,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
await new AsyncFunction('app','tp',body)(app,tp);
-%>
