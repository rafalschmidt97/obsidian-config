// Raw JavaScript stored as .md so Obsidian Sync includes it on mobile.
const TEMPLATE_DIR = "_templates";

const TEMPLATE = {
  note: `${TEMPLATE_DIR}/Note.md`,
  person: `${TEMPLATE_DIR}/Person.md`,
  meeting: `${TEMPLATE_DIR}/Meeting.md`,
  project: `${TEMPLATE_DIR}/Project.md`,
  team: `${TEMPLATE_DIR}/Team.md`,
  book: `${TEMPLATE_DIR}/Book.md`,
  clipping: `${TEMPLATE_DIR}/Clipping.md`,
  invoice: `${TEMPLATE_DIR}/Invoice.md`,
  place: `${TEMPLATE_DIR}/Place.md`,
  trip: `${TEMPLATE_DIR}/Trip.md`,
  transcript: `${TEMPLATE_DIR}/Transcript.md`,
  daily: `${TEMPLATE_DIR}/Daily.md`,
  weekly: `${TEMPLATE_DIR}/Weekly.md`,
  monthly: `${TEMPLATE_DIR}/Monthly Reflection.md`,
  mealPlan: `${TEMPLATE_DIR}/Meal Plan.md`,
};

const IGNORED_PROJECT_FOLDERS = new Set(["journal", "meetings", "references", "Archives", "_attachments"]);
const IGNORED_FOLDERS = new Set(["Archives", "_attachments"]);
const IGNORED_ORG_FOLDERS = new Set(["archive", "daily"]);
// Org priority is data, not code. Real values live in _scripts/orgs.json (git-ignored);
// _scripts/orgs.example.json is the shared template. Loaded once per run by loadOrgConfig().
// Empty ORG_ORDER falls back to a name-free rule (see sortOrgNames): alphabetical, personal last.
let ORG_ORDER = [];
const BACK_LABEL = "← Back";

module.exports = {
  entry,
  inbox,
  triage,
  archive,
  note,
  person,
  meeting,
  project,
  team,
  book,
  clipping,
  invoice,
  document,
  place,
  trip,
  transcript,
  daily,
  weekly,
  monthlyReflection,
  mealPlan,
  periodicAuto,
};

async function entry(params, settings = {}) {
  await loadOrgConfig(params);
  return await runBackable(async () => {
    const flowByName = {
      inbox,
      triage,
      archive,
      note,
      person,
      meeting,
      project,
      team,
      book,
      clipping,
      invoice,
      document,
      place,
      trip,
      transcript,
      daily,
      weekly,
      monthlyReflection,
      mealPlan,
      periodicAuto,
    };
    if (settings.flow) {
      const flow = flowByName[settings.flow];
      if (!flow) throw new Error(`Unknown templates flow: ${settings.flow}`);
      return await flow(params);
    }

    const labels = [
      "inbox",
      "triage",
      "archive",
      "note",
      "person",
      "meeting",
      "project",
      "team",
      "book",
      "clipping",
      "invoice",
      "document",
      "place",
      "trip",
      "transcript",
      "daily",
      "weekly",
      "monthly reflection",
    ];
    const flows = [inbox, triage, archive, note, person, meeting, project, team, book, clipping, invoice, document, place, trip, transcript, daily, weekly, monthlyReflection];
    const flow = await choose(params, labels, flows, "template?", { back: false });
    return await flow(params);
  });
}

async function inbox(params) {
  return await createFromTemplate(params, TEMPLATE.note, `personal/inbox/${inboxStamp(params)}`, {
    org: "personal",
    typeLine: "type: inbox",
    topicLine: "",
    relationshipLines: "",
    body: "",
  });
}

async function note(params) {
  const org = await chooseOrg(params);
  const destination = await choose(params,
    ["inbox", "notes", "meetings", "projects", "people", "teams"],
    ["inbox", "notes", "meetings", "projects", "people", "teams"],
    "where?"
  );

  if (destination === "inbox") {
    return await createFromTemplate(params, TEMPLATE.note, `${org}/inbox/${inboxStamp(params)}`, {
      org,
      typeLine: "type: inbox",
      topicLine: "",
      relationshipLines: "",
      body: "",
    });
  }

  const route = await noteRouteFor(params, org, destination);
  if (!route) return null;

  const title = await requiredInput(params, "title?");
  return await createFromTemplate(params, TEMPLATE.note, `${route.targetFolder}/${safeFilename(title)}`, {
    org,
    typeLine: valueFor(route.lines, "typeLine"),
    topicLine: valueFor(route.lines, "topicLine"),
    relationshipLines: valueFor(route.lines, "relationshipLines"),
    body: "",
  });
}

