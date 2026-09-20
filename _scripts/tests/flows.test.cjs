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
  add('_scripts/shared/runtime.md', fs.readFileSync(path.join(root, '_scripts/shared/runtime.md'), 'utf8'));
  add('_scripts/quickadd/journal.md', fs.readFileSync(path.join(root, '_scripts/quickadd/journal.md'), 'utf8'));
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
      processFrontMatter: async (f, update) => {
        // Model the documented API contract: mutate properties, preserve everything after YAML.
        const match = /^---\r?\n[\s\S]*?\r?\n---/.exec(f.content);
        const body = match ? f.content.slice(match[0].length) : `\n\n${f.content}`;
        update(f.fm);
        f.content = `---\n${JSON.stringify(f.fm, null, 2)}\n---${body}`;
      },
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
    // QuickAdd 2.12.3's synchronous wrapper, with desktop require unavailable like mobile.
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    vm.runInContext(`(function(require, module, exports) {${source}\n})(() => undefined, module, module.exports)`, context);
    return context.module.exports;
  }
  function template(name) { return add(`_templates/${name}.md`, fs.readFileSync(path.join(root, `_templates/${name}.md`), 'utf8')); }
  async function templater(relative, currentPath) {
    const file = files.get(currentPath);
    const tp = {
      file: { content: file.content, path: () => currentPath, title: file.basename,
        move: async p => { if (`${p}.md` !== file.path) await app.fileManager.renameFile(file, `${p}.md`); } },
      date: quickAddApi.date,
      system: { prompt: quickAddApi.inputPrompt,
        suggester: (labels, values, required, prompt) => quickAddApi.suggester(labels, values, prompt) },
    };
    const source = fs.readFileSync(path.join(root, relative), 'utf8').replace(/^<%\*\s*/, '').replace(/-%>\s*$/, '');
    const context = vm.createContext({ app, tp, tR: '', Notice: class {}, console });
    await vm.runInContext(`(async () => {${source}\n})()`, context);
    if (files.get(file.path) === file) file.content = context.tR;
    return file;
  }
  return { files, app, quickAddApi, opened, prompts, load, template, folder, add, templater };
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

test('both team creation paths produce a discoverable entity folder', async () => {
  for (const mode of ['quickadd', 'templater']) {
    const f = fixture([], mode === 'quickadd' ? ['work', 'Engineering'] : ['Engineering']);
    f.template('Team');
    if (mode === 'quickadd') await f.load('_scripts/quickadd/templates.md').entry(f, { flow: 'team' });
    else {
      f.add('work/teams/Untitled.md');
      await f.templater('_scripts/templater/apply-templateq-folder-template.md', 'work/teams/Untitled.md');
    }
    assert.match(f.files.get('work/teams/Engineering/Engineering.md').content, /category: team/);
    assert.ok(f.files.get('work/teams').children.some(x => x.name === 'Engineering' && x.children));
    assert.ok(!f.files.has('work/teams/Engineering.md'));
  }
});

test('mixed topic folders ask note or invoice; dedicated invoices stay automatic', async () => {
  for (const topic of ['healthcare', 'assets/car', 'assets/house', 'assets/finances/invoices']) {
    for (const category of topic.endsWith('/invoices') ? ['invoice'] : ['note', 'invoice']) {
      const f = fixture([], [...(topic.endsWith('/invoices') ? [] : [category]), 'Record']);
      f.template('Note'); f.template('Invoice');
      const base = `personal/notes/${topic}`;
      f.add(`${base}/Untitled.md`);
      const file = await f.templater('_scripts/templater/apply-templateq-folder-template.md', `${base}/Untitled.md`);
      assert.equal(file.path, `${base}/${category === 'invoice' ? '2026-09-20 ' : ''}Record.md`);
      assert.match(file.content, new RegExp(`category: ${category}`));
      assert.ok(file.content.includes(`topic: "${topic}"`));
      assert.equal(f.prompts.includes('category?'), !topic.endsWith('/invoices'));
    }
  }
});

