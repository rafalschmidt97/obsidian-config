// Shared vault runtime. Raw JavaScript in Markdown for Obsidian Sync, including mobile.
// Loaded through app.vault inside async entry calls, never Node require or top-level await.
module.exports = { create, loadModule };

async function loadModule(app, path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || isFolder(file)) throw new Error(`Script not found: ${path}`);
  const source = await app.vault.read(file);
  const mod = { exports: {} };
  new Function("module", "exports", `${source}\n`)(mod, mod.exports);
  return mod.exports;
}

async function create(app) {
  const config = await readConfig(app, "orgs");
  const order = Array.isArray(config.order) ? config.order : [];
  const sortOrgNames = (a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    if ((a === "personal") !== (b === "personal")) return a === "personal" ? 1 : -1;
    return a.localeCompare(b);
  };
  const orgFolders = (params = { app }) => params.app.vault.getRoot().children
    .filter(child => isFolder(child) && !/^[_.]/.test(child.name) && !["archive", "daily"].includes(child.name))
    .map(child => child.name).sort(sortOrgNames);
  const defaultOrg = async () => {
    const orgs = orgFolders();
    if (orgs.includes(config.default)) return config.default;
    return orgs[0] || "personal";
  };
  return {
    loadModule, orgFolders, defaultOrg, sortOrgNames,
    render, stripEmptyFrontmatterLines, readVaultFile, ensureFolder, uniqueMarkdownPath,
    openFile, openFileAtHeading, renameFile, safeFilename, cleanTopic, capitalize, isFolder, getFrontmatter,
    fmtLocal, fmt: fmtLocal, fmtMonth, offsetDays, weekRange, previousMonthRange,
    startOfDay, weekdayName, parseDay, nearestContext, relationshipLines, detailsBlock,
    findProjectFolders, findTopLevelProjectFolders, findMeetingFolders, findFolders, folderNames,
    runBackable, choose, requiredInput, notice, wikilink, escapeYamlString, formatWikilinkList,
    journalMatchesDraft, isDraftJournal, frontmatterValueMatchesLink,
    noteRouteValues, weeklyValues, dailyValues, isArchived,
    fileLink: file => fileLink(app, file),
  };
}

async function readConfig(app, name) {
  for (const path of [`_scripts/config/${name}.json`, `_scripts/config/${name}.example.json`]) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) continue;
    try { return JSON.parse(await app.vault.read(file)); } catch (_) { /* Try the example next. */ }
  }
  return {};
}

