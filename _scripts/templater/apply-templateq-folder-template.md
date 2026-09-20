<%*
const currentContent = tp.file.content;
if (currentContent && currentContent.trim().length > 0) {
  new Notice("TemplateQ aborted: file is not empty.");
  return;
}

const currentPath = tp.file.path(true);
const currentFile = app.vault.getAbstractFileByPath(currentPath);
const folder = currentPath.split("/").slice(0, -1).join("/");
const parts = folder.split("/").filter(Boolean);
const org = parts[0];
const currentTitle = tp.file.title.startsWith("Untitled") ? "" : tp.file.title;
const created = tp.date.now("YYYY-MM-DDTHH:mm");
const runtimeFile = app.vault.getAbstractFileByPath("_scripts/shared/runtime.md");
if (!runtimeFile) throw new Error("Shared runtime missing: _scripts/shared/runtime.md");
const runtime = new Function("module", `${await app.vault.read(runtimeFile)}\nreturn module.exports;`)({ exports: {} });
const shared = await runtime.create(app);
const { safeFilename, relationshipLines, detailsBlock, orgFolders } = shared;
const renderTemplate = async (path, values) => shared.render(await shared.readVaultFile({ app }, path), values);
const ensureFolder = path => shared.ensureFolder({ app }, path);
const moveOrOpen = async (targetPath) => {
  const targetFile = app.vault.getAbstractFileByPath(`${targetPath}.md`);
  if (targetFile && currentPath !== `${targetPath}.md`) {
    new Notice("Target note already exists. Opening it instead.");
    await app.workspace.openLinkText(`${targetPath}.md`, "", false);
    if (currentFile) await app.vault.delete(currentFile);
    return false;
  }

  await ensureFolder(targetPath.split("/").slice(0, -1).join("/"));
  await tp.file.move(targetPath);
  return true;
};
const prompt = async (label, defaultValue = currentTitle, required = true) => {
  const value = await tp.system.prompt(label, defaultValue, required);
  return value ? value.trim() : "";
};
const nearestContext = (marker, index) => shared.nearestContext(parts, marker, index);
const invoiceTopicForFolder = () => {
  const topic = parts.slice(2).join("/");
  return ["assets/finances/invoices", "healthcare", "assets/car", "assets/house"].includes(topic) ? topic : "";
};
const clippingTypeForFolder = async () => {
  const type = parts[3] || "";
  if (["read", "listen", "watch"].includes(type)) return type;
  return await tp.system.suggester(["read", "listen", "watch"], ["read", "listen", "watch"], true, "type?");
};

let templatePath = "";
let targetPath = "";
let values = { org, created };

// Route by filename first: a date-named (2026-08-10) or week-named (2026-08-03--08-09 Personal) file is
// a daily/weekly no matter which folder it was created in. Clicking a bare [[2026-08-10]] previous/next
// link resolves the new note into the default new-note folder (personal/inbox), so without this it would
// wrongly become an inbox note. moveOrOpen then relocates it to daily/ or {org}/weekly/.
const weeklyMatch = currentTitle.match(/^(\d{4}-\d{2}-\d{2})--\d{2}-\d{2} (.+)$/);
const weeklyOrg = weeklyMatch ? weeklyMatch[2].toLowerCase() : "";
const isDailyName = /^\d{4}-\d{2}-\d{2}$/.test(currentTitle);
const isWeeklyName = !!weeklyMatch && orgFolders().includes(weeklyOrg);

