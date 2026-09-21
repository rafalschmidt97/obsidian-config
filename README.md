# obsidian-config

This is the architecture, templates, scripts, and Obsidian settings behind my
personal vault. It is the *system*, not the content. None of my actual notes are
here, and none ever will be (see [How the repo stays clean](#how-the-repo-stays-clean)).

I get asked how I organize Obsidian and what automation I run, so this is the
answer in one place. It changes over time as I change the vault.

## Start here (probably somewhere else)

If you are new to structured note-taking, start with Steph Ango's
[vault](https://stephango.com/vault). It is simpler, and it is the right default
for most people.

This repo is the opposite of minimal. It is a hybrid of Obsidian and Apple Notes
that grew out of how I actually work: fast capture like Apple Notes, with a
framework on top so structure stays explicit and queryable. It does the job for
me, and I expect to simplify it over time. If you prefer framework-style note
taking, here it is.

Where it really pays off is agentic note-taking. Handing an AI agent the design
doc and letting it create, route, and query notes works surprisingly well. That
alone makes the extra structure worth it for me.

## Core idea

Two common content shapes share the same contexts:

```text
Journal = an occurrence or reflection (meeting, 1-1, workout, event)
Note    = knowledge or material       (research, reference, idea)
```

The physical structure is `inbox/`, `areas/`, and `projects/` within each org.
An area holds ongoing context and resources; a project has a completion condition.
Notes, journals, and specialized content live together where they belong.

A small frontmatter schema drives templates and views:

| Field      | Meaning                                             | Example values                          |
| ---------- | --------------------------------------------------- | --------------------------------------- |
| `org`      | Work/life namespace (a top-level folder)            | `work`, `personal`                      |
| `category` | Primary note family (picks template + main view)    | `journal`, `note`, `person`, `project`  |
| `type`     | Category-specific subtype                           | `1-1`, `meeting`, `research`, `reflection` |
| `area`     | Ongoing context, linked to an Area profile           | `[[Health]]` |

`area` replaces subject-based routing through `topic`. Category and type stay:
a workout and a doctor visit both belong to Health, but remain different journal
types. Project, meeting, and person relationships retain their custom templates.

The full specification lives in
[`_obsidian_architecture/Obsidian design.md`](_obsidian_architecture/Obsidian%20design.md).
Start there if you want the reasoning behind every rule.

## Day to day

I capture first and organize when I have time:

- **Inbox** creates a quick, timestamped capture. Later, **Actions > Triage** gives
  it a title and routes it to the right place, preserving its content and metadata.
- **Journal** records events, meetings, and 1-1s. Regular entries default to
  `event`; drafts are for preparing upcoming occurrences and can be activated later.
- **Note** creates knowledge or reference material directly in its destination.
- **Area selection** is shared by Note and Journal: choose Loose, Area, Project,
  Meeting, Person, or Team. Select an existing area or create one while capturing.
- **Sport** goes directly to Health, asks only for a title, and shows previous sport sessions inside
  the new entry, across all activities. **Reflection** is for free-form thinking;
  **Monthly Reflection** is the period-based review. Sport and Reflection have no
  draft step.

Personal defaults are **Home, Cooking, Travel, Car, Friends, Health, Growth, and
Finances**. Each profile collects its content in live views. More areas can be
created under Entities > Area. Projects keep their own folders and can link to areas.

```text
personal/
  inbox/
  areas/
    finances/
      Finances.md
      Budget principles.md
      2026-09-20 Advisor call.md
    health/
    people/
    meetings/
    teams/
    resources/
    journal/      # Unassigned occurrences
    loose/        # Unassigned knowledge
    archive/
  projects/
    Change bank/
    archive/
```

Daily, weekly, and Bases folders support the content structure. A root archive
also preserves former orgs. Archiving a context keeps its files together.

Daily and weekly notes are normally accessed through periodic-note tooling.
The QuickAdd menu keeps common captures at the top, with **Actions** (Move / reassign,
Triage, Archive), **Entities** (profile creation), and **System** (area setup, periodic utilities and
refreshes) at the bottom. The exact menu is documented in
[`_scripts/README.md`](_scripts/README.md#quickadd-menu).

### Live views and task snapshots

**Bases** provides live views over note properties, such as sport history.
**Tasks**, **Priority**, and **Wishlist** are generated Markdown snapshots instead:
they collect open checkboxes from `## Tasks` sections in weekly notes, journals
(including drafts), project and area profiles, and books. They refresh on startup or through
**System > Tasks**. `#prio` also shows an item in Priority; `#wl` moves it to Wishlist.

Complete or edit a task in its source note. Checking a box in a generated snapshot
does not update the source and will be overwritten by the next refresh.

## What's in here

```text
_obsidian_architecture/   The design spec and working notes for the vault
_templates/               Dumb content templates with {{placeholders}}
  bases/                  Shared live views, including sport history
_scripts/                 QuickAdd + Templater automation (raw JS stored as .md)
  quickadd/               Explicit, command-driven note creation
  templater/              Folder-click creation adapters
  shared/                 Synced runtime helpers used by both entry paths
  tests/                  In-memory flow checks (local development only)
  config/                 Per-user settings (orgs, meal plan); *.example.json ships
.obsidian/                Curated subset of the real Obsidian config
categories.md             Global index-of-indexes
daily/  personal/  archive/  Empty placeholders showing the top-level layout
```

Two automation layers work together:

- **QuickAdd** owns explicit creation. You run a command, it asks a short chain
  of questions (`org?`, `where?`, `title?`), then writes the file into the right
  place with the right frontmatter.
- **Templater** owns folder-click creation. When you make a new file inside a
  meaningful folder, an adapter infers the context and renders the matching
  template.

Scripts are stored as raw JavaScript inside `.md` files on purpose, so Obsidian
Sync ships them to mobile as ordinary notes. Do not rename them to `.js`.

See [`_scripts/README.md`](_scripts/README.md) for the shared-runtime contract,
QuickAdd compatibility constraints, and verification command.

## Plugins

The setup leans on a handful of community plugins. The enabled list is in
[`.obsidian/community-plugins.json`](.obsidian/community-plugins.json); here is
what each one actually does here.

Automation backbone:

- **QuickAdd** — runs the explicit capture and maintenance commands in
  `_scripts/quickadd/`.
- **Templater** — powers folder-click and link-click creation and renders the
  templates; the `_scripts/templater/` adapters route a new file to the right one.

Agentic access, the part I care about most:

- **Local REST API & MCP Server** — exposes the vault over REST and MCP, so an AI
  agent can read, create, route, and query notes. This is what makes agentic
  note-taking work.

Navigation and search:

- **Notebook Navigator** — replaces the file explorer with a two-pane layout and
  owns root folder order.
- **Omnisearch** — fast full-text search across the vault.
- **Various Complements** — word autocompletion drawn from your own notes.

Content and links:

- **Link Embed** — Notion-style preview cards for pasted links (clippings, references).
- **Consistent Attachments and Links** — keeps links and attachments correct when
  notes move or get renamed, which happens constantly given all the routing.
- **Text Extractor** — OCR for images and PDFs, so screenshots and scans become
  searchable text.

Housekeeping and quality of life:

- **Advanced Find and Replace** — regex find/replace across the vault, for bulk
  edits and migrations.
- **Trash Explorer** — restore or purge trashed files; pairs with the script that
  trashes empty `Untitled` notes.
- **Super Simple Time Tracker** — lightweight time tracking inside notes.
- **Hide Sidebars on Window Resize** — auto-hides the sidebars on narrow windows.
- **Mobile Command Icons** — my own plugin; gives plugin commands real icons in the
  mobile toolbar (the scripts ship to mobile, so the mobile UI matters).

Core plugins carry the rest: **Bases** powers live note-property views,
and Daily Notes, Templates, Properties, and Sync are all on.

## Parametrized orgs

The scripts discover orgs from top-level folders, excluding `archive`, `daily`,
and names starting with `_` or `.`. Create a folder for each org you use.
The config controls picker priority and default selection; it does not create
orgs or restrict discovery to a list:

```bash
cp _scripts/config/orgs.example.json _scripts/config/orgs.json
# then edit orgs.json with your own orgs
```

```json
{
  "order": ["work", "personal"],
  "default": "work"
}
```

`orgs.json` is git-ignored. The runtime tries it first, then
`orgs.example.json` if it is missing or cannot be parsed. Without either usable
file, orgs sort alphabetically with `personal` last. With an `order` list,
listed orgs come first; remaining orgs use that same fallback ordering.

Flows that use a default, such as Open Weekly without an explicit org, select the
configured `default` when its folder exists, otherwise the first discovered org
(or `personal` if none exist). Other flows still ask for an org, and personal
capture flows deliberately target `personal/`.

Templater folder rules are configured separately: update their path patterns when
adding an org. Org settings are not the only local customization; meal-plan
placement and plugin command wiring also have example files.

## How the repo stays clean

This repo lives *inside* the vault, tracked by a strict allowlist
[`.gitignore`](.gitignore): it ignores everything, then re-includes only the
architecture and config surface. That means:

- No note content is tracked. `daily/`, `personal/`, and `archive/` ship as empty
  placeholders; other org folders are not in the repo at all.
- Secrets and machine state stay out: the Local REST API key, OCR caches, the
  word-completion dictionary, and workspace layout are all excluded.
- Org and meal-plan settings, QuickAdd wiring, and hotkeys have generic example
  files; the real configs are excluded. The household-specific Meal Plan template
  is also excluded and has no public replacement.

To audit exactly what is public, clone the repo and run `git ls-files`.

## Using this for your own vault

There is no installer. Treat it as a reference:

1. Read the design doc to decide which ideas fit your workflow. Create your org
   folders and the destinations needed by the flows you keep.
2. Install **QuickAdd** and **Templater**, and enable **Bases** for live views.
   The other [plugins](#plugins) support my setup; choose those you need.
3. Copy the scripts and their referenced templates, keeping the documented vault
   paths. Both QuickAdd capture scripts and Templater adapters require
   the whole `_scripts/shared/` directory. Folder capture also loads
   `_scripts/quickadd/journal.md`. Include the Area template and shared Bases under
   `_templates/bases/`. For Sport, include both
   `_templates/Journal Sport.md` and `_templates/bases/sport-history.base`.
4. Set up `orgs.json` as above. Use
   [`.obsidian/plugins/quickadd/data.example.json`](.obsidian/plugins/quickadd/data.example.json)
   as the starting point for QuickAdd's local `data.json`. Adapt the org-specific
   weekly shortcuts and remove choices you do not use. In an existing setup,
   merge the choices rather than replacing your plugin settings wholesale.
5. Configure Templater's template folder and new-file trigger with **file-pattern
   templates enabled and folder templates disabled**. Use the unified adapter at
   `_scripts/templater/apply-templateq-folder-template.md` for active org
   inbox/areas/projects/weekly paths and daily notes, excluding archive segments.
   The private Templater settings are not shipped; consult the design doc's
   [invocation modes](_obsidian_architecture/Obsidian%20design.md#invocation-modes)
   for routing behavior. Configure native daily/periodic-note tooling separately.
6. Run **System > Setup personal areas** once to create the eight defaults. The
   operation preserves existing profiles. Use
   [`areas.example.json`](areas.example.json) as the basis for an
   ignored `areas.json` if you want different defaults. Work areas are created as needed.
7. Keep the shared runtime and templates available on each device. Runtime scripts
   are Markdown files for Sync; `orgs.json` and other JSON settings also need to be
   available where you run them. Script checks run with
   `node --test _scripts/tests/flows.test.cjs`; these use an in-memory vault, so also
   try the chosen flows in Obsidian.

**Meal Plan needs local setup.** The example QuickAdd menu includes it, but
`_templates/Meal Plan.md` is not in this repo. Supply your own template and an ignored
`_scripts/config/mealplan.json` with `folder` and `planName`, or remove the choice.
The default destination is `personal/areas/cooking` and the filename label is
`Cooking Schedule`. The template receives period fields and `relationshipLines`
for its area link.

The private vault's other org-specific Bases and notes are not included either.
This is a reference configuration, not a complete vault ready to open and use.

## Existing-vault migrations

Back up the complete vault outside its directory before reorganizing content.
Record every source/destination, preserve attachments and custom metadata, and
compare link resolution before and after. Test real Base rendering as well as script
logic. The design documents this verification contract; private migration manifests
and note content are never published here.

Old subject metadata is retained as `legacyTopic` where it cannot be mapped safely
to an Area. Imported source-system `area` fields are preserved as `legacyArea`.
New captures use the current schema; historical metadata is not silently discarded.

## Inspiration and thanks

- Heavily inspired by Steph Ango's [vault](https://stephango.com/vault) (kepano).
  Most people should start there.
- The organizing ideas lean on [Building a Second Brain](https://www.buildingasecondbrain.com)
  (PARA, capture and distill) and [Getting Things Done](https://gettingthingsdone.com).
- Shaped by many discussions with experienced people who were generous with their
  time and thinking. Thank you.

## License

[MIT](LICENSE).
