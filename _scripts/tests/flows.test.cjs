// Local verification only; runtime scripts stay in synced Markdown files.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function fixture(seeds = [], answers = []) {
  const files = new Map();
  const opened = [];
  const prompts = [];
  function folder(p) {
    if (files.has(p)) return files.get(p);
    const parent = p ? folder(p.split('/').slice(0, -1).join('/')) : null;
    const file = { path: p, name: p.split('/').pop(), children: [] };
    files.set(p, file);
    if (parent) parent.children.push(file);
    return file;
  }
  function add(p, content = '', fm = {}) {
    const parent = folder(p.split('/').slice(0, -1).join('/'));
    const file = { path: p, name: p.split('/').pop(), basename: p.split('/').pop().replace(/\.md$/, ''), content, fm, parent };
    files.set(p, file);
    parent.children.push(file);
    return file;
  }
  folder(''); folder('work'); folder('personal');
  for (const seed of seeds) add(...seed);
  const app = {
    vault: {
      getRoot: () => files.get(''),
      getAbstractFileByPath: p => files.get(p),
      getMarkdownFiles: () => [...files.values()].filter(f => f.path.endsWith('.md')),
      read: async f => f.content,
      cachedRead: async f => f.content,
      createFolder: async p => folder(p),
      create: async (p, content) => { assert.ok(!files.has(p), `collision: ${p}`); return add(p, content); },
      modify: async (f, content) => { f.content = content; },
      delete: async f => { files.delete(f.path); f.parent.children = f.parent.children.filter(x => x !== f); },
    },
    metadataCache: { getFileCache: f => ({ frontmatter: f.fm }) },
    workspace: {
      getLeaf: () => ({ openFile: async f => opened.push(f.path) }),
      openLinkText: async p => opened.push(p),
    },
    fileManager: {
      renameFile: async (f, p) => {
        assert.ok(!files.has(p), `collision: ${p}`);
        files.delete(f.path);
        f.parent.children = f.parent.children.filter(x => x !== f);
        f.parent = folder(p.split('/').slice(0, -1).join('/'));
        f.parent.children.push(f);
        f.path = p; f.name = p.split('/').pop(); f.basename = f.name.replace(/\.md$/, '');
        files.set(p, f);
      },
    },
  };
  const dates = { 'YYYY-MM-DDTHH:mm': '2026-09-20T12:00', 'YYYY-MM-DD HH-mm': '2026-09-20 12-00', 'YYYY-MM-DD': '2026-09-20', 'YYYY-MM-DD HH-mm-ss': '2026-09-20 12-00-00' };
  const quickAddApi = {
    date: { now: format => dates[format] },
    suggester: async (labels, values, prompt) => {
      prompts.push(prompt);
      const answer = answers.shift();
      const index = labels.indexOf(answer);
      assert.notEqual(index, -1, `Unexpected answer ${answer} for ${prompt}: ${labels}`);
      return values[index];
    },
    inputPrompt: async prompt => { prompts.push(prompt); assert.ok(answers.length, `No answer for ${prompt}`); return answers.shift(); },
  };
  function load(relative) {
    const context = vm.createContext({ module: { exports: {} }, console, setTimeout, clearTimeout });
    vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context);
    return context.module.exports;
  }
  function template(name) { return add(`_templates/${name}.md`, fs.readFileSync(path.join(root, `_templates/${name}.md`), 'utf8')); }
  return { files, app, quickAddApi, opened, prompts, load, template, folder, add };
}

test('project tasks enter all three views, respecting markers, scope, status and completion', async () => {
  const fm = { org: 'work', category: 'project', created: '2026-09-01', status: 'active' };
  const f = fixture([
    ['work/projects/Alpha/Alpha.md', '## Tasks\n- [ ] Ship #prio\n- [ ] Later #wl\n- [ ] Ordinary\n- [x] Done\n## Notes\n- [ ] Outside', fm],
    ['archive/work/projects/Old/Old.md', '## Tasks\n- [ ] Archived path', fm],
    ['work/projects/Closed/Closed.md', '## Tasks\n- [ ] Archived status', { ...fm, status: 'archived' }],
    ['personal/projects/Other/Other.md', '## Tasks\n- [ ] Other org', { ...fm, org: 'personal' }],
  ], ['work', 'tasks']);
  const original = f.files.get('work/projects/Alpha/Alpha.md').content;
  await f.load('_scripts/quickadd/actionpoints.md').entry(f);
  const tasks = f.files.get('work/bases/Work Tasks.md').content;
  const priority = f.files.get('work/bases/Work Priority.md').content;
  const wishlist = f.files.get('work/bases/Work Wishlist.md').content;
  assert.match(tasks, /## Project Tasks/);
  assert.match(tasks, /\[\[work\/projects\/Alpha\/Alpha\|Alpha\]\]/);
  assert.match(tasks, /Ship #prio/); assert.match(tasks, /Ordinary/);
  assert.match(priority, /Ship #prio/); assert.doesNotMatch(priority, /Ordinary/);
  assert.match(wishlist, /- \[ \] Later\n/);
  assert.doesNotMatch(tasks + priority, /Later/);
  assert.doesNotMatch(tasks + priority + wishlist, /Done|Outside|Archived path|Archived status|Other org/);
  assert.equal(f.files.get('work/projects/Alpha/Alpha.md').content, original);
});
