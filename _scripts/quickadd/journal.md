// Raw JavaScript stored as .md so Obsidian Sync includes it on mobile.
const TEMPLATE_DIR = "_templates";

const TEMPLATE = {
  journal: `${TEMPLATE_DIR}/Journal.md`,
  person: `${TEMPLATE_DIR}/Journal Person.md`,
  meeting: `${TEMPLATE_DIR}/Journal Meeting.md`,
  project: `${TEMPLATE_DIR}/Journal Project.md`,
  team: `${TEMPLATE_DIR}/Journal Team.md`,
};

const IGNORED_PROJECT_FOLDERS = new Set(["journal", "meetings", "references", "Archives", "_attachments"]);
const IGNORED_ENTITY_FOLDERS = new Set(["Archives", "_attachments"]);
const IGNORED_ORG_FOLDERS = new Set(["archive", "daily"]);
// Org priority is data, not code. Real values live in _scripts/config/orgs.json (git-ignored);
// _scripts/config/orgs.example.json is the shared template. Loaded once per run by loadOrgConfig().
// Empty ORG_ORDER falls back to a name-free rule (see sortOrgNames): alphabetical, personal last.
let ORG_ORDER = [];
const BACK_LABEL = "← Back";

module.exports = {
  entry,
  journal,
  generic: journal,
  draft,
  future: draft,
  person,
  meeting,
  project,
  team,
};

async function entry(params, settings = {}) {
  await loadOrgConfig(params);
  return await runBackable(async () => {
    const flows = { journal, generic: journal, draft, future: draft, person, meeting, project, team };
    const flow = settings.flow ? flows[settings.flow] : journalMenu;
    if (!flow) throw new Error(`Unknown journal flow: ${settings.flow}`);
    return await flow(params, undefined, { draft: Boolean(settings.draft) });
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
  const { quickAddApi } = env(params);
  const org = selectedOrg ?? await chooseOrg(params);
  const type = await choose(params,
    ["none", "event", "reflection", "sport"],
    ["", "event", "reflection", "sport"],
    "type?"
  );

  const matchesDraft = (frontmatter, file) => {
    if (!isDraftJournal(frontmatter, org, file)) return false;
    if (frontmatter.meeting || frontmatter.project || frontmatter.team) return false;
    return (frontmatter.type || "") === type;
  };

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

  const attendees = type === "event" ? await optionalAttendees(params) : [];
  const title = await requiredInput(params, "title?");

  return await createOrActivateJournal(params, {
    template: TEMPLATE.journal,
    org,
    targetFolder: `${org}/journal`,
    filenameSubject: title,
    values: {
      org,
      typeLine: type ? `type: ${type}` : "",
      attendeesLine: formatWikilinkList("attendees", attendees),
    },
    matchesDraft,
  }, options.draft ? options : { ...options, skipDraftSearch: true });
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
    matchesDraft: (frontmatter, file) => {
      return isDraftJournal(frontmatter, org, file)
        && frontmatter.type === "1-1"
        && frontmatterValueMatchesLink(frontmatter.attendees, personName);
    },
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
    matchesDraft: (frontmatter, file) => {
      return isDraftJournal(frontmatter, org, file)
        && frontmatter.type === "project"
        && frontmatterValueMatchesLink(frontmatter.project, selectedProject.name);
    },
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
    matchesDraft: (frontmatter, file) => {
      return isDraftJournal(frontmatter, org, file)
        && frontmatter.type === "team"
        && frontmatterValueMatchesLink(frontmatter.team, teamName);
    },
  }, options);
}

async function createMeetingJournal(params, org, meetingInfo, options = {}) {
  const contextLines = [
    meetingInfo.project ? `project: "[[${meetingInfo.project}]]"` : "",
    meetingInfo.team ? `team: "[[${meetingInfo.team}]]"` : "",
  ].filter(Boolean).join("\n");

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
    matchesDraft: (frontmatter, file) => {
      return isDraftJournal(frontmatter, org, file)
        && frontmatter.type === "meeting"
        && frontmatterValueMatchesLink(frontmatter.meeting, meetingInfo.name);
    },
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

async function runBackable(action) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (isBack(error)) continue;
      throw error;
    }
  }

  notice("Back limit reached.");
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
  const { app, quickAddApi } = env(params);
  const orgs = app.vault.getRoot().children
    .filter((child) => isFolder(child) && !child.name.startsWith("_") && !child.name.startsWith(".") && !IGNORED_ORG_FOLDERS.has(child.name))
    .map((child) => child.name)
    .sort(sortOrgNames);

  if (orgs.length === 0) throw new Error("No org folders found.");
  return await choose(params, orgs, orgs, "org?", { back: false });
}

function sortOrgNames(a, b) {
  const aIndex = ORG_ORDER.indexOf(a);
  const bIndex = ORG_ORDER.indexOf(b);
  if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  if ((a === "personal") !== (b === "personal")) return a === "personal" ? 1 : -1;
  return a.localeCompare(b);
}