// Resolves a non-inbox note destination into { targetFolder, lines }. `lines` carry rendered
// typeLine/topicLine/relationshipLines. Shared by note creation and inbox triage so both route
// notes identically. Returns null when a required sub-selection is unavailable.
async function noteRouteFor(params, org, destination) {
  const lines = [];
  let targetFolder = "";

  if (destination === "notes") {
    const selected = await chooseNoteFolder(params, org);
    targetFolder = selected.path;
    if (selected.topic) {
      if (selected.topic === "references" || selected.topic.startsWith("references/")) lines.push({ key: "typeLine", value: "type: reference" });
      lines.push({ key: "topicLine", value: `topic: "${selected.topic}"` });
    }
  } else if (destination === "meetings") {
    const selected = await chooseMeeting(params, org);
    targetFolder = selected.path;
    lines.push({ key: "relationshipLines", value: relationshipLines({ meeting: selected.name, project: selected.project, team: selected.team }) });
  } else if (destination === "projects") {
    const selected = await chooseProject(params, org);
    targetFolder = selected.path;
    lines.push({ key: "relationshipLines", value: `project: "[[${selected.name}]]"` });
  } else if (destination === "people") {
    const name = await chooseFolderName(params, `${org}/people`, "person?");
    if (!name) return null;
    targetFolder = `${org}/people/${name}`;
    lines.push({ key: "relationshipLines", value: `attendees: ["[[${name}]]"]` });
  } else if (destination === "teams") {
    const name = await chooseFolderName(params, `${org}/teams`, "team?");
    if (!name) return null;
    targetFolder = `${org}/teams/${name}`;
    lines.push({ key: "relationshipLines", value: `team: "[[${name}]]"` });
  } else {
    throw new Error(`Unknown note destination: ${destination}`);
  }

  return { targetFolder, lines };
}

// Triage entry point: list every inbox note (newest first). Pick one, then choose an action —
// move (route it into a real note folder), open (just open it), or delete (send to local trash).
// Wrapped in runBackable so ← Back from the action menu returns to the note list.
async function triage(params) {
  return await runBackable(async () => {
    const inboxNotes = findInboxNotes(params);
    if (inboxNotes.length === 0) throw new Error("No inbox notes to triage.");

    const source = await choose(params, inboxNotes.map((item) => item.label), inboxNotes.map((item) => item.file), "note?", { back: false });

    const action = await choose(params, ["move", "open", "delete"], ["move", "open", "delete"], "action?");
    if (action === "open") return await openFile(params, source);
    if (action === "delete") return await deleteInboxNote(params, source);
    return await moveInboxNote(params, source);
  });
}

// Move an inbox note into a real note route, dropping type: inbox and preserving the original
// created value and the note body. Same routing as the note flow, minus the inbox destination
// (you cannot triage inbox into inbox).
async function moveInboxNote(params, source) {
  const org = await chooseOrg(params);
  const destination = await choose(params,
    ["notes", "meetings", "projects", "people", "teams"],
    ["notes", "meetings", "projects", "people", "teams"],
    "where?"
  );
  const route = await noteRouteFor(params, org, destination);
  if (!route) return null;

  const title = await requiredInput(params, "title?");
  const targetPath = await uniqueMarkdownPath(params, `${route.targetFolder}/${safeFilename(title)}`);

  await retagInboxNote(params, source, org, route.lines);
  await ensureFolder(params, targetPath.split("/").slice(0, -1).join("/"));
  await env(params).app.fileManager.renameFile(source, targetPath);
  return await openFile(params, source);
}

// Send an inbox note to the local trash after confirmation. Matches the vault trashOption: local
// convention used by the cleanup script (system flag false -> vault .trash/). Uses a suggester
// prompt rather than window.confirm so it works on mobile.
async function deleteInboxNote(params, source) {
  const { app } = env(params);
  const confirm = await choose(params, ["no", "yes"], ["no", "yes"], `delete "${source.basename}"?`, { back: false });
  if (confirm !== "yes") return null;
  if (app.vault.trash) await app.vault.trash(source, false);
  else await app.vault.delete(source);
  notice(`Moved "${source.basename}" to trash.`);
  return null;
}

// Archive flow (peer to triage): pick org -> what? (project/person/team/meeting) -> the concrete
// entity, then MOVE that whole folder (profile + every note/journal/meeting under it) to
// archive/{org}/<same relative path>. Move-only: no frontmatter is touched, so it also works by
// hand in Finder. Archived notes keep org: work, so the live org Bases exclude the archive/
// tree by path (see the file.path filters in {org}/bases and actionpoints.md). Whole entity folders
// move as a unit, so a live entity never ends up pointing at archived children elsewhere.
// You can never select an org or a bare category root, so "archive all of work" is impossible.
async function archive(params) {
  const { app } = env(params);
  return await runBackable(async () => {
    const org = await chooseOrg(params);
    const what = await choose(params,
      ["project", "person", "team", "meeting"],
      ["project", "person", "team", "meeting"],
      "what?"
    );

    let sourceFolder = null;
    if (what === "project") {
      const projects = findProjectFolders(params, `${org}/projects`);
      if (projects.length === 0) return notice(`No projects under ${org}/projects.`);
      const selected = await choose(params, projects.map((p) => p.label), projects, "project?");
      sourceFolder = selected.path;
    } else if (what === "person") {
      const name = await chooseFolderName(params, `${org}/people`, "person?");
      if (!name) return notice(`No people under ${org}/people.`);
      sourceFolder = `${org}/people/${name}`;
    } else if (what === "team") {
      const name = await chooseFolderName(params, `${org}/teams`, "team?");
      if (!name) return notice(`No teams under ${org}/teams.`);
      sourceFolder = `${org}/teams/${name}`;
    } else if (what === "meeting") {
      const meetings = findMeetingFolders(params, org);
      if (meetings.length === 0) return notice(`No meetings under ${org}.`);
      const selected = await choose(params, meetings.map((m) => m.label), meetings, "meeting?");
      sourceFolder = selected.path;
    }

    if (!isArchivableEntityPath(org, sourceFolder)) {
      return notice(`Refusing to archive "${sourceFolder}": pick a specific entity, not an org or category root.`);
    }

    const folder = app.vault.getAbstractFileByPath(sourceFolder);
    if (!isFolder(folder)) return notice(`Not a folder: ${sourceFolder}`);

    const count = countMarkdownFiles(folder);
    const confirm = await choose(params, ["no", "yes"], ["no", "yes"], `archive "${sourceFolder}" (${count} notes)?`, { back: false });
    if (confirm !== "yes") return null;

    await ensureFolder(params, `archive/${sourceFolder.split("/").slice(0, -1).join("/")}`);
    const dest = await uniqueFolderPath(params, `archive/${sourceFolder}`);
    await app.fileManager.renameFile(folder, dest);
    notice(`Archived ${sourceFolder} → ${dest} (${count} notes).`);
    return null;
  });
}

