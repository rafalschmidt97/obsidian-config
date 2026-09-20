<%*
const currentContent = tp.file.content;
if (currentContent && currentContent.trim().length > 0) {
  new Notice("Journal template aborted: file is not empty.");
  return;
}

const currentPath = tp.file.path(true);
const currentFile = app.vault.getAbstractFileByPath(currentPath);
const folder = currentPath.split("/").slice(0, -1).join("/");
const parts = folder.split("/").filter(Boolean);
const org = folder.split("/")[0];
const currentTitle = tp.file.title.startsWith("Untitled") ? "" : tp.file.title;

const runtimeFile = app.vault.getAbstractFileByPath("_scripts/shared/runtime.md");
if (!runtimeFile) throw new Error("Shared runtime missing: _scripts/shared/runtime.md");
const runtime = new Function("module", `${await app.vault.read(runtimeFile)}\nreturn module.exports;`)({ exports: {} });
const shared = await runtime.create(app);
const { safeFilename, capitalize, previousMonthRange, formatWikilinkList } = shared;
const nearestContext = (marker, index) => shared.nearestContext(parts, marker, index);
const renderTemplate = async (path, values) => shared.render(await shared.readVaultFile({ app }, path), values);

let templatePath = "";
let filenameSubject = "";
let explicitFilename = "";
let values = { org };

if (!org) {
  new Notice("Journal template could not infer org from path.");
  return;
}

const mode = await tp.system.suggester(["now", "draft"], ["now", "draft"], true, "mode?");
const isDraft = mode === "draft";
const offerDraft = async (context) => {
  if (isDraft) return false;
  const journal = await runtime.loadModule(app, "_scripts/quickadd/journal.md");
  const activated = await journal.activateFolderDraft(
    { app, quickAddApi: { date: tp.date } }, folder, { org, ...context },
    (labels, files) => tp.system.suggester(labels, files, true, "draft?")
  );
  if (activated && currentFile && !(await app.vault.read(currentFile)).trim()) await app.vault.delete(currentFile);
  return activated;
};

if (parts.length === 2 && parts[1] === "journal") {
  const typeOptions = isDraft
    ? ["none", "event", "reflection", "sport"]
    : ["none", "event", "reflection", "monthly reflection", "sport"];
  const typeValues = isDraft
    ? ["", "event", "reflection", "sport"]
    : ["", "event", "reflection", "monthly reflection", "sport"];
  const type = await tp.system.suggester(typeOptions, typeValues, true, "type?");
  if (type === "monthly reflection") {
    const range = previousMonthRange(new Date());
    const orgCap = capitalize(org);
    explicitFilename = `${range.month} ${orgCap} Monthly Reflection`;
    filenameSubject = explicitFilename;
    templatePath = "_templates/Monthly Reflection.md";
    values.created = tp.date.now("YYYY-MM-DDTHH:mm");
    values.start = range.start;
    values.end = range.end;
    values.previous = `${range.previousMonth} ${orgCap} Monthly Reflection`;
    values.next = `${range.nextMonth} ${orgCap} Monthly Reflection`;
  } else {
    if (await offerDraft({ type })) return;
    filenameSubject = await tp.system.prompt("title?", currentTitle, true);
    templatePath = type === "sport" ? "_templates/Journal Sport.md" : "_templates/Journal.md";
    values.typeLine = type ? `type: ${type}` : "";
    if (type === "event") {
      const attendees = await tp.system.prompt("attendees? optional, comma-separated", "", false);
      const attendeeItems = attendees ? attendees.split(",").map((item) => item.trim()).filter(Boolean) : [];
      values.attendeesLine = formatWikilinkList("attendees", attendeeItems);
    }
  }
} else if (parts.length === 3 && parts[1] === "people") {
  const person = parts[2];
  filenameSubject = person;
  templatePath = "_templates/Journal Person.md";
  values.person = person;
  if (await offerDraft({ type: "1-1", person })) return;
} else if (parts.length === 4 && parts[1] === "teams" && parts[3] === "journal") {
  const team = parts[2];
  filenameSubject = team;
  templatePath = "_templates/Journal Team.md";
  values.team = team;
  if (await offerDraft({ type: "team", team })) return;
} else {
  const meetingIndex = parts.lastIndexOf("meetings");
  if (meetingIndex >= 0 && parts.length === meetingIndex + 2) {
    const meeting = parts[meetingIndex + 1];
    const project = nearestContext("projects", meetingIndex);
    const team = nearestContext("teams", meetingIndex);
    const contextLines = shared.relationshipLines({ project, team });

    filenameSubject = meeting;
    templatePath = "_templates/Journal Meeting.md";
    values.meeting = meeting;
    values.contextLines = contextLines;
    if (await offerDraft({ type: "meeting", meeting })) return;
  }
}

if (!templatePath || !filenameSubject) {
  new Notice(`Journal template does not support this folder: ${folder}`);
  return;
}

if (templatePath !== "_templates/Monthly Reflection.md") {
  values.created = tp.date.now("YYYY-MM-DDTHH:mm");
  values.draftPlanningSection = isDraft ? "## Talking Points\n\n- " : "";
}

const rendered = await renderTemplate(templatePath, values);
const filename = explicitFilename || (isDraft ? `Draft ${safeFilename(filenameSubject)}` : `${tp.date.now("YYYY-MM-DD HH-mm")} ${safeFilename(filenameSubject)}`);

if (isDraft) {
  const existingDraftPath = `${folder}/${filename}.md`;
  const existingDraft = app.vault.getAbstractFileByPath(existingDraftPath);
  if (existingDraft && currentPath !== existingDraftPath) {
    new Notice(`Opened existing journal draft: ${existingDraftPath}`);
    await app.workspace.openLinkText(existingDraftPath, "", false);
    if (currentFile) await app.vault.delete(currentFile);
    return;
  }
}

tR += rendered;
await tp.file.move((await shared.uniqueMarkdownPath({ app }, `${folder}/${filename}`)).replace(/\.md$/, ""));
-%>
