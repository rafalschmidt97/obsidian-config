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

Everything in the vault is one of two things:

```text
Journal = something happened   (a meeting, a 1-1, a workout, an event)
Note    = knowledge or thought (research, a draft, a reference, an idea)
```

On top of that, a small frontmatter schema drives templates, folders, and
queries instead of relying on tags or paths:

| Field      | Meaning                                             | Example values                          |
| ---------- | --------------------------------------------------- | --------------------------------------- |
| `org`      | Work/life namespace (a top-level folder)            | `work`, `personal`                      |
| `category` | Primary note family (picks template + main view)    | `journal`, `note`, `person`, `project`  |
| `type`     | Category-specific subtype                           | `1-1`, `meeting`, `research`, `reflection` |
| `topic`    | Durable subject bucket, survives folder moves       | `career`, `learning`, `assets/finances` |

The full specification lives in
[`_obsidian_architecture/Obsidian design.md`](_obsidian_architecture/Obsidian%20design.md).
Start there if you want the reasoning behind every rule.

## What's in here

```text
_obsidian_architecture/   The design spec and working notes for the vault
_templates/               Dumb content templates with {{placeholders}}
_scripts/                 QuickAdd + Templater automation (raw JS stored as .md)
  quickadd/               Explicit, command-driven note creation
  templater/              Folder-click creation adapters
  orgs.example.json       Org priority config (copy to orgs.json for your setup)
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

## Parametrized orgs

The one thing that is genuinely per-person is the list of orgs. The scripts read
it from a config file so no org name is hardcoded:

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

`orgs.json` is git-ignored, so your real org names stay on your machine. If the
file is missing, the scripts fall back to a safe rule: sort org folders
alphabetically and always put `personal` last. The vault keeps working either way.

## How the repo stays clean

This repo lives *inside* the vault, tracked by a strict allowlist
[`.gitignore`](.gitignore): it ignores everything, then re-includes only the
architecture and config surface. That means:

- No note content is tracked. `daily/`, `personal/`, and `archive/` ship as empty
  placeholders; other org folders are not in the repo at all.
- Secrets and machine state stay out: the Local REST API key, OCR caches, the
  word-completion dictionary, and workspace layout are all excluded.
- Per-user config (`orgs.json`) and a household-specific template are excluded in
  favor of a generic example.

To audit exactly what is public, clone the repo and run `git ls-files`.

## Using this for your own vault

There is no installer. Treat it as a reference:

1. Read the design doc to decide which ideas fit your workflow.
2. Install the community plugins listed in
   [`.obsidian/community-plugins.json`](.obsidian/community-plugins.json)
   (QuickAdd, Templater, Bases, Notebook Navigator, Omnisearch, and friends).
3. Copy the templates and scripts you want, set up `orgs.json`, and wire the
   QuickAdd choices to the scripts.

## Inspiration and thanks

- Heavily inspired by Steph Ango's [vault](https://stephango.com/vault) (kepano).
  Most people should start there.
- The organizing ideas lean on [Building a Second Brain](https://www.buildingasecondbrain.com)
  (PARA, capture and distill) and [Getting Things Done](https://gettingthingsdone.com).
- Shaped by many discussions with experienced people who were generous with their
  time and thinking. Thank you.

## License

[MIT](LICENSE).