// Guard: only a concrete entity folder may be archived — {org}/{projects|people|teams|meetings}/{name...}
// with at least three path segments. Rejects an org root ({org}) or a bare category root
// ({org}/projects) so the script can never archive an entire org.
function isArchivableEntityPath(org, path) {
  if (!path) return false;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) return false;
  if (parts[0] !== org || parts[0] === "archive") return false;
  return new Set(["projects", "people", "teams", "meetings"]).has(parts[1]);
}

function countMarkdownFiles(folder) {
  let total = 0;
  const walk = (current) => {
    for (const child of current.children) {
      if (isFolder(child)) walk(child);
      else if (child.path.endsWith(".md")) total += 1;
    }
  };
  walk(folder);
  return total;
}

async function uniqueFolderPath(params, path) {
  const { app } = env(params);
  if (!app.vault.getAbstractFileByPath(path)) return path;
  for (let index = 1; index < 100; index++) {
    const candidate = `${path} (${index})`;
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  }
  throw new Error(`Could not find a unique archive path for ${path}.`);
}

async function person(params) {
  const org = await chooseOrg(params);
  const name = await requiredInput(params, "person?");
  const folder = `${org}/people/${safeFilename(name)}`;
  return await createFromTemplate(params, TEMPLATE.person, `${folder}/${safeFilename(name)}`, {
    org,
    detailsBlock: org === "personal" ? "" : detailsBlock(),
  });
}

async function meeting(params) {
  const { quickAddApi } = env(params);
  const org = await chooseOrg(params);
  const destination = await choose(params,
    ["meetings", "projects", "teams"],
    ["meetings", "projects", "teams"],
    "where?"
  );
  let targetBase = `${org}/meetings`;
  let contextLine = "";

  if (destination === "projects") {
    const selected = await chooseProject(params, org);
    targetBase = `${selected.path}/meetings`;
    contextLine = `project: "[[${selected.name}]]"`;
  } else if (destination === "teams") {
    const name = await chooseFolderName(params, `${org}/teams`, "team?");
    if (!name) return null;
    targetBase = `${org}/teams/${name}/meetings`;
    contextLine = `team: "[[${name}]]"`;
  }

  const name = await requiredInput(params, "meeting?");
  const folder = `${targetBase}/${safeFilename(name)}`;
  return await createFromTemplate(params, TEMPLATE.meeting, `${folder}/${safeFilename(name)}`, { org, contextLine });
}

async function project(params) {
  const { quickAddApi } = env(params);
  const org = await chooseOrg(params);
  const basePath = `${org}/projects`;
  const existing = findTopLevelProjectFolders(params, basePath);
  const where = await choose(params,
    ["projects", ...existing.map((item) => item.label)],
    [{ label: "projects", path: basePath, parent: null }, ...existing],
    "where?"
  );
  const name = await requiredInput(params, "project?");
  const folder = where.parent === null ? `${basePath}/${safeFilename(name)}` : `${where.path}/projects/${safeFilename(name)}`;
  const parentLine = where.parent === null ? "" : `parent: "[[${where.name}]]"`;
  return await createFromTemplate(params, TEMPLATE.project, `${folder}/${safeFilename(name)}`, { org, parentLine });
}

async function team(params) {
  const org = await chooseNonPersonalOrg(params);
  const name = await requiredInput(params, "team?");
  return await createFromTemplate(params, TEMPLATE.team, `${org}/teams/${safeFilename(name)}`, { org });
}

async function book(params) {
  const { quickAddApi } = env(params);
  const route = await choose(params, ["books", "read", "reading", "interview"], ["books", "read", "reading", "interview"], "where?", { back: false });
  const title = await requiredInput(params, "title?");
  const folder = route === "books" ? "personal/notes/books" : `personal/notes/books/${route}`;
  const topicLine = route === "reading" || route === "interview" ? `topic: ${route}` : "";
  return await createFromTemplate(params, TEMPLATE.book, `${folder}/${safeFilename(title)}`, { topicLine });
}

async function clipping(params) {
  const { quickAddApi } = env(params);
  const org = await chooseOrg(params);
  const type = await choose(params, ["read", "listen", "watch"], ["read", "listen", "watch"], "type?");
  const title = await requiredInput(params, "title?");
  return await createFromTemplate(params, TEMPLATE.clipping, `${org}/notes/clippings/${type}/${safeFilename(title)}`, { org, type });
}

async function invoice(params) {
  const { quickAddApi } = env(params);
  const topic = await choose(params,
    ["assets/finances/invoices", "healthcare", "assets/car", "assets/house"],
    ["assets/finances/invoices", "healthcare", "assets/car", "assets/house"],
    "topic?",
    { back: false }
  );
  const title = await requiredInput(params, "title?");
  const folder = topic === "assets/finances/invoices" ? "personal/notes/assets/finances/invoices" : `personal/notes/${topic}`;
  return await createFromTemplate(params, TEMPLATE.invoice, `${folder}/${date(params)} ${safeFilename(title)}`, { topic });
}

