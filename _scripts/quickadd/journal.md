// Raw JavaScript stored as .md so Obsidian Sync includes it on mobile.
// QuickAdd evaluates exports synchronously; dependencies load only when a flow is invoked.
module.exports = Object.fromEntries(["entry", "journal", "generic", "sport", "reflection", "draft", "future", "person", "meeting", "project", "team", "activateFolderDraft"]
  .map(name => [name, async (params, ...args) => {
    const file = params.app.vault.getAbstractFileByPath("_scripts/shared/runtime.md");
    if (!file) throw new Error("Shared runtime missing: _scripts/shared/runtime.md");
    const runtime = new Function("module", `${await params.app.vault.read(file)}\nreturn module.exports;`)({ exports: {} });
    return (await createFlows(await runtime.create(params.app)))[name](params, ...args);
  }]));

async function createFlows(shared) {
const { render, readVaultFile, ensureFolder, uniqueMarkdownPath, openFile, renameFile,
  safeFilename, isFolder, getFrontmatter, findMeetingFolders, findProjectFolders,
  runBackable, choose, requiredInput, notice,
  orgFolders, journalMatchesDraft, folderNames, relationshipLines } = shared;
const TEMPLATE_DIR = "_templates";

const TEMPLATE = {
  journal: `${TEMPLATE_DIR}/Journal.md`,
  person: `${TEMPLATE_DIR}/Journal Person.md`,
  meeting: `${TEMPLATE_DIR}/Journal Meeting.md`,
  project: `${TEMPLATE_DIR}/Journal Project.md`,
  team: `${TEMPLATE_DIR}/Journal Team.md`,
};

return {
  entry,
  journal,
  generic: journal,
  sport,
  reflection,
  draft,
  future: draft,
  person,
  meeting,
  project,
  team,
  activateFolderDraft,
};

async function entry(params, settings = {}) {
  return await runBackable(async () => {
    const flows = { journal, generic: journal, sport, reflection, draft, future: draft, person, meeting, project, team };
    const flow = settings.flow ? flows[settings.flow] : journalMenu;
    if (!flow) throw new Error(`Unknown journal flow: ${settings.flow}`);
    return await flow(params, settings.org, settings.draft === undefined ? {} : { draft: Boolean(settings.draft) });
  });
}

async function journalMenu(params) {
  const { quickAddApi } = env(params);
  const org = await chooseOrg(params);
  const mode = await choose(params,
    ["now", "draft"],
    ["occurred", "draft"],
    "mode?"
  );
  const flow = await choose(params,
    ["journal", "person", "meeting", "project", "team"],
    [journal, person, meeting, project, team],
    "where?"
  );

  return await flow(params, org, { draft: mode === "draft" });
}

async function draft(params, selectedOrg) {
  const { quickAddApi } = env(params);
  const org = selectedOrg ?? await chooseOrg(params);
  const flow = await choose(params,
    ["journal", "person", "meeting", "project", "team"],
    [journal, person, meeting, project, team],
    "where?"
  );

  return await flow(params, org, { draft: true });
}

async function journal(params, selectedOrg, options = {}) {
  const org = selectedOrg ?? await chooseOrg(params);
  const type = options.type || "event";

  const matchesDraft = (frontmatter, file) => journalMatchesDraft(frontmatter, file, { org, type });

  if (!options.draft) {
    const drafts = await findMatchingDrafts(params, `${org}/journal`, matchesDraft);
    if (drafts.length > 0) {
      const choices = [
        ...drafts.map((file) => ({ kind: "draft", file })),
        { kind: "new" },
      ];
      const labels = [
        ...drafts.map((file) => `use draft: ${file.basename}`),
        "create new",
      ];
      const selected = await choose(params, labels, choices, "draft?");
      if (selected.kind === "draft") {
        return await activateDraft(params, selected.file, `${org}/journal/${datetime(params)} ${safeFilename(draftSubject(selected.file))}`);
      }
    }
  }

  const title = await requiredInput(params, "title?");

  return await createOrActivateJournal(params, {
    template: TEMPLATE.journal,
    org,
    targetFolder: `${org}/journal`,
    filenameSubject: title,
    values: {
      org,
      typeLine: type ? `type: ${type}` : "",
      attendeesLine: type === "event" ? "attendees: []" : "",
    },
    matchesDraft,
  }, options.draft ? options : { ...options, skipDraftSearch: true });
}

async function sport(params, selectedOrg, options = {}) {
  return await typedJournal(params, selectedOrg ?? "personal", "sport", options);
}

async function reflection(params, selectedOrg, options = {}) {
  return await typedJournal(params, selectedOrg ?? await chooseOrg(params), "reflection", options);
}

async function typedJournal(params, org, type, options) {
  const isDraft = options.draft ?? ((await choose(params, ["now", "draft"], ["now", "draft"], "mode?")) === "draft");
  return await journal(params, org, { ...options, type, draft: isDraft });
}

async function person(params, selectedOrg, options = {}) {
  const org = selectedOrg ?? await chooseOrg(params);
  const personName = await chooseFolder(params, `${org}/people`, "person?");
  if (!personName) return null;

  return await createOrActivateJournal(params, {
    template: TEMPLATE.person,
    org,
    targetFolder: `${org}/people/${personName}`,
    filenameSubject: personName,
    values: { org, person: personName },
    matchesDraft: (frontmatter, file) => journalMatchesDraft(frontmatter, file, { org, type: "1-1", person: personName }),
  }, options);
}

async function meeting(params, selectedOrg, options = {}) {
  const { quickAddApi } = env(params);
  const org = selectedOrg ?? await chooseOrg(params);
  const meetings = findMeetingFolders(params, org);
  if (meetings.length === 0) return notice(`No meetings found under ${org}. Create a meeting first.`);

  const selected = await choose(params,
    meetings.map((item) => item.label),
    meetings,
    "meeting?"
  );
  return await createMeetingJournal(params, org, selected, options);
}

async function project(params, selectedOrg, options = {}) {
  const { quickAddApi } = env(params);
  const org = selectedOrg ?? await chooseOrg(params);
  const projects = findProjectFolders(params, `${org}/projects`);
  if (projects.length === 0) return notice(`No projects found under ${org}/projects. Create a project first.`);

  const selectedProject = await choose(params,
    projects.map((item) => item.label),
    projects,
    "project?"
  );

  const projectMeetings = findMeetingFolders(params, selectedProject.path)
    .filter((item) => item.project === selectedProject.name);
  const destinations = [
    { label: selectedProject.label, kind: "project", project: selectedProject },
    ...projectMeetings.map((item) => ({ label: item.name, kind: "meeting", meeting: item })),
  ];

  const destination = destinations.length === 1
    ? destinations[0]
    : await choose(params,
      destinations.map((item) => item.label),
      destinations,
      "where?"
    );

  if (destination.kind === "meeting") {
    return await createMeetingJournal(params, org, destination.meeting, options);
  }

  return await createOrActivateJournal(params, {
    template: TEMPLATE.project,
    org,
    targetFolder: selectedProject.path,
    filenameSubject: selectedProject.name,
    values: { org, project: selectedProject.name },
    matchesDraft: (frontmatter, file) => journalMatchesDraft(frontmatter, file, { org, type: "project", project: selectedProject.name }),
  }, options);
}

async function team(params, selectedOrg, options = {}) {
  const org = selectedOrg ?? await chooseOrg(params);
  const teamName = await chooseFolder(params, `${org}/teams`, "team?");
  if (!teamName) return null;

  return await createOrActivateJournal(params, {
    template: TEMPLATE.team,
    org,
    targetFolder: `${org}/teams/${teamName}/journal`,
    filenameSubject: teamName,
    values: { org, team: teamName },
    matchesDraft: (frontmatter, file) => journalMatchesDraft(frontmatter, file, { org, type: "team", team: teamName }),
  }, options);
}

async function createMeetingJournal(params, org, meetingInfo, options = {}) {
  const contextLines = relationshipLines({ project: meetingInfo.project, team: meetingInfo.team });

  return await createOrActivateJournal(params, {
    template: TEMPLATE.meeting,
    org,
    targetFolder: meetingInfo.path,
    filenameSubject: meetingInfo.name,
    values: {
      org,
      meeting: meetingInfo.name,
      contextLines,
    },
    matchesDraft: (frontmatter, file) => journalMatchesDraft(frontmatter, file, { org, type: "meeting", meeting: meetingInfo.name }),
  }, options);
}

async function createOrActivateJournal(params, context, options = {}) {
  const { quickAddApi } = env(params);
  const mode = options.draft ? "draft" : "occurred";

  if (mode === "draft") {
    const filename = `Draft ${safeFilename(context.filenameSubject)}`;
    const existing = env(params).app.vault.getAbstractFileByPath(`${context.targetFolder}/${filename}.md`);
    if (existing) {
      notice(`Opened existing journal draft: ${existing.path}`);
      return await openFile(params, existing);
    }

    return await createFromTemplate(params, context.template, `${context.targetFolder}/${filename}`, {
      ...context.values,
      ...journalModeValues(params, "draft"),
    }, "journal draft");
  }

  const drafts = options.skipDraftSearch ? [] : await findMatchingDrafts(params, context.targetFolder, context.matchesDraft);
  if (drafts.length > 0) {
    const createNew = { kind: "new" };
    const choices = [
      ...drafts.map((file) => ({ kind: "draft", file })),
      createNew,
    ];
    const labels = [
      ...drafts.map((file) => `use draft: ${file.basename}`),
      "create new",
    ];
    const selected = await choose(params, labels, choices, "draft?");
    if (selected.kind === "draft") {
      return await activateDraft(params, selected.file, `${context.targetFolder}/${datetime(params)} ${safeFilename(context.filenameSubject)}`);
    }
  }

  return await createFromTemplate(params, context.template, `${context.targetFolder}/${datetime(params)} ${safeFilename(context.filenameSubject)}`, {
    ...context.values,
    ...journalModeValues(params, "occurred"),
  }, "journal");
}

async function activateDraft(params, file, targetPathWithoutExtension) {
  const { app } = env(params);
  const created = nowIso(params);
  const content = await app.vault.cachedRead(file);
  const draftCreated = getFrontmatterLineValue(content, "created") || String(getFrontmatter(params, file)?.created || "");
  let updated = content;
  if (draftCreated) updated = upsertFrontmatterLine(updated, "drafted", draftCreated);
  updated = upsertFrontmatterLine(updated, "created", created);
  const targetPath = await uniqueMarkdownPath(params, targetPathWithoutExtension);
  const folderPath = targetPath.split("/").slice(0, -1).join("/");
  await ensureFolder(params, folderPath);

  await app.vault.modify(file, updated);
  await renameFile(params, file, targetPath);
  const activated = app.vault.getAbstractFileByPath(targetPath);
  await app.workspace.getLeaf().openFile(activated || file);
  notice(`Activated journal draft: ${targetPath}`);
  return activated || file;
}

// Folder-click adapter uses the same draft matching and activation as explicit capture.
async function activateFolderDraft(params, targetFolder, context, select) {
  const drafts = await findMatchingDrafts(params, targetFolder, (fm, file) => journalMatchesDraft(fm, file, context));
  if (!drafts.length) return false;
  const selected = await select([...drafts.map(file => `use draft: ${file.basename}`), "create new"], [...drafts, null]);
  if (!selected) return false;
  const subject = context.person || context.meeting || context.project || context.team || draftSubject(selected);
  await activateDraft(params, selected, `${targetFolder}/${datetime(params)} ${safeFilename(subject)}`);
  return true;
}

async function chooseOrg(params) {
  const orgs = orgFolders(params);
  if (orgs.length === 0) throw new Error("No org folders found.");
  return await choose(params, orgs, orgs, "org?", { back: false });
}

async function chooseFolder(params, basePath, prompt) {
  const names = folderNames(params, basePath);

  if (names.length === 0) {
    notice(`No folders found in ${basePath}.`);
    return null;
  }

  return await choose(params, names, names, prompt);
}

async function findMatchingDrafts(params, targetFolder, matchesDraft) {
  const { app } = env(params);
  const folder = app.vault.getAbstractFileByPath(targetFolder);
  if (!isFolder(folder)) return [];

  const drafts = [];
  for (const child of folder.children) {
    if (isFolder(child) || !child.path.endsWith(".md")) continue;
    const frontmatter = getFrontmatter(params, child);
    if (frontmatter && matchesDraft(frontmatter, child)) drafts.push(child);
  }

  return drafts.sort((a, b) => {
    const aCreated = String(getFrontmatter(params, a)?.created || "");
    const bCreated = String(getFrontmatter(params, b)?.created || "");
    return bCreated.localeCompare(aCreated);
  });
}

async function createFromTemplate(params, templatePath, targetPathWithoutExtension, values, label = "journal") {
  const { app } = env(params);
  const template = await readVaultFile(params, templatePath);
  const content = render(template, values);
  const targetPath = await uniqueMarkdownPath(params, targetPathWithoutExtension);
  const folderPath = targetPath.split("/").slice(0, -1).join("/");
  await ensureFolder(params, folderPath);

  const file = await app.vault.create(targetPath, content);
  await app.workspace.getLeaf().openFile(file);
  notice(`Created ${label}: ${targetPath}`);
  return file;
}

function journalModeValues(params, mode) {
  const value = nowIso(params);
  return {
    created: value,
    draftPlanningSection: mode === "draft" ? "## Talking Points\n\n- " : "",
  };
}

function getFrontmatterLineValue(content, key) {
  if (!content.startsWith("---\n")) return "";

  const end = content.indexOf("\n---", 4);
  if (end === -1) return "";

  const line = content.slice(4, end).split("\n").find((item) => item.startsWith(`${key}:`));
  if (!line) return "";

  return line.slice(key.length + 1).trim();
}

function upsertFrontmatterLine(content, key, value) {
  if (!content.startsWith("---\n")) return content;

  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;

  const lines = content.slice(4, end).split("\n");
  const existing = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (existing >= 0) {
    lines[existing] = `${key}: ${value}`;
  } else {
    const insertAt = frontmatterInsertIndex(lines, key);
    lines.splice(insertAt, 0, `${key}: ${value}`);
  }

  return `---\n${lines.join("\n")}${content.slice(end)}`;
}

function frontmatterInsertIndex(lines, key) {
  if (key === "drafted") {
    const createdIndex = lines.findIndex((line) => line.startsWith("created:"));
    if (createdIndex >= 0) return createdIndex;
  }

  if (key === "created") {
    const draftedIndex = lines.findIndex((line) => line.startsWith("drafted:"));
    if (draftedIndex >= 0) return draftedIndex + 1;
  }

  const anchors = ["topic:", "type:", "category:", "org:"];
  for (const anchor of anchors) {
    const index = lines.findIndex((line) => line.startsWith(anchor));
    if (index >= 0) return index + 1;
  }

  return lines.length;
}

function datetime(params) {
  return env(params).quickAddApi.date.now("YYYY-MM-DD HH-mm");
}

function nowIso(params) {
  return env(params).quickAddApi.date.now("YYYY-MM-DDTHH:mm");
}

function draftSubject(file) {
  return String(file?.basename || "")
    .replace(/^Draft\s+/, "")
    .trim();
}

function env(params) {
  return {
    app: params.app,
    quickAddApi: params.quickAddApi,
  };
}
}
