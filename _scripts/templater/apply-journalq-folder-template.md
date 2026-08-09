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

const safeFilename = (value) => String(value).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
const fmt = (dateValue) => {
  const d = new Date(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const fmtMonth = (dateValue) => {
  const d = new Date(dateValue);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const wikilink = (value) => value.startsWith("[[") && value.endsWith("]]") ? value : `[[${value}]]`;
const escapeYamlString = (value) => String(value).replace(/"/g, '\\"');
const formatWikilinkList = (key, items) => {
  if (!items.length) return "";
  return `${key}:\n${items.map((item) => `  - "${escapeYamlString(wikilink(item))}"`).join("\n")}`;
};
const uniqueBasePath = (targetFolder, filename) => {
  const base = `${targetFolder}/${filename}`;
  if (!app.vault.getAbstractFileByPath(`${base}.md`)) return base;

  for (let index = 1; index < 100; index++) {
    const candidate = `${base} (${index})`;
    if (!app.vault.getAbstractFileByPath(`${candidate}.md`)) return candidate;
  }

  throw new Error(`Could not create a unique file name for ${base}.md`);
};
const previousMonthRange = (dateValue) => {
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
};
const nearestContext = (marker, beforeIndex) => {
  for (let index = Math.min(beforeIndex, parts.length - 1); index >= 0; index--) {
    if (parts[index] === marker) return parts[index + 1] || "";
  }
  return "";
};
const renderTemplate = async (templatePath, values) => {
  const templateFile = app.vault.getAbstractFileByPath(templatePath);
  const template = await app.vault.cachedRead(templateFile);
  const rendered = template.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? "");
  if (!rendered.startsWith("---\n")) return rendered;

  const end = rendered.indexOf("\n---", 4);
  if (end === -1) return rendered;

  const frontmatter = rendered.slice(4, end)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");

  return `---\n${frontmatter}${rendered.slice(end)}`;
};

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
    filenameSubject = await tp.system.prompt("title?", currentTitle, true);
    templatePath = "_templates/Journal.md";
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
} else if (parts.length === 4 && parts[1] === "teams" && parts[3] === "journal") {
  const team = parts[2];
  filenameSubject = team;
  templatePath = "_templates/Journal Team.md";
  values.team = team;
} else {
  const meetingIndex = parts.lastIndexOf("meetings");
  if (meetingIndex >= 0 && parts.length === meetingIndex + 2) {
    const meeting = parts[meetingIndex + 1];
    const project = nearestContext("projects", meetingIndex);
    const team = nearestContext("teams", meetingIndex);
    const contextLines = [
      project ? `project: "[[${project}]]"` : "",
      team ? `team: "[[${team}]]"` : "",
    ].filter(Boolean).join("\n");

    filenameSubject = meeting;
    templatePath = "_templates/Journal Meeting.md";
    values.meeting = meeting;
    values.contextLines = contextLines;
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
await tp.file.move(uniqueBasePath(folder, filename));
-%>