// Best-effort load of org priority from _scripts/config/orgs.json (falls back to orgs.example.json,
// then to the name-free rule in sortOrgNames). Never throws: the vault must keep working
// even if no config file exists.
async function loadOrgConfig(params) {
  try {
    const { app } = env(params);
    for (const path of ["_scripts/config/orgs.json", "_scripts/config/orgs.example.json"]) {
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

async function chooseFolder(params, basePath, prompt) {
  const { app, quickAddApi } = env(params);
  const folder = app.vault.getAbstractFileByPath(basePath);
  const names = isFolder(folder)
    ? folder.children
        .filter((child) => isFolder(child) && !child.name.startsWith("_") && !IGNORED_ENTITY_FOLDERS.has(child.name))
        .map((child) => child.name)
        .sort((a, b) => a.localeCompare(b))
    : [];

  if (names.length === 0) {
    notice(`No folders found in ${basePath}.`);
    return null;
  }

  return await choose(params, names, names, prompt);
}

function findMeetingFolders(params, rootPath) {
  const { app } = env(params);
  const root = app.vault.getAbstractFileByPath(rootPath);
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

        results.push({
          name: child.name,
          path: child.path,
          project,
          team,
          label: context ? `${context} / ${child.name}` : child.name,
        });
      }
      return;
    }

    for (const child of folder.children) {
      if (isFolder(child) && !child.name.startsWith("_") && child.name !== "Archives") walk(child);
    }
  };

  walk(root);
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

function findProjectFolders(params, basePath) {
  const { app } = env(params);
  const root = app.vault.getAbstractFileByPath(basePath);
  const results = [];

  const addProject = (folder) => {
    const label = folder.path.slice(`${basePath}/`.length).replace(/\/projects\//g, " / ");
    results.push({ name: folder.name, path: folder.path, label });
  };

  const walkProject = (folder) => {
    if (!isFolder(folder)) return;
    const nestedProjects = folder.children.find((child) => isFolder(child) && child.name === "projects");
    if (!isFolder(nestedProjects)) return;

    for (const child of nestedProjects.children) {
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
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function renameFile(params, file, targetPath) {
  const { app } = env(params);
  if (app.fileManager?.renameFile) {
    await app.fileManager.renameFile(file, targetPath);
    return;
  }

  await app.vault.rename(file, targetPath);
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
  const { app } = env(params);
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) throw new Error(`Template not found: ${path}`);
  return await app.vault.cachedRead(file);
}

async function requiredInput(params, prompt) {
  const { quickAddApi } = env(params);
  const value = await quickAddApi.inputPrompt(prompt);
  if (!value || !value.trim()) throw new Error(`${prompt} is required.`);
  return value.trim();
}

async function optionalAttendees(params) {
  const { quickAddApi } = env(params);
  const value = await quickAddApi.inputPrompt("attendees? optional, comma-separated");
  if (!value || !value.trim()) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatWikilinkList(key, values) {
  if (!values.length) return "";
  const lines = values.map((value) => `  - "${escapeYamlString(wikilink(value))}"`);
  return `${key}:\n${lines.join("\n")}`;
}

function wikilink(value) {
  if (value.startsWith("[[") && value.endsWith("]]")) return value;
  return `[[${value}]]`;
}

function escapeYamlString(value) {
  return String(value).replace(/"/g, '\\"');
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

function render(template, values) {
  return stripEmptyFrontmatterLines(
    template.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? "")
  );
}

function stripEmptyFrontmatterLines(content) {
  if (!content.startsWith("---\n")) return content;

  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;

  const frontmatter = content.slice(4, end)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");

  return `---\n${frontmatter}${content.slice(end)}`;
}

function getFrontmatter(params, file) {
  return env(params).app.metadataCache.getFileCache(file)?.frontmatter || null;
}

function isDraftJournal(frontmatter, org, file) {
  return frontmatter.category === "journal"
    && frontmatter.org === org
    && Boolean(frontmatter.created)
    && !frontmatter.drafted
    && file?.basename?.startsWith("Draft ");
}

function hasRelationship(frontmatter) {
  return Boolean(frontmatter.attendees || frontmatter.meeting || frontmatter.project || frontmatter.team);
}

function frontmatterValueMatchesLink(value, name) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some((item) => frontmatterValueMatchesLink(item, name));
  return String(value).includes(`[[${name}]]`);
}

function nearestContext(parts, marker, beforeIndex) {
  for (let index = Math.min(beforeIndex, parts.length - 1); index >= 0; index--) {
    if (parts[index] === marker) return parts[index + 1] || "";
  }
  return "";
}

function datetime(params) {
  return env(params).quickAddApi.date.now("YYYY-MM-DD HH-mm");
}

function nowIso(params) {
  return env(params).quickAddApi.date.now("YYYY-MM-DDTHH:mm");
}

function safeFilename(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function draftSubject(file) {
  return String(file?.basename || "")
    .replace(/^Draft\s+/, "")
    .trim();
}

function isFolder(file) {
  return file && Array.isArray(file.children);
}

function notice(message) {
  if (typeof Notice !== "undefined") new Notice(message);
  return null;
}

function env(params) {
  return {
    app: params.app,
    quickAddApi: params.quickAddApi,
  };
}