test('triage preserves custom metadata, capture time and exact body while changing route', async () => {
  const body = '\n\n\n## Draft\n\nText with [[links]].\n';
  const fm = { org: 'personal', category: 'note', type: 'inbox', topic: 'old', created: '2026-01-02T09:15',
    aliases: ['Original'], source: 'https://example.org', custom: { nested: ['keep', 42] }, project: '[[Alpha]]' };
  const f = fixture([['personal/inbox/Capture.md', `---\norg: personal\n---${body}`, fm]],
    ['personal/ Capture', 'move', 'work', 'notes', 'references', 'Knowledge']);
  f.folder('work/notes/references');
  await f.load('_scripts/quickadd/templates.md').entry(f, { flow: 'triage' });
  const moved = f.files.get('work/notes/references/Knowledge.md');
  assert.ok(moved);
  assert.equal(moved.fm.org, 'work'); assert.equal(moved.fm.type, 'reference'); assert.equal(moved.fm.topic, 'references');
  assert.equal(moved.fm.created, '2026-01-02T09:15');
  assert.deepEqual(moved.fm.aliases, ['Original']); assert.deepEqual(moved.fm.custom, { nested: ['keep', 42] });
  assert.equal(moved.fm.source, 'https://example.org'); assert.equal(moved.fm.project, '[[Alpha]]');
  assert.equal(moved.content.slice(moved.content.indexOf('\n---') + 4), body);
});

test('triage to a project clears inbox type and old topic but preserves unrelated fields', async () => {
  const f = fixture([['personal/inbox/Capture.md', 'Body', { type: 'inbox', topic: 'old', aliases: ['Keep'] }]],
    ['personal/ Capture', 'move', 'work', 'projects', 'Alpha', 'Plan']);
  f.folder('work/projects/Alpha');
  await f.load('_scripts/quickadd/templates.md').entry(f, { flow: 'triage' });
  const fm = f.files.get('work/projects/Alpha/Plan.md').fm;
  assert.equal(fm.type, undefined); assert.equal(fm.topic, undefined);
  assert.equal(fm.project, '[[Alpha]]'); assert.equal(fm.created, '2026-09-20T12:00');
  assert.deepEqual(fm.aliases, ['Keep']);
});

test('folder-click now activates matching drafts for each supported journal context', async () => {
  for (const [folder, subject, context, extraAnswers] of [
    ['work/people/Alex', 'Alex', { type: '1-1', attendees: ['[[Alex]]'] }, []],
    ['work/meetings/Review', 'Review', { type: 'meeting', meeting: '[[Review]]' }, []],
    ['work/teams/Engineering/journal', 'Engineering', { type: 'team', team: '[[Engineering]]' }, []],
    ['work/journal', 'Visit', { type: 'event' }, ['event']],
  ]) {
    const body = '\n\n## Talking Points\n\n- Keep preparation\n';
    const fm = { org: 'work', category: 'journal', created: '2026-09-01T10:00', ...context };
    const raw = `---\norg: work\ncategory: journal\ncreated: 2026-09-01T10:00\ncustom: keep\n---${body}`;
    const f = fixture([[`${folder}/Draft ${subject}.md`, raw, fm], [`${folder}/Untitled.md`, '']],
      ['now', ...extraAnswers, `use draft: Draft ${subject}`]);
    await f.templater('_scripts/templater/apply-journalq-folder-template.md', `${folder}/Untitled.md`);
    const result = f.files.get(`${folder}/2026-09-20 12-00 ${subject}.md`);
    assert.ok(result); assert.match(result.content, /drafted: 2026-09-01T10:00/);
    assert.match(result.content, /created: 2026-09-20T12:00/); assert.match(result.content, /custom: keep/);
    assert.ok(result.content.endsWith(body));
    assert.ok(!f.files.has(`${folder}/Untitled.md`)); assert.ok(!f.prompts.includes('title?'));
  }
});