async function document(params) {
  const topic = await choose(params,
    ["documents", "healthcare", "assets/car", "assets/house", "assets/finances", "career"],
    ["documents", "healthcare", "assets/car", "assets/house", "assets/finances", "career"],
    "topic?",
    { back: false }
  );
  const title = await requiredInput(params, "title?");
  const folder = topic === "documents" ? "personal/notes/documents" : `personal/notes/${topic}`;
  return await createFromTemplate(params, TEMPLATE.note, `${folder}/${safeFilename(title)}`, {
    org: "personal",
    typeLine: "",
    topicLine: `topic: "${topic}"`,
    relationshipLines: "",
    body: "",
  });
}

async function place(params) {
  const { quickAddApi } = env(params);
  const type = await choose(params, ["entry", "recommendation"], ["entry", "recommendation"], "type?", { back: false });
  const topic = await choose(params,
    ["places/restaurant", "places/bar", "places/cafe", "places/spot", "places/city", "places/country"],
    ["places/restaurant", "places/bar", "places/cafe", "places/spot", "places/city", "places/country"],
    "topic?"
  );
  const title = await requiredInput(params, "title?");
  return await createFromTemplate(params, TEMPLATE.place, `personal/notes/places/${safeFilename(title)}`, { type, topic });
}

async function trip(params) {
  const { quickAddApi } = env(params);
  const type = await choose(params, ["entry", "recommendation"], ["entry", "recommendation"], "type?", { back: false });
  const topic = await quickAddApi.inputPrompt("topic?", "optional");
  let dateLines = "";
  if (type === "entry") {
    const start = await quickAddApi.inputPrompt("start?", "YYYY-MM-DD");
    const end = await quickAddApi.inputPrompt("end?", "YYYY-MM-DD");
    dateLines = `start: ${start || ""}\nend: ${end || ""}`;
  }
  const title = await requiredInput(params, "title?");
  return await createFromTemplate(params, TEMPLATE.trip, `personal/notes/trips/${safeFilename(title)}`, {
    type,
    topicLine: topic ? `topic: "${topic}"` : "",
    dateLines,
  });
}

async function transcript(params) {
  const org = await chooseOrg(params);
  const journals = findJournalNotes(params, org);
  const standalone = { kind: "standalone", label: "no journal (standalone)" };
  const options = [
    ...journals.map((item) => ({ kind: "journal", file: item.file, label: item.label })),
    standalone,
  ];
  const selected = await choose(params, options.map((item) => item.label), options, "journal?");

  const targetFolder = `${org}/notes/transcripts`;
  let journalLine = "";
  let filename;
  let journalFile = null;
  if (selected.kind === "journal") {
    journalFile = selected.file;
    journalLine = `journal: "[[${journalFile.basename}]]"`;
    filename = `${safeFilename(journalFile.basename)} - Transcript`;
  } else {
    const title = await requiredInput(params, "title?");
    filename = `${date(params)} ${safeFilename(title)} - Transcript`;
  }

  const file = await createFromTemplate(params, TEMPLATE.transcript, `${targetFolder}/${filename}`, {
    org,
    journalLine,
    body: "",
  });

  if (journalFile) await linkTranscriptToJournal(params, journalFile, file.basename);
  return file;
}

async function linkTranscriptToJournal(params, journalFile, transcriptBasename) {
  const { app } = env(params);
  await app.fileManager.processFrontMatter(journalFile, (frontmatter) => {
    frontmatter.transcript = `[[${transcriptBasename}]]`;
  });
}

async function daily(params) {
  const base = await chooseDailyDate(params);
  const day = fmtLocal(base);
  const target = `daily/${day}`;
  const existing = env(params).app.vault.getAbstractFileByPath(`${target}.md`);
  if (existing) return await openFile(params, existing);
  const range = weekRange(base);
  return await createFromTemplate(params, TEMPLATE.daily, target, {
    date: day,
    previous: fmtLocal(offsetDays(base, -1)),
    next: fmtLocal(offsetDays(base, 1)),
    weekLines: weeklyLinkLines(params, range),
  });
}

async function chooseDailyDate(params) {
  const today = startOfDay(new Date());

  const options = [];
  for (let offset = 0; offset <= 7; offset += 1) {
    const value = offsetDays(today, -offset);
    const day = fmtLocal(value);
    const exists = !!env(params).app.vault.getAbstractFileByPath(`daily/${day}.md`);
    let label = day;
    if (offset === 0) label = `today · ${day}`;
    else if (offset === 1) label = `yesterday · ${day}`;
    else label = `${weekdayName(value)} · ${day}`;
    if (exists) label += " (exists)";
    options.push({ label, value });
  }
  options.push({ label: "pick a date…", value: "__manual__" });

  const selected = await choose(
    params,
    options.map((item) => item.label),
    options.map((item) => item.value),
    "which day?",
    { back: false }
  );

  if (selected === "__manual__") {
    const input = await requiredInput(params, "date (YYYY-MM-DD)?");
    const parsed = parseDay(input);
    if (!parsed) throw new Error(`Invalid date: ${input}. Use YYYY-MM-DD.`);
    return parsed;
  }
  return selected;
}

