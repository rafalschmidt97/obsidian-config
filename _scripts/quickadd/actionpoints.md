// Raw JavaScript stored as .md so Obsidian Sync includes it on mobile.
// Generated-view maintenance script (peer to journal.md / templates.md): regenerates
// {org}/bases/{Org} Tasks.md, {Org} Priority.md, and {Org} Wishlist.md from open checklist items in
// the `## Tasks` section of weekly notes, journals, projects, and books (books are personal-only). A `#wl`
// marker diverts an item to the Wishlist backlog (out of Tasks); a `#prio` marker additionally lists
// it in Priority (a focused subset — it stays in Tasks). Source notes are the source of truth; these
// files are read-only snapshots.
// Shared helpers load through the vault API inside each invocation.

module.exports = Object.fromEntries(["entry", "actionPoints", "actionPointsAuto"].map(name => [name, async (params, ...args) => {
  const file = params.app.vault.getAbstractFileByPath("_scripts/shared/runtime.md");
  if (!file) throw new Error("Shared runtime missing: _scripts/shared/runtime.md");
  const runtime = new Function("module", `${await params.app.vault.read(file)}\nreturn module.exports;`)({ exports: {} });
  return (await createFlows(await runtime.create(params.app)))[name](params, ...args);
}]));

async function createFlows(shared) {
const { runBackable, choose, orgFolders, ensureFolder, openFile, getFrontmatter, capitalize, notice, isArchived, fileLink } = shared;

const IGNORED_STATUSES = new Set(["archived", "obsolete"]);

// `#wl` and `#prio` are body-level task markers. In an open checklist line, `#wl` diverts the item
// to the Wishlist (out of Tasks) and is stripped from the Wishlist output; `#prio` additionally lists
// it in Priority while keeping it in Tasks, and is left visible in both (so those items read exactly
// as authored). `#wldeck` / `#prios` / nested `#wl/foo` do not match. Matching is case-insensitive.
const WISHLIST_PATTERN = /(?:^|\s)#wl(?![\w/-])/i;
const PRIO_PATTERN = /(?:^|\s)#prio(?![\w/-])/i;
const stripWishlist = (text) => text
  .replace(/(?:^|\s)#wl(?![\w/-])/ig, " ")
  .replace(/\s{2,}/g, " ")
  .trim();
const TASKS_INTRO = "Weekly notes, journals, projects, and books are the source of truth. Edit tasks in the source note; this file is regenerated and does not sync checkbox changes back.";
const PRIORITY_INTRO = "Focused view of `#prio`-tagged open tasks from the same `## Tasks` sections in weekly notes, journals, projects, and books — these also remain in Tasks. The source note is the source of truth; this file is regenerated and does not sync checkbox changes back. Delete the `#prio` tag in the source to drop an item from Priority.";
const WISHLIST_INTRO = "Backlog of `#wl`-tagged items pulled from the same `## Tasks` sections in weekly notes, journals, projects, and books — later / someday, not active work. The source note is the source of truth; this file is regenerated and does not sync checkbox changes back. Delete the `#wl` tag in the source to promote an item back to Tasks.";

return {
  entry,
  actionPoints,
  actionPointsAuto,
};

// QuickAdd entry point. The manual `Tasks` choice passes settings.flow "actionPoints"; the
// hidden runOnStartup choice passes "actionPointsAuto". No flow -> manual.
async function entry(params, settings = {}) {
  const flows = { actionPoints, actionPointsAuto };
  const flow = settings.flow ? flows[settings.flow] : actionPoints;
  if (!flow) throw new Error(`Unknown action-points flow: ${settings.flow}`);
  return await flow(params);
}

function tasksPathForOrg(org) { return `${org}/bases/${capitalize(org)} Tasks.md`; }
function priorityPathForOrg(org) { return `${org}/bases/${capitalize(org)} Priority.md`; }
function wishlistPathForOrg(org) { return `${org}/bases/${capitalize(org)} Wishlist.md`; }

// Manual flow: pick an org (or all), regenerate all three snapshots, then open one of Tasks /
// Priority / Wishlist. "all" refreshes every active org and opens nothing. ← Back from the open
// picker returns to the org picker via runBackable.
async function actionPoints(params) {
  return await runBackable(async () => {
    const orgs = orgFolders(params);
    const scope = await choose(params, ["all", ...orgs], ["all", ...orgs], "org?", { back: false });
    const targets = scope === "all" ? orgs : [scope];
    for (const org of targets) await refreshViews(params, org);
    notice(`Refreshed tasks + priority + wishlist for ${scope === "all" ? "all orgs" : scope}.`);
    if (scope === "all") return null;

    const view = await choose(params, ["tasks", "priority", "wishlist"], ["tasks", "priority", "wishlist"], "open?");
    const path = view === "wishlist" ? wishlistPathForOrg(scope)
      : view === "priority" ? priorityPathForOrg(scope)
      : tasksPathForOrg(scope);
    const file = env(params).app.vault.getAbstractFileByPath(path);
    return file ? await openFile(params, file) : null;
  });
}

// Silent all-orgs refresh, wired to a hidden QuickAdd choice with runOnStartup: true so the
// snapshots are current every launch. No prompts, opens nothing. Waits for the metadata cache
// first, otherwise a cold start could read half-indexed frontmatter and write partial files.
async function actionPointsAuto(params) {
  await whenMetadataReady(params);
  for (const org of orgFolders(params)) await refreshViews(params, org);
}

// Resolve once the metadata cache has finished indexing. The 'resolved' event fires a single time
// after initial load, so if it already fired (warm cache, mid-session) this races a timeout and
// proceeds. Never hangs.
async function whenMetadataReady(params, timeoutMs = 4000) {
  const { app } = env(params);
  await new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    let ref;
    try {
      ref = app.metadataCache.on("resolved", () => { if (ref) app.metadataCache.offref(ref); done(); });
    } catch (e) {}
    setTimeout(done, timeoutMs);
  });
}