test('folder-click create new leaves a draft intact; activation uses collision-safe names', async () => {
  const base = 'work/people/Alex';
  const fm = { org: 'work', category: 'journal', type: '1-1', attendees: ['[[Alex]]'], created: '2026-09-01T10:00' };
  for (const choice of ['create new', 'use draft: Draft Alex']) {
    const f = fixture([[`${base}/Draft Alex.md`, '---\ncreated: 2026-09-01T10:00\n---\nPrep', fm],
      [`${base}/2026-09-20 12-00 Alex.md`, 'Existing'], [`${base}/Untitled.md`, '']], ['now', choice]);
    f.template('Journal Person');
    await f.templater('_scripts/templater/apply-journalq-folder-template.md', `${base}/Untitled.md`);
    assert.equal(f.files.get(`${base}/2026-09-20 12-00 Alex.md`).content, 'Existing');
    assert.ok(f.files.has(`${base}/2026-09-20 12-00 Alex (1).md`));
    assert.equal(f.files.has(`${base}/Draft Alex.md`), choice === 'create new');
  }
});

test('Open Weekly uses canonical local config, example fallback and explicit overrides', async () => {
  for (const [configPath, config, settings, expected] of [
    ['_scripts/config/orgs.json', { default: 'personal' }, {}, 'personal'],
    ['_scripts/config/orgs.example.json', { order: ['personal', 'work'] }, {}, 'personal'],
    ['_scripts/config/orgs.json', { default: 'personal' }, { org: 'work' }, 'work'],
  ]) {
    const f = fixture([[configPath, JSON.stringify(config)]]);
    f.template('Weekly');
    await f.load('_scripts/quickadd/Open Weekly.md').entry(f, settings);
    assert.equal(f.opened.length, 1);
    assert.ok(f.opened[0].startsWith(`${expected}/weekly/`));
  }
});

test('shared runtime handles nested discovery, org priority and local calendar boundaries', async () => {
  const f = fixture([['_scripts/config/orgs.json', JSON.stringify({ order: ['personal', 'work'], default: 'personal' })]]);
  for (const p of ['archive/work/projects/Old', 'daily', 'work/projects/Alpha/projects/Beta/meetings/Review', 'work/teams/Engineering/meetings/Planning']) f.folder(p);
  const shared = await f.load('_scripts/shared/runtime.md').create(f.app);
  assert.deepEqual(Array.from(shared.orgFolders()), ['personal', 'work']);
  assert.equal(await shared.defaultOrg(), 'personal');
  assert.deepEqual(Array.from(shared.findProjectFolders(f, 'work/projects'), p => p.label), ['Alpha', 'Alpha / Beta']);
  const meetings = shared.findMeetingFolders(f, 'work');
  assert.equal(meetings.find(x => x.name === 'Review').project, 'Beta');
  assert.equal(meetings.find(x => x.name === 'Planning').team, 'Engineering');
  const week = shared.weeklyValues('work', new Date(2027, 0, 1, 0, 15));
  assert.equal(week.filename, '2026-12-28--01-03 Work');
  assert.equal(week.end, '2027-01-04'); assert.equal(week.next, '2027-01-04--01-10 Work');
  assert.equal(shared.previousMonthRange(new Date(2027, 0, 1)).start, '2026-12-01');
  assert.equal(shared.dailyValues(shared.orgFolders(), new Date(2026, 8, 20, 0, 15)).date, '2026-09-20');
});