function startOfDay(dateValue) {
  const result = new Date(dateValue);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekdayName(dateValue) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateValue).getDay()];
}

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || "").trim());
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

async function weekly(params) {
  const org = await chooseOrg(params);
  const cap = capitalize(org);
  const range = weekRange(new Date());
  const prev = weekRange(offsetDays(range.monday, -7));
  const next = weekRange(offsetDays(range.monday, 7));
  const filename = `${range.start}--${range.shortEnd} ${cap}`;
  const existing = env(params).app.vault.getAbstractFileByPath(`${org}/weekly/${filename}.md`);
  if (existing) return await openFile(params, existing);
  return await createFromTemplate(params, TEMPLATE.weekly, `${org}/weekly/${filename}`, {
    org,
    start: range.start,
    end: range.end,
    previous: `${prev.start}--${prev.shortEnd} ${cap}`,
    next: `${next.start}--${next.shortEnd} ${cap}`,
  });
}

async function monthlyReflection(params) {
  const org = await chooseOrg(params);
  const cap = capitalize(org);
  const range = previousMonthRange(new Date());
  const filename = `${range.month} ${cap} Monthly Reflection`;
  const existing = env(params).app.vault.getAbstractFileByPath(`${org}/journal/${filename}.md`);
  if (existing) return await openFile(params, existing);
  return await createFromTemplate(params, TEMPLATE.monthly, `${org}/journal/${filename}`, {
    org,
    start: range.start,
    end: range.end,
    previous: `${range.previousMonth} ${cap} Monthly Reflection`,
    next: `${range.nextMonth} ${cap} Monthly Reflection`,
  });
}

async function mealPlan(params) {
  const { folder, planName } = await loadMealPlanConfig(params);
  const base = await chooseMealWeek(params, folder, planName);
  const range = weekRange(base);
  const prev = weekRange(offsetDays(range.monday, -7));
  const next = weekRange(offsetDays(range.monday, 7));
  const filename = `${range.start}--${range.shortEnd} ${planName}`;
  const existing = env(params).app.vault.getAbstractFileByPath(`${folder}/${filename}.md`);
  if (existing) return await openFile(params, existing);
  return await createFromTemplate(params, TEMPLATE.mealPlan, `${folder}/${filename}`, {
    start: range.start,
    end: range.end,
    previous: `${prev.start}--${prev.shortEnd} ${planName}`,
    next: `${next.start}--${next.shortEnd} ${planName}`,
  });
}

// Meal-plan placement is household-specific, so it lives in _scripts/mealplan.json
// (git-ignored), with _scripts/mealplan.example.json as the shared template and a
// generic fallback here. Never throws.
async function loadMealPlanConfig(params) {
  const fallback = { folder: "personal/projects/Meal Plan", planName: "Cooking Schedule" };
  try {
    const { app } = env(params);
    for (const path of ["_scripts/mealplan.json", "_scripts/mealplan.example.json"]) {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) continue;
      const parsed = JSON.parse(await app.vault.cachedRead(file));
      return {
        folder: parsed.folder || fallback.folder,
        planName: parsed.planName || fallback.planName,
      };
    }
  } catch (e) {}
  return fallback;
}

async function chooseMealWeek(params, folder, planName) {
  const today = startOfDay(new Date());
  const options = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    const base = offsetDays(today, offset * 7);
    const range = weekRange(base);
    const label_end = `${range.start.slice(0, 5)}${range.shortEnd}`;
    const filename = `${range.start}--${range.shortEnd} ${planName}`;
    const exists = !!env(params).app.vault.getAbstractFileByPath(`${folder}/${filename}.md`);
    let label;
    if (offset === 0) label = `this week · ${range.start} – ${label_end}`;
    else if (offset === 1) label = `next week · ${range.start} – ${label_end}`;
    else if (offset === -1) label = `last week · ${range.start} – ${label_end}`;
    else if (offset > 1) label = `in ${offset} weeks · ${range.start} – ${label_end}`;
    else label = `${Math.abs(offset)} weeks ago · ${range.start} – ${label_end}`;
    if (exists) label += " (exists)";
    options.push({ label, value: range.monday });
  }
  options.push({ label: "pick a date…", value: "__manual__" });

  const selected = await choose(
    params,
    options.map((item) => item.label),
    options.map((item) => item.value),
    "which week?",
    { back: false }
  );

  if (selected === "__manual__") {
    const input = await requiredInput(params, "any date in the target week (YYYY-MM-DD)?");
    const parsed = parseDay(input);
    if (!parsed) throw new Error(`Invalid date: ${input}. Use YYYY-MM-DD.`);
    return parsed;
  }
  return selected;
}

// Startup routine (hidden QuickAdd choice, runOnStartup: true — peer to the action-points startup
// refresh). Silently ensures this week's weekly note exists for every active org and today's daily
// note exists. Create-if-missing only: existing notes are left untouched and nothing is opened, so
// launching Obsidian never steals focus or duplicates a period note. Never throws — a startup error
// must not block the app; it is swallowed to a notice.
async function periodicAuto(params) {
  try {
    for (const org of orgFolders(params)) await ensureThisWeekWeekly(params, org);
    await ensureTodayDaily(params);
  } catch (error) {
    notice(`Periodic startup skipped: ${error?.message || error}`);
  }
}

