// Raw QuickAdd user script stored as .md so Obsidian Sync includes it on mobile.
module.exports = { entry };

async function entry(params, settings = {}) {
  const { app, quickAddApi } = params;
  const file = app.vault.getAbstractFileByPath("_scripts/shared/runtime.md");
  if (!file) throw new Error("Shared runtime missing: _scripts/shared/runtime.md");
  const runtime = new Function("module", `${await app.vault.read(file)}\nreturn module.exports;`)({ exports: {} });
  const shared = await runtime.create(app);
  const org = settings.org || await shared.defaultOrg();
  const values = shared.weeklyValues(org, new Date());
  const path = `${org}/weekly/${values.filename}.md`;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) return await shared.openFile(params, existing);
  const content = shared.render(await shared.readVaultFile(params, "_templates/Weekly.md"), {
    ...values, created: quickAddApi.date.now("YYYY-MM-DDTHH:mm"),
  });
  await shared.ensureFolder(params, `${org}/weekly`);
  return await shared.openFile(params, await app.vault.create(path, content));
}