test('QuickAdd and folder-click share periodic values and configured org order', async () => {
  const seeds = [['_scripts/config/orgs.json', JSON.stringify({ order: ['personal', 'work'] })]];
  const a = fixture(seeds, ['pick a date…', '2026-09-20']); a.template('Daily');
  await a.load('_scripts/quickadd/templates.md').entry(a, { flow: 'daily' });
  const b = fixture(seeds); b.template('Daily'); b.add('personal/inbox/2026-09-20.md');
  await b.templater('_scripts/templater/apply-templateq-folder-template.md', 'personal/inbox/2026-09-20.md');
  assert.equal(a.files.get('daily/2026-09-20.md').content, b.files.get('daily/2026-09-20.md').content);
  const c = fixture([], ['work']); c.template('Weekly');
  await c.load('_scripts/quickadd/templates.md').entry(c, { flow: 'weekly' });
  const d = fixture(); d.template('Weekly');
  await d.load('_scripts/quickadd/Open Weekly.md').entry(d, { org: 'work' });
  assert.equal(c.files.get(c.opened[0]).content, d.files.get(d.opened[0]).content);
});

test('startup creates periods once without opening or overwriting them', async () => {
  const f = fixture(); f.template('Weekly'); f.template('Daily');
  const script = f.load('_scripts/quickadd/templates.md');
  await script.entry(f, { flow: 'periodicAuto' });
  const periods = [...f.files.values()].filter(x => /^(daily\/|(?:work|personal)\/weekly\/).*\.md$/.test(x.path));
  assert.equal(periods.length, 3);
  periods[0].content = 'User edits';
  await script.entry(f, { flow: 'periodicAuto' });
  assert.equal(periods[0].content, 'User edits'); assert.equal(f.opened.length, 0);
});

test('QuickAdd note routing and journal draft reuse work without Node imports', async () => {
  const f = fixture([], ['work', 'projects', 'Alpha', 'Plan']);
  f.folder('work/projects/Alpha'); f.template('Note');
  await f.load('_scripts/quickadd/templates.md').entry(f, { flow: 'note' });
  assert.match(f.files.get('work/projects/Alpha/Plan.md').content, /project: "\[\[Alpha\]\]"/);
  const j = fixture([], ['work', 'draft', 'person', 'Alex', 'work', 'draft', 'person', 'Alex']);
  j.folder('work/people/Alex'); j.template('Journal Person');
  const script = j.load('_scripts/quickadd/journal.md');
  await script.entry(j); await script.entry(j);
  assert.equal(j.opened[0], 'work/people/Alex/Draft Alex.md'); assert.equal(j.opened[1], j.opened[0]);
  assert.ok(!j.files.has('work/people/Alex/Draft Alex (1).md'));
});

test('exports are synchronous and missing runtime fails before creating content', async () => {
  for (const file of ['journal.md', 'templates.md', 'actionpoints.md', 'Open Weekly.md']) {
    const f = fixture();
    const script = f.load(`_scripts/quickadd/${file}`);
    assert.equal(typeof script.entry, 'function');
    f.files.delete('_scripts/shared/runtime.md');
    const count = f.files.size;
    await assert.rejects(script.entry(f), /Shared runtime missing/);
    assert.equal(f.files.size, count);
  }
});

test('QuickAdd event journals go straight to title in now and draft modes', async () => {
  for (const mode of ['now', 'draft']) {
    const f = fixture([], ['work', mode, 'journal', 'Visit']);
    f.template('Journal');
    await f.load('_scripts/quickadd/journal.md').entry(f);
    assert.deepEqual(f.prompts, ['org?', 'mode?', 'where?', 'title?']);
    const name = mode === 'draft' ? 'Draft Visit' : '2026-09-20 12-00 Visit';
    const file = f.files.get(`work/journal/${name}.md`);
    assert.ok(file);
    assert.match(file.content, /attendees: \[\]/);
    assert.match(file.content, /type: event/);
  }
});