function render(template, values) {
  return stripEmptyFrontmatterLines(template.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? ""));
}
function stripEmptyFrontmatterLines(content) {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  return `---\n${content.slice(4, end).split("\n").filter(line => line.trim()).join("\n")}${content.slice(end)}`;
}
async function readVaultFile({ app }, path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) throw new Error(`Template not found: ${path}`);
  return await app.vault.cachedRead(file);
}
async function ensureFolder({ app }, path) {
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}
async function uniqueMarkdownPath({ app }, path) {
  if (!app.vault.getAbstractFileByPath(`${path}.md`)) return `${path}.md`;
  for (let i = 1; i < 100; i++) {
    const candidate = `${path} (${i}).md`;
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique file name for ${path}.md.`);
}
async function openFile({ app }, file) { await app.workspace.getLeaf().openFile(file); return file; }
async function openFileAtHeading({ app }, file, heading) {
  const leaf = app.workspace.getLeaf();
  await leaf.openFile(file);
  const editor = leaf.view?.editor;
  if (!editor) return file;
  const content = await app.vault.cachedRead(file);
  const headingLine = content.split("\n").findIndex(line => line.trim() === heading);
  if (headingLine < 0) return file;
  const cursor = { line: headingLine + 1, ch: 0 };
  editor.setCursor(cursor);
  editor.scrollIntoView?.({ from: cursor, to: cursor }, true);
  editor.focus?.();
  return file;
}
async function renameFile({ app }, file, path) { await app.fileManager.renameFile(file, path); }
function safeFilename(value) { return String(value).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim(); }
function cleanTopic(value) { return String(value).split("/").map(safeFilename).filter(Boolean).join("/"); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function isFolder(file) { return file && Array.isArray(file.children); }
function getFrontmatter({ app }, file) { return app.metadataCache.getFileCache(file)?.frontmatter || null; }
function isArchived(path) { return path.split('/').some(part => ['archive', 'archives', '.trash'].includes(part.toLowerCase())); }
function fileLink(app, file) {
  const name = file.basename || file.path.split('/').pop().replace(/\.md$/, '');
  const key = value => value.normalize('NFC').toLowerCase();
  const collisions = app.vault.getMarkdownFiles().filter(candidate =>
    candidate.path !== file.path && key(candidate.basename) === key(name));
  // Also supports a planned file not yet in the vault (inline Area creation).
  return collisions.length ? `[[${file.path.replace(/\.md$/, '')}|${name}]]` : `[[${name}]]`;
}
function notice(message) { if (typeof Notice !== "undefined") new Notice(message); return null; }

function fmtLocal(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtMonth(value) { return fmtLocal(value).slice(0, 7); }
function offsetDays(value, days) { const d = new Date(value); d.setDate(d.getDate() + days); return d; }
function startOfDay(value) { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; }
function weekdayName(value) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(value).getDay()]; }
function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || "").trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) || fmtLocal(d)!==value.trim() ? null : startOfDay(d);
}
function weekRange(value) {
  const current = startOfDay(value);
  const monday = offsetDays(current, current.getDay() === 0 ? -6 : 1 - current.getDay());
  return { monday, start: fmtLocal(monday), end: fmtLocal(offsetDays(monday, 7)), shortEnd: fmtLocal(offsetDays(monday, 6)).slice(5) };
}
function previousMonthRange(value) {
  const d = new Date(value);
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 1);
  return { start: fmtLocal(start), end: fmtLocal(end), month: fmtMonth(start),
    previousMonth: fmtMonth(new Date(d.getFullYear(), d.getMonth() - 2, 1)), nextMonth: fmtMonth(end) };
}
function weeklyValues(org, anchor) {
  const range = weekRange(anchor), cap = capitalize(org);
  const name = r => `${r.start}--${r.shortEnd} ${cap}`;
  return { org, filename: name(range), start: range.start, end: range.end,
    previous: name(weekRange(offsetDays(range.monday, -7))), next: name(weekRange(offsetDays(range.monday, 7))) };
}
function dailyValues(orgs, anchor) {
  const range = weekRange(anchor);
  return { date: fmtLocal(anchor), previous: fmtLocal(offsetDays(anchor, -1)), next: fmtLocal(offsetDays(anchor, 1)),
    weekLines: orgs.map(org => `  - "[[${range.start}--${range.shortEnd} ${capitalize(org)}]]"`).join("\n") };
}

function nearestContext(parts, marker, beforeIndex) {
  for (let i = Math.min(beforeIndex, parts.length - 1); i >= 0; i--) if (parts[i] === marker) return parts[i + 1] || "";
  return "";
}
function relationshipLines({ meeting, project, team }) {
  return Object.entries({ meeting, project, team }).filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${JSON.stringify(wikilink(value))}`).join("\n");
}
function noteRouteValues(frontmatter) {
  const { type, topic, ...relationships } = frontmatter;
  return { typeLine: type ? `type: ${JSON.stringify(type)}` : "", topicLine: topic ? `topic: ${JSON.stringify(topic)}` : "",
    relationshipLines: Object.entries(relationships).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n") };
}
function detailsBlock() { return `## Details\n\n| | |\n|---|---|\n| Teams | |\n| Supervisor | |\n| Email | |\n| GitHub | |\n| Mobile | |\n| Board | |\n`; }
const ignored = name => /^[_.]/.test(name) || ["archive", "archives", "journal", "meetings", "references"].includes(name.toLowerCase());
function folderNames({ app }, base) {
  return (app.vault.getAbstractFileByPath(base)?.children || [])
    .filter(f => isFolder(f) && !f.name.startsWith("_") && !isArchived(f.path))
    .map(f => f.name).sort((a, b) => a.localeCompare(b));
}
function findTopLevelProjectFolders({ app }, base) {
  return (app.vault.getAbstractFileByPath(base)?.children || [])
    .filter(f => isFolder(f) && !ignored(f.name))
    .map(f => ({ name: f.name, path: f.path, label: f.name, parent: f.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
function findProjectFolders(params, base) {
  const results = [];
  const walk = folder => {
    results.push({ name: folder.name, path: folder.path, label: folder.path.slice(base.length + 1).replace(/\/projects\//g, " / ") });
    for (const child of findTopLevelProjectFolders(params, `${folder.path}/projects`)) walk(child);
  };
  for (const folder of findTopLevelProjectFolders(params, base)) walk(folder);
  return results.sort((a, b) => a.label.localeCompare(b.label));
}
function findMeetingFolders({ app }, base) {
  const results = [];
  const walk = folder => {
    if (!isFolder(folder) || isArchived(folder.path)) return;
    if (folder.name === "meetings") {
      for (const child of folder.children.filter(isFolder)) {
        const parts = child.path.split("/"), index = parts.length - 2;
        const project = nearestContext(parts, "projects", index), team = nearestContext(parts, "teams", index);
        const context = project || team;
        results.push({ name: child.name, path: child.path, project, team, label: context ? `${context} / ${child.name}` : child.name });
      }
      return;
    }
    for (const child of folder.children) if (isFolder(child) && !child.name.startsWith("_") && child.name !== "Archives") walk(child);
  };
  walk(app.vault.getAbstractFileByPath(base));
  return results.sort((a, b) => a.label.localeCompare(b.label));
}
function findFolders({ app }, base) {
  const results = [];
  const walk = folder => {
    if (!isFolder(folder) || isArchived(folder.path)) return;
    for (const child of folder.children) {
      if (!isFolder(child) || child.name.startsWith("_") || child.name === "Archives") continue;
      const topic = child.path.slice(base.length + 1);
      results.push({ name: child.name, path: child.path, label: topic, topic }); walk(child);
    }
  };
  walk(app.vault.getAbstractFileByPath(base));
  return results.sort((a, b) => a.label.localeCompare(b.label));
}
const BACK_LABEL = "← Back";
class BackSignal extends Error { constructor() { super(BACK_LABEL); this.name = "BackSignal"; } }
async function runBackable(action) {
  for (let i = 0; i < 20; i++) {
    try { return await action(); } catch (error) { if (error?.name !== "BackSignal") throw error; }
  }
  return notice("Back limit reached.");
}
async function choose({ quickAddApi }, labels, values, prompt, options = {}) {
  const back = options.back !== false;
  const result = await quickAddApi.suggester(back ? [...labels, BACK_LABEL] : labels, back ? [...values, BACK_LABEL] : values, prompt);
  if (result === undefined || (result === null && !values.includes(null))) throw new Error('Capture cancelled.');
  if (result === BACK_LABEL) throw new BackSignal();
  return result;
}
async function requiredInput({ quickAddApi }, prompt) {
  const value = await quickAddApi.inputPrompt(prompt);
  if (!value || !value.trim()) throw new Error(`${prompt} is required.`);
  return value.trim();
}
function wikilink(value) { return value.startsWith("[[") && value.endsWith("]]") ? value : `[[${value}]]`; }
function escapeYamlString(value) { return String(value).replace(/"/g, '\\"'); }
function formatWikilinkList(key, values) {
  return values.length ? `${key}:\n${values.map(value => `  - ${JSON.stringify(wikilink(value))}`).join("\n")}` : "";
}
function isDraftJournal(fm, org, file) {
  return fm.category === "journal" && fm.org === org && Boolean(fm.created) && !fm.drafted && file?.basename?.startsWith("Draft ");
}
function frontmatterValueMatchesLink(value, name) {
  return Array.isArray(value) ? value.some(item => frontmatterValueMatchesLink(item, name)) : Boolean(value) && String(value).includes(`[[${name}]]`);
}
function journalMatchesDraft(fm, file, context) {
  if (!isDraftJournal(fm, context.org, file) || (fm.type || "") !== context.type) return false;
  if (context.person) return frontmatterValueMatchesLink(fm.attendees, context.person);
  for (const key of ["meeting", "project", "team"]) if (context[key]) return frontmatterValueMatchesLink(fm[key], context[key]);
  return !fm.meeting && !fm.project && !fm.team;
}