async function refreshViews(params, org) {
  const { quickAddApi } = env(params);
  await ensureFolder(params, `${org}/bases`);
  const generatedAt = quickAddApi.date.now("YYYY-MM-DDTHH:mm");
  const weekly = await collectGroups(params, org, "weekly", "Tasks");
  const journal = await collectGroups(params, org, "journal", "Tasks");
  const project = await collectGroups(params, org, "project", "Tasks");
  const area = await collectGroups(params, org, "area", "Tasks");
  const book = await collectGroups(params, org, "book", "Tasks");

  await writeView(params, tasksPathForOrg(org), renderSnapshot(org, generatedAt, "Tasks", TASKS_INTRO, [
    { heading: "Weekly Tasks", groups: weekly.actionGroups, empty: "No open weekly tasks found." },
    { heading: "Journal Tasks", groups: journal.actionGroups, empty: "No open journal tasks found." },
    ...(area.actionGroups.length ? [{ heading: "Area Tasks", groups: area.actionGroups, empty: "" }] : []),
    ...(project.actionGroups.length ? [{ heading: "Project Tasks", groups: project.actionGroups, empty: "" }] : []),
    ...(book.actionGroups.length ? [{ heading: "Book Tasks", groups: book.actionGroups, empty: "" }] : []),
  ]));
  await writeView(params, priorityPathForOrg(org), renderSnapshot(org, generatedAt, "Priority", PRIORITY_INTRO, [
    { heading: "Weekly Tasks", groups: weekly.priorityGroups, empty: "No priority weekly tasks found." },
    { heading: "Journal Tasks", groups: journal.priorityGroups, empty: "No priority journal tasks found." },
    ...(area.priorityGroups.length ? [{ heading: "Area Tasks", groups: area.priorityGroups, empty: "" }] : []),
    ...(project.priorityGroups.length ? [{ heading: "Project Tasks", groups: project.priorityGroups, empty: "" }] : []),
    ...(book.priorityGroups.length ? [{ heading: "Book Tasks", groups: book.priorityGroups, empty: "" }] : []),
  ]));
  await writeView(params, wishlistPathForOrg(org), renderSnapshot(org, generatedAt, "Wishlist", WISHLIST_INTRO, [
    { heading: "Weekly Tasks", groups: weekly.wishlistGroups, empty: "No wishlist weekly tasks found." },
    { heading: "Journal Tasks", groups: journal.wishlistGroups, empty: "No wishlist journal tasks found." },
    ...(area.wishlistGroups.length ? [{ heading: "Area Tasks", groups: area.wishlistGroups, empty: "" }] : []),
    ...(project.wishlistGroups.length ? [{ heading: "Project Tasks", groups: project.wishlistGroups, empty: "" }] : []),
    ...(book.wishlistGroups.length ? [{ heading: "Book Tasks", groups: book.wishlistGroups, empty: "" }] : []),
  ]));
}