// Create {org}/weekly/{Mon}--{Sun} {Org}.md for the current week if it does not already exist.
// Mirrors the interactive weekly() flow but never prompts and never opens the note.
async function ensureThisWeekWeekly(params, org) {
  const cap = capitalize(org);
  const range = weekRange(new Date());
  const prev = weekRange(offsetDays(range.monday, -7));
  const next = weekRange(offsetDays(range.monday, 7));
  const filename = `${range.start}--${range.shortEnd} ${cap}`;
  if (env(params).app.vault.getAbstractFileByPath(`${org}/weekly/${filename}.md`)) return;
  await createFromTemplate(params, TEMPLATE.weekly, `${org}/weekly/${filename}`, {
    org,
    start: range.start,
    end: range.end,
    previous: `${prev.start}--${prev.shortEnd} ${cap}`,
    next: `${next.start}--${next.shortEnd} ${cap}`,
  }, { open: false });
}

// Create daily/{YYYY-MM-DD}.md for today if it does not already exist. Mirrors the interactive
// daily() flow but never prompts and never opens the note.
async function ensureTodayDaily(params) {
  const base = startOfDay(new Date());
  const day = fmtLocal(base);
  if (env(params).app.vault.getAbstractFileByPath(`daily/${day}.md`)) return;
  const range = weekRange(base);
  await createFromTemplate(params, TEMPLATE.daily, `daily/${day}`, {
    date: day,
    previous: fmtLocal(offsetDays(base, -1)),
    next: fmtLocal(offsetDays(base, 1)),
    weekLines: weeklyLinkLines(params, range),
  }, { open: false });
}

async function runBackable(action) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (isBack(error)) continue;
      throw error;
    }
  }

  return null;
}

async function choose(params, labels, values, prompt, options = {}) {
  const { quickAddApi } = env(params);
  const canGoBack = options.back !== false;
  const finalLabels = canGoBack ? [...labels, BACK_LABEL] : labels;
  const finalValues = canGoBack ? [...values, BACK_LABEL] : values;
  const selected = await quickAddApi.suggester(finalLabels, finalValues, prompt);
  if (selected === BACK_LABEL) throw new BackSignal();
  return selected;
}

class BackSignal extends Error {
  constructor() {
    super(BACK_LABEL);
    this.name = "BackSignal";
  }
}

function isBack(error) {
  return error instanceof BackSignal || error?.name === "BackSignal";
}

async function chooseOrg(params) {
  const orgs = orgFolders(params);
  return await choose(params, orgs, orgs, "org?", { back: false });
}

async function chooseNonPersonalOrg(params) {
  const orgs = orgFolders(params).filter((org) => org !== "personal");
  return await choose(params, orgs, orgs, "org?", { back: false });
}

function orgFolders(params) {
  return env(params).app.vault.getRoot().children
    .filter((child) => isFolder(child) && !child.name.startsWith("_") && !child.name.startsWith(".") && !IGNORED_ORG_FOLDERS.has(child.name))
    .map((child) => child.name)
    .sort(sortOrgNames);
}

function sortOrgNames(a, b) {
  const aIndex = ORG_ORDER.indexOf(a);
  const bIndex = ORG_ORDER.indexOf(b);
  if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  if ((a === "personal") !== (b === "personal")) return a === "personal" ? 1 : -1;
  return a.localeCompare(b);
}

// Best-effort load of org priority from _scripts/orgs.json (falls back to orgs.example.json,
// then to the name-free rule in sortOrgNames). Never throws: the vault must keep working
// even if no config file exists.
async function loadOrgConfig(params) {
  try {
    const { app } = env(params);
    for (const path of ["_scripts/orgs.json", "_scripts/orgs.example.json"]) {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) continue;
      const parsed = JSON.parse(await app.vault.cachedRead(file));
      ORG_ORDER = Array.isArray(parsed.order) ? parsed.order : [];
      return;
    }
    ORG_ORDER = [];
  } catch (e) {
    ORG_ORDER = [];
  }
}

function weeklyLinkLines(params, range) {
  return orgFolders(params)
    .map((org) => `  - "[[${range.start}--${range.shortEnd} ${capitalize(org)}]]"`)
    .join("\n");
}

async function chooseNoteFolder(params, org) {
  const { quickAddApi } = env(params);
  const basePath = `${org}/notes`;
  const folders = findFolders(params, basePath);
  const root = { label: "notes", path: basePath, topic: "" };
  const options = [{ label: "new folder", isNew: true }, root, ...folders];
  const selected = await choose(params, options.map((item) => item.label), options, "where?");
  if (!selected.isNew) return selected;

  const parentOptions = [root, ...folders];
  const parent = await choose(params, parentOptions.map((item) => item.label), parentOptions, "parent?");
  const child = await requiredTopic(params, "folder?");
  const topic = parent.topic ? `${parent.topic}/${child}` : child;
  return { label: topic, path: `${basePath}/${topic}`, topic };
}

async function chooseMeeting(params, org) {
  const meetings = findMeetingFolders(params, org);
  if (meetings.length === 0) throw new Error(`No meetings found under ${org}.`);
  return await choose(params, meetings.map((item) => item.label), meetings, "meeting?");
}

async function chooseProject(params, org) {
  const projects = findProjectFolders(params, `${org}/projects`);
  if (projects.length === 0) throw new Error(`No projects found under ${org}/projects.`);
  return await choose(params, projects.map((item) => item.label), projects, "project?");
}