test('Sport and Reflection create immediate entries even with a legacy draft or draft setting', async () => {
  for (const type of ['sport', 'reflection']) {
    const org = type === 'sport' ? 'personal' : 'work';
    const orgAnswers = type === 'sport' ? [] : [org];
    const draftPath = `${org}/journal/Draft Session.md`;
    const f = fixture([[draftPath, 'Old preparation', { org, category: 'journal', type, created: '2026-09-01T10:00' }]], [...orgAnswers, 'Session']);
    f.template('Journal'); f.template('Journal Sport');
    const script = f.load('_scripts/quickadd/journal.md');
    await script.entry(f, { flow: type, draft: true });
    assert.ok(f.files.has(`${org}/journal/2026-09-20 12-00 Session.md`));
    assert.deepEqual(f.prompts, [...(type === 'sport' ? [] : ['org?']), 'title?']);
    assert.equal(f.files.get(draftPath).content, 'Old preparation');
    assert.doesNotMatch(f.files.get(`${org}/journal/2026-09-20 12-00 Session.md`).content, /## Talking Points/);
  }
});

test('public QuickAdd config registers distinct Sport and Reflection commands', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.obsidian/plugins/quickadd/data.example.json'), 'utf8'));
  assert.equal(new Set(config.choices.map(c => c.id)).size, config.choices.length);
  for (const name of ['Sport', 'Reflection']) {
    const choice = config.choices.find(c => c.name === name);
    assert.equal(choice.command, true);
    assert.equal(choice.macro.commands[0].settings.flow, name.toLowerCase());
    assert.equal(choice.macro.commands[0].path, '_scripts/quickadd/journal.md');
  }
});

test('QuickAdd menu nests entity creation and Tasks without losing existing commands', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.obsidian/plugins/quickadd/data.example.json'), 'utf8'));
  const rootIds = config.choices.map(c => c.id);
  const entities = config.choices.find(c => c.id === 'entities-menu');
  assert.equal(entities.type, 'Multi');
  assert.deepEqual(entities.choices.map(c => c.id), ['person', 'meeting', 'project', 'team']);
  const system = config.choices.find(c => c.id === 'system-menu');
  assert.deepEqual(system.choices.map(c => c.id), ['daily', 'action-points', 'action-points-startup', 'periodic-startup']);
  for (const id of ['person', 'meeting', 'project', 'team', 'daily', 'action-points']) assert.ok(!rootIds.includes(id));
  const flatten = choices => choices.flatMap(c => [c, ...flatten(c.choices || [])]);
  const all = flatten(config.choices);
  assert.equal(new Set(all.map(c => c.id)).size, all.length);
  assert.equal(all.filter(c => c.type === 'Macro').length, 27);
  assert.equal(all.filter(c => c.runOnStartup).length, 2);
  assert.deepEqual(rootIds, ['inbox', 'triage', 'archive', 'journal', 'journal-sport', 'journal-reflection',
    'note', 'entities-menu', 'book', 'clipping', 'invoice', 'document', 'place', 'trip', 'transcript',
    'weekly-menu', 'monthly-reflection', 'meal-plan', 'system-menu']);
  const localPath = path.join(root, '.obsidian/plugins/quickadd/data.json');
  if (fs.existsSync(localPath)) {
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    assert.deepEqual(local.choices.map(c => c.id), rootIds);
    for (const id of ['entities-menu', 'system-menu']) {
      assert.deepEqual(local.choices.find(c => c.id === id), config.choices.find(c => c.id === id));
    }
  }
});

test('sport capture embeds history through QuickAdd and folder-click', async () => {
  for (const mode of ['quickadd', 'templater']) {
    const f = fixture([], mode === 'quickadd' ? ['Training'] : ['now', 'sport', 'Training']);
    f.template('Journal Sport');
    if (mode === 'quickadd') await f.load('_scripts/quickadd/journal.md').entry(f, { flow: 'sport' });
    else {
      f.add('personal/journal/Untitled.md');
      await f.templater('_scripts/templater/apply-journalq-folder-template.md', 'personal/journal/Untitled.md');
    }
    const content = f.files.get('personal/journal/2026-09-20 12-00 Training.md').content;
    assert.match(content, /!\[\[sport-history\.base#Previous sessions\]\]/);
    assert.match(content, /type: sport/);
    assert.ok(!content.includes('{{'));
  }
});