async function writeView(params, path, content) {
  const { app } = env(params);
  const file = app.vault.getAbstractFileByPath(path);
  if (file) await app.vault.modify(file, content);
  else await app.vault.create(path, content);
}

function sourceFilesForOrg(params, org, category) {
  const { app } = env(params);
  return app.vault.getMarkdownFiles()
    .filter((file) => !isArchived(file.path))
    .filter((file) => file.path.startsWith(`${org}/`))
    .filter((file) => {
      const fm = getFrontmatter(params, file);
      if (!fm) return false;
      return fm.org === org && fm.category === category && !IGNORED_STATUSES.has(String(fm.status || ""));
    })
    .sort((a, b) => {
      const af = getFrontmatter(params, a) || {};
      const bf = getFrontmatter(params, b) || {};
      const ad = String(af.start || af.created || "");
      const bd = String(bf.start || bf.created || "");
      return bd.localeCompare(ad) || a.path.localeCompare(b.path);
    });
}

function sectionsNamed(content, headingName) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  const headingPattern = new RegExp(`^##\\s+${headingName}\\s*$`, "i");
  for (let i = 0; i < lines.length; i++) {
    if (!headingPattern.test(lines[i].trim())) continue;
    const section = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^##\s+/.test(lines[j])) break;
      section.push(lines[j]);
    }
    sections.push(section);
  }
  return sections;
}

function openChecklistItems(sections) {
  return sections
    .flatMap((section) => section)
    .map((line) => line.match(/^\s*[-*]\s+\[ \]\s+(.+)$/))
    .filter(Boolean)
    .map((match) => match[1].trim())
    .filter(Boolean);
}

async function collectGroups(params, org, category, sectionName) {
  const { app } = env(params);
  const actionGroups = [];
  const priorityGroups = [];
  const wishlistGroups = [];
  for (const file of sourceFilesForOrg(params, org, category)) {
    const content = await app.vault.cachedRead(file);
    const items = openChecklistItems(sectionsNamed(content, sectionName));
    const actionItems = [];
    const priorityItems = [];
    const wishlistItems = [];
    for (const item of items) {
      if (WISHLIST_PATTERN.test(item)) {
        // #wl diverts out of Tasks into the Wishlist backlog; strip the marker (it defines the view).
        wishlistItems.push(stripWishlist(item));
      } else {
        // Active task: kept verbatim so the #prio marker stays visible. Always in Tasks; also in
        // Priority when #prio-tagged (subset, not a diversion).
        actionItems.push(item);
        if (PRIO_PATTERN.test(item)) priorityItems.push(item);
      }
    }
    if (actionItems.length > 0) actionGroups.push({ file, items: actionItems });
    if (priorityItems.length > 0) priorityGroups.push({ file, items: priorityItems });
    if (wishlistItems.length > 0) wishlistGroups.push({ file, items: wishlistItems });
  }
  return { actionGroups, priorityGroups, wishlistGroups };
}

function linkTo(file) {
  return fileLink(file);
}

function appendGroups(lines, heading, groups, emptyText) {
  lines.push(`## ${heading}`);
  lines.push("");
  if (groups.length === 0) {
    lines.push(emptyText);
    lines.push("");
    return;
  }
  for (const group of groups) {
    lines.push(`### ${linkTo(group.file)}`);
    lines.push("");
    for (const item of group.items) lines.push(`- [ ] ${item}`);
    lines.push("");
  }
}

function renderSnapshot(org, generatedAt, title, intro, sections) {
  const lines = [
    "---",
    `org: ${org}`,
    "category: index",
    `created: ${generatedAt}`,
    "---",
    "",
    `# ${capitalize(org)} ${title}`,
    "",
    intro,
    "",
  ];
  for (const section of sections) appendGroups(lines, section.heading, section.groups, section.empty);
  return `${lines.join("\n").trimEnd()}\n`;
}

function env(params) {
  return { app: params.app, quickAddApi: params.quickAddApi };
}
}