if (isDailyName || (parts.length === 1 && parts[0] === "daily")) {
  // Overdue-daily support: honour the file's own date; fall back to today for a non-date name (e.g. Untitled).
  const day = isDailyName ? currentTitle : tp.date.now("YYYY-MM-DD");
  const base = new Date(`${day}T00:00`);
  templatePath = "_templates/Daily.md";
  targetPath = `daily/${day}`;
  values = shared.dailyValues(orgFolders(), base);
} else if (isWeeklyName || (parts.length === 2 && parts[1] === "weekly")) {
  // Honour the file's own week/org; fall back to today's week in the current org folder for a non-week name.
  const anchor = weeklyMatch ? new Date(`${weeklyMatch[1]}T00:00`) : new Date();
  const orgName = weeklyMatch ? weeklyOrg : org;
  values = { ...shared.weeklyValues(orgName, anchor), created };
  const { filename } = values;
  templatePath = "_templates/Weekly.md";
  targetPath = `${orgName}/weekly/${filename}`;
} else if (parts.length === 2 && parts[1] === "people") {
  const name = await prompt("person?");
  templatePath = "_templates/Person.md";
  targetPath = `${org}/people/${safeFilename(name)}/${safeFilename(name)}`;
  values = { org, created, detailsBlock: org === "personal" ? "" : detailsBlock() };
} else if (parts.length === 2 && parts[1] === "meetings") {
  const name = await prompt("meeting?");
  templatePath = "_templates/Meeting.md";
  targetPath = `${org}/meetings/${safeFilename(name)}/${safeFilename(name)}`;
  values = { org, created, contextLine: "" };
} else if (parts.length === 2 && parts[1] === "projects") {
  const name = await prompt("project?");
  templatePath = "_templates/Project.md";
  targetPath = `${org}/projects/${safeFilename(name)}/${safeFilename(name)}`;
  values = { org, created, parentLine: "" };
} else if (parts.length >= 4 && parts[parts.length - 1] === "projects") {
  const name = await prompt("project?");
  const parent = parts[parts.length - 2];
  templatePath = "_templates/Project.md";
  targetPath = `${folder}/${safeFilename(name)}/${safeFilename(name)}`;
  values = { org, created, parentLine: `parent: "[[${parent}]]"` };
} else if (parts.length === 2 && parts[1] === "teams" && org !== "personal") {
  const name = await prompt("team?");
  templatePath = "_templates/Team.md";
  targetPath = `${org}/teams/${safeFilename(name)}/${safeFilename(name)}`;
  values = { org, created };
} else if (parts[parts.length - 1] === "meetings") {
  const meeting = await prompt("meeting?");
  const meetingIndex = parts.length - 1;
  const project = nearestContext("projects", meetingIndex);
  const team = nearestContext("teams", meetingIndex);
  const contextLine = relationshipLines({ project, team });
  if (!contextLine) {
    new Notice(`TemplateQ does not support this meetings folder: ${folder}`);
    return;
  }
  templatePath = "_templates/Meeting.md";
  targetPath = `${folder}/${safeFilename(meeting)}/${safeFilename(meeting)}`;
  values = { org, created, contextLine };
} else if (parts.length === 2 && parts[1] === "inbox") {
  templatePath = "_templates/Note.md";
  targetPath = `${folder}/${tp.date.now("YYYY-MM-DD HH-mm-ss")}`;
  values = { org, category: "note", created, typeLine: "type: inbox", topicLine: "", relationshipLines: "", body: "" };
} else if (parts[1] === "notes") {
  if (org === "personal" && parts[2] === "books") {
    const title = await prompt("title?");
    const route = parts[3] || "books";
    templatePath = "_templates/Book.md";
    targetPath = `${folder}/${safeFilename(title)}`;
    values = { created, topicLine: route === "reading" || route === "interview" ? `topic: ${route}` : "" };
  } else if (parts[2] === "clippings") {
    const type = await clippingTypeForFolder();
    const title = await prompt("title?");
    templatePath = "_templates/Clipping.md";
    targetPath = `${org}/notes/clippings/${type}/${safeFilename(title)}`;
    values = { org, created, type };
  } else if (parts[2] === "transcripts") {
    const title = await prompt("title?");
    templatePath = "_templates/Transcript.md";
    targetPath = `${org}/notes/transcripts/${tp.date.now("YYYY-MM-DD")} ${safeFilename(title)} - Transcript`;
    values = { org, created, journalLine: "", body: "" };
  } else if (org === "personal" && invoiceTopicForFolder()) {
    const topic = invoiceTopicForFolder();
    const category = topic === "assets/finances/invoices" ? "invoice"
      : await tp.system.suggester(["note", "invoice"], ["note", "invoice"], true, "category?");
    const title = await prompt("title?");
    if (category === "invoice") {
      templatePath = "_templates/Invoice.md";
      targetPath = `${folder}/${tp.date.now("YYYY-MM-DD")} ${safeFilename(title)}`;
      values = { created, topic };
    } else {
      templatePath = "_templates/Note.md";
      targetPath = `${folder}/${safeFilename(title)}`;
      values = { org, created, topicLine: `topic: "${topic}"`, typeLine: "", relationshipLines: "", body: "" };
    }
  } else if (org === "personal" && parts.length === 3 && parts[2] === "places") {
    const type = await tp.system.suggester(["entry", "recommendation"], ["entry", "recommendation"], true, "type?");
    const topic = await tp.system.suggester(
      ["places/restaurant", "places/bar", "places/cafe", "places/spot", "places/city", "places/country"],
      ["places/restaurant", "places/bar", "places/cafe", "places/spot", "places/city", "places/country"],
      true,
      "topic?"
    );
    const title = await prompt("title?");
    templatePath = "_templates/Place.md";
    targetPath = `${folder}/${safeFilename(title)}`;
    values = { created, type, topic };
  } else if (org === "personal" && parts.length === 3 && parts[2] === "trips") {
    const type = await tp.system.suggester(["entry", "recommendation"], ["entry", "recommendation"], true, "type?");
    const topic = await tp.system.prompt("topic?", "", false);
    let dateLines = "";
    if (type === "entry") {
      const start = await tp.system.prompt("start?", "YYYY-MM-DD", false);
      const end = await tp.system.prompt("end?", "YYYY-MM-DD", false);
      dateLines = `start: ${start || ""}\nend: ${end || ""}`;
    }
    const title = await prompt("title?");
    templatePath = "_templates/Trip.md";
    targetPath = `${folder}/${safeFilename(title)}`;
    values = { created, type, topicLine: topic ? `topic: "${topic}"` : "", dateLines };
  } else {
    const title = await prompt("title?");
    const topic = parts.slice(2).join("/");
    templatePath = "_templates/Note.md";
    targetPath = `${folder}/${safeFilename(title)}`;
    values = {
      org,
      category: "note",
      created,
      typeLine: topic === "references" || topic.startsWith("references/") ? "type: reference" : "",
      topicLine: topic ? `topic: "${topic}"` : "",
      relationshipLines: "",
      body: "",
    };
  }
}

if (!templatePath || !targetPath) {
  new Notice(`TemplateQ does not support this folder: ${folder}`);
  return;
}

tR += await renderTemplate(templatePath, values);
await moveOrOpen(targetPath);
-%>