async function chooseFolderName(params, basePath, prompt) {
  const folder = env(params).app.vault.getAbstractFileByPath(basePath);
  const names = isFolder(folder) ? folder.children
    .filter((child) => isFolder(child) && !child.name.startsWith("_") && !IGNORED_FOLDERS.has(child.name))
    .map((child) => child.name)
    .sort((a, b) => a.localeCompare(b)) : [];
  if (names.length === 0) return null;
  return await choose(params, names, names, prompt);
}

function findFolders(params, basePath) {
  const root = env(params).app.vault.getAbstractFileByPath(basePath);
  const results = [];
  const walk = (folder) => {
    if (!isFolder(folder)) return;
    for (const child of folder.children) {
      if (!isFolder(child) || child.name.startsWith("_") || IGNORED_FOLDERS.has(child.name)) continue;
      const topic = child.path.slice(`${basePath}/`.length);
      results.push({ name: child.name, path: child.path, label: topic, topic });
      walk(child);
    }
  };
  walk(root);
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

function findTopLevelProjectFolders(params, basePath) {
  const root = env(params).app.vault.getAbstractFileByPath(basePath);
  if (!isFolder(root)) return [];
  return root.children
    .filter((child) => isFolder(child) && !child.name.startsWith("_") && !IGNORED_PROJECT_FOLDERS.has(child.name))
    .map((child) => ({ name: child.name, path: child.path, label: child.name, parent: child.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function findProjectFolders(params, basePath) {
  const root = env(params).app.vault.getAbstractFileByPath(basePath);
  const results = [];
  const addProject = (folder) => results.push({ name: folder.name, path: folder.path, label: folder.path.slice(`${basePath}/`.length).replace(/\/projects\//g, " / ") });
  const walkProject = (folder) => {
    if (!isFolder(folder)) return;
    const nested = folder.children.find((child) => isFolder(child) && child.name === "projects");
    if (!isFolder(nested)) return;
    for (const child of nested.children) {
      if (!isFolder(child) || child.name.startsWith("_") || IGNORED_PROJECT_FOLDERS.has(child.name)) continue;
      addProject(child);
      walkProject(child);
    }
  };
  if (isFolder(root)) {
    for (const child of root.children) {
      if (!isFolder(child) || child.name.startsWith("_") || IGNORED_PROJECT_FOLDERS.has(child.name)) continue;
      addProject(child);
      walkProject(child);
    }
  }
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

function findJournalNotes(params, org) {
  const { app } = env(params);
  const results = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(`${org}/`)) continue;
    const frontmatter = getFrontmatter(params, file);
    if (!frontmatter || frontmatter.category !== "journal") continue;
    if (frontmatter.status === "archived" || frontmatter.status === "obsolete") continue;
    if (file.basename.startsWith("Draft ")) continue;
    results.push({ file, label: file.basename, created: String(frontmatter.created || "") });
  }
  return results.sort((a, b) => b.created.localeCompare(a.created));
}

function getFrontmatter(params, file) {
  return env(params).app.metadataCache.getFileCache(file)?.frontmatter || null;
}

// All triageable inbox notes across active orgs, newest first. Matches by type: inbox frontmatter
// or by living under an {org}/inbox/ folder, so hand-made inbox notes are caught too. Skips the
// archive root, anything parked under an {org}/inbox/obsolete/ subfolder, index pages
// (topic: indexes, e.g. inbox.md), and notes flagged status: archived/obsolete. Labels are
// org-prefixed so items from different orgs are distinguishable in the picker.
function findInboxNotes(params) {
  const { app } = env(params);
  const results = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const parts = file.path.split("/");
    if (parts[0] === "archive") continue;
    if (parts[1] === "inbox" && parts[2] === "obsolete") continue;
    const inFolder = parts.length >= 2 && parts[1] === "inbox";
    const frontmatter = getFrontmatter(params, file);
    if (frontmatter?.topic === "indexes") continue;
    const isInbox = frontmatter?.type === "inbox";
    if (!inFolder && !isInbox) continue;
    if (frontmatter?.status === "archived" || frontmatter?.status === "obsolete") continue;
    results.push({ file, label: `${parts[0]}/ ${file.basename}`, created: String(frontmatter?.created || "") });
  }
  return results.sort((a, b) => b.created.localeCompare(a.created));
}

// Reframe an inbox note for triage: rebuild its frontmatter from _templates/Note.md in canonical
// field order (org, category, created, type, topic, relationships), dropping type: inbox. Preserves
// the original created value (capture time) and the existing note body verbatim. Rebuilding from the
// template — rather than mutating in place — guarantees a triaged note is byte-identical in shape to
// a freshly created note, instead of leaving topic/type appended after created.
async function retagInboxNote(params, file, org, lines) {
  const { app } = env(params);
  const raw = await app.vault.read(file);
  const existing = getFrontmatter(params, file) || {};
  const created = existing.created ? String(existing.created) : env(params).quickAddApi.date.now("YYYY-MM-DDTHH:mm");
  const body = stripFrontmatter(raw);
  const template = await readVaultFile(params, TEMPLATE.note);
  const content = render(template, {
    org,
    created,
    typeLine: valueFor(lines, "typeLine"),
    topicLine: valueFor(lines, "topicLine"),
    relationshipLines: valueFor(lines, "relationshipLines"),
    body,
  });
  await app.vault.modify(file, content);
}

// Returns everything after the leading YAML frontmatter block (body only), with leading blank
// lines trimmed so the rebuilt note has the same single blank line after frontmatter as a freshly
// created note. If there is no frontmatter, returns the content unchanged.
function stripFrontmatter(content) {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^(\r?\n)+/, "");
}

function findMeetingFolders(params, rootPath) {
  const root = env(params).app.vault.getAbstractFileByPath(rootPath);
  const results = [];
  const walk = (folder) => {
    if (!isFolder(folder)) return;
    if (folder.name === "meetings") {
      const meetingIndex = folder.path.split("/").length - 1;
      for (const child of folder.children) {
        if (!isFolder(child)) continue;
        const parts = child.path.split("/");
        const project = nearestContext(parts, "projects", meetingIndex);
        const team = nearestContext(parts, "teams", meetingIndex);
        const context = project || team;
        results.push({ name: child.name, path: child.path, project, team, label: context ? `${context} / ${child.name}` : child.name });
      }
      return;
    }
    for (const child of folder.children) if (isFolder(child) && !child.name.startsWith("_") && child.name !== "Archives") walk(child);
  };
  walk(root);
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

async function createFromTemplate(params, templatePath, targetPathWithoutExtension, values, options = {}) {
  const { app, quickAddApi } = env(params);
  const template = await readVaultFile(params, templatePath);
  const content = render(template, { created: quickAddApi.date.now("YYYY-MM-DDTHH:mm"), ...values });
  const targetPath = await uniqueMarkdownPath(params, targetPathWithoutExtension);
  await ensureFolder(params, targetPath.split("/").slice(0, -1).join("/"));
  const file = await app.vault.create(targetPath, content);
  if (options.open === false) return file;
  return await openFile(params, file);
}

async function openFile(params, file) {
  await env(params).app.workspace.getLeaf().openFile(file);
  return file;
}

async function ensureFolder(params, folderPath) {
  const { app } = env(params);
  if (!folderPath) return;
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

async function uniqueMarkdownPath(params, pathWithoutExtension) {
  const { app } = env(params);
  const base = `${pathWithoutExtension}.md`;
  if (!app.vault.getAbstractFileByPath(base)) return base;
  for (let index = 1; index < 100; index++) {
    const candidate = `${pathWithoutExtension} (${index}).md`;
    if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique file name for ${base}.`);
}

async function readVaultFile(params, path) {
  const file = env(params).app.vault.getAbstractFileByPath(path);
  if (!file) throw new Error(`Template not found: ${path}`);
  return await env(params).app.vault.cachedRead(file);
}

async function requiredInput(params, prompt) {
  const value = await env(params).quickAddApi.inputPrompt(prompt);
  if (!value || !value.trim()) throw new Error(`${prompt} is required.`);
  return value.trim();
}

async function requiredTopic(params, prompt) {
  const topic = cleanTopic(await requiredInput(params, prompt));
  if (!topic) throw new Error(`${prompt} must contain at least one valid folder name.`);
  return topic;
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

function relationshipLines({ meeting, project, team }) {
  return [
    meeting ? `meeting: "[[${meeting}]]"` : "",
    project ? `project: "[[${project}]]"` : "",
    team ? `team: "[[${team}]]"` : "",
  ].filter(Boolean).join("\n");
}

function valueFor(lines, key) {
  return lines.find((item) => item.key === key)?.value ?? "";
}

function detailsBlock() {
  return `## Details\n\n| | |\n|---|---|\n| Teams | |\n| Supervisor | |\n| Email | |\n| GitHub | |\n| Mobile | |\n| Board | |\n`;
}

function nearestContext(parts, marker, beforeIndex) {
  for (let index = Math.min(beforeIndex, parts.length - 1); index >= 0; index--) {
    if (parts[index] === marker) return parts[index + 1] || "";
  }
  return "";
}

function weekRange(dateValue) {
  const current = new Date(dateValue);
  const day = current.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMon);
  const sunday = offsetDays(monday, 6);
  const nextMonday = offsetDays(monday, 7);
  return { monday, start: fmtLocal(monday), end: fmtLocal(nextMonday), shortEnd: fmtLocal(sunday).slice(5) };
}

function previousMonthRange(dateValue) {
  const now = new Date(dateValue);
  const year = now.getFullYear();
  const month = now.getMonth();
  const refMonth = month === 0 ? 11 : month - 1;
  const refYear = month === 0 ? year - 1 : year;
  const previous = new Date(refYear, refMonth - 1, 1);
  const next = new Date(refYear, refMonth + 1, 1);
  const start = new Date(refYear, refMonth, 1);
  const end = new Date(refYear, refMonth + 1, 1);
  return { start: fmt(start), end: fmt(end), month: fmtMonth(start), previousMonth: fmtMonth(previous), nextMonth: fmtMonth(next) };
}

function offsetDays(dateValue, days) {
  const result = new Date(dateValue);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(dateValue) {
  return fmtLocal(dateValue);
}

function fmtLocal(dateValue) {
  const d = new Date(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fmtMonth(dateValue) {
  const d = new Date(dateValue);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function date(params, offset = 0) {
  return env(params).quickAddApi.date.now("YYYY-MM-DD", offset);
}

function inboxStamp(params) {
  return env(params).quickAddApi.date.now("YYYY-MM-DD HH-mm-ss");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function notice(message) {
  if (typeof Notice !== "undefined") new Notice(message);
  return null;
}

function safeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function cleanTopic(value) {
  return String(value)
    .split("/")
    .map((part) => safeFilename(part))
    .filter(Boolean)
    .join("/");
}

function isFolder(file) {
  return file && Array.isArray(file.children);
}

function env(params) {
  return { app: params.app, quickAddApi: params.quickAddApi };
}
