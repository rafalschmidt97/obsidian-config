// Raw QuickAdd user script stored as .md so Obsidian Sync includes it on mobile.
module.exports = { entry };

async function entry(params, settings = {}) {
  const org = settings.org || await defaultOrg(params);
  return await openWeekly(params, org);
}

// Name-free default org: prefer _scripts/orgs.json (falls back to orgs.example.json), then the
// first non-personal active org folder. The QuickAdd weekly choices always pass settings.org,
// so this only matters when the script is run without one.
async function defaultOrg(params) {
  const { app } = env(params);
  try {
    for (const path of ["_scripts/orgs.json", "_scripts/orgs.example.json"]) {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) continue;
      const parsed = JSON.parse(await app.vault.cachedRead(file));
      if (parsed.default) return parsed.default;
      if (Array.isArray(parsed.order) && parsed.order.length) return parsed.order[0];
    }
  } catch (e) {}
  const orgs = app.vault.getRoot().children
    .filter((child) => Array.isArray(child.children) && !child.name.startsWith("_") && !child.name.startsWith(".") && !["archive", "daily"].includes(child.name))
    .map((child) => child.name);
  return orgs.find((org) => org !== "personal") || orgs[0] || "personal";
}

async function openWeekly(params, org) {
  const { app, quickAddApi } = env(params);
  const orgCap = capitalize(org);
  const range = weekRange(new Date());
  const previous = weekRange(offsetDays(range.monday, -7));
  const next = weekRange(offsetDays(range.monday, 7));
  const filename = `${range.start}--${range.shortEnd} ${orgCap}`;
  const filepath = `${org}/weekly/${filename}.md`;
  const existing = app.vault.getAbstractFileByPath(filepath);
  if (existing) return await openFile(params, existing);

  const content = render(await readVaultFile(params, "_templates/Weekly.md"), {
    org,
    created: quickAddApi.date.now("YYYY-MM-DDTHH:mm"),
    start: range.start,
    end: range.end,
    previous: `${previous.start}--${previous.shortEnd} ${orgCap}`,
    next: `${next.start}--${next.shortEnd} ${orgCap}`,
  });

  await ensureFolder(params, `${org}/weekly`);
  const file = await app.vault.create(filepath, content);
  return await openFile(params, file);
}

async function openFile(params, file) {
  await env(params).app.workspace.getLeaf().openFile(file);
  return file;
}

async function ensureFolder(params, folderPath) {
  const { app } = env(params);
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

async function readVaultFile(params, path) {
  const file = env(params).app.vault.getAbstractFileByPath(path);
  if (!file) throw new Error(`Template not found: ${path}`);
  return await env(params).app.vault.cachedRead(file);
}

function render(template, values) {
  return stripEmptyFrontmatterLines(template.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? ""));
}

function stripEmptyFrontmatterLines(content) {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  const frontmatter = content.slice(4, end).split("\n").filter((line) => line.trim().length > 0).join("\n");
  return `---\n${frontmatter}${content.slice(end)}`;
}

function weekRange(dateValue) {
  const current = new Date(dateValue);
  const day = current.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMon);
  const sunday = offsetDays(monday, 6);
  const nextMonday = offsetDays(monday, 7);
  return { monday, start: fmt(monday), end: fmt(nextMonday), shortEnd: fmt(sunday).slice(5) };
}

function offsetDays(dateValue, days) {
  const result = new Date(dateValue);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(dateValue) {
  const d = new Date(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function env(params) {
  return { app: params.app, quickAddApi: params.quickAddApi };
}
