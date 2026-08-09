// Raw QuickAdd user script stored as .md so Obsidian Sync includes it on mobile.
module.exports = { entry };

async function entry(params) {
  const { app } = env(params);
  const candidates = app.vault.getMarkdownFiles()
    .filter((file) => !file.path.startsWith(".trash/"))
    .filter((file) => isUntitledNote(file.path));

  const emptyNotes = [];
  for (const file of candidates) {
    const content = await app.vault.cachedRead(file);
    if (content.trim().length === 0 || !hasBodyContent(content)) {
      emptyNotes.push(file);
    }
  }

  if (emptyNotes.length === 0) {
    new Notice("No empty Untitled notes found.");
    return [];
  }

  const preview = emptyNotes.slice(0, 10).map((file) => `- ${file.path}`).join("\n");
  const suffix = emptyNotes.length > 10 ? `\n...and ${emptyNotes.length - 10} more` : "";
  const confirmed = window.confirm(`Move ${emptyNotes.length} empty Untitled notes to Obsidian trash?\n\n${preview}${suffix}`);
  if (!confirmed) {
    new Notice("Cleanup cancelled.");
    return [];
  }

  const moved = [];
  for (const file of emptyNotes) {
    if (app.vault.trash) {
      await app.vault.trash(file, false);
    } else {
      await app.vault.delete(file);
    }
    moved.push(file.path);
  }

  new Notice(`Moved ${moved.length} empty Untitled notes to trash.`);
  return moved;
}

function isUntitledNote(path) {
  const name = path.split("/").pop();
  return /^Untitled(?: \d+)*\.md$/.test(name) || /^Untitled document - [^.]+\.md$/.test(name);
}

function hasBodyContent(content) {
  const body = content.replace(/^---\n[\s\S]*?\n---\s*/m, "");
  return body.trim().length > 0;
}

function env(params) {
  return { app: params.app, quickAddApi: params.quickAddApi };
}
