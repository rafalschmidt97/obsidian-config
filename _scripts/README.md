# Vault scripts

QuickAdd entry points live in `quickadd/`; folder-click adapters live in `templater/`.
Both load `shared/runtime.md` through Obsidian's vault API. Keep runtime dependencies
as Markdown so Obsidian Sync includes them on mobile.

The shared runtime owns rendering, local calendar calculations, org config/discovery,
entity discovery, file helpers, route-field rendering, draft matching, and QuickAdd
back navigation. UI-specific prompts and route selection remain in the adapters.
Journal activation lives in `quickadd/journal.md` and is called by both entry paths.
The tiny runtime bootstrap is repeated deliberately so each entry can load itself.
There is no module cache or shared mutable invocation state.

## QuickAdd compatibility

Checked against QuickAdd 2.12.3 source:

- [Script loader](https://github.com/chhoumann/quickadd/blob/2.12.3/src/utilityObsidian.ts):
  a synchronous `(require, module, exports)` wrapper, reading the configured vault file.
  `require` delegates to `window.require`, which is not portable to mobile.
- [Invocation](https://github.com/chhoumann/quickadd/blob/2.12.3/src/engine/MacroChoiceEngine.ts):
  object exports with `entry` receive `(params, settings)` and are awaited.

Exports must be available synchronously. Load dependencies inside async entry calls,
using `app.vault.read`, then evaluate our own trusted scripts. Avoid top-level await,
ESM imports, Node filesystem imports, and QuickAdd private APIs. Existing command paths
and `settings.flow` contracts remain valid. Sync `shared/runtime.md` alongside the entry
scripts; a missing module produces an explicit error before content creation.

Real org names and household settings belong in ignored `config/*.json` files, with
generic examples committed. The Templater path regexes are still device configuration;
adding an org requires updating those regexes as well as creating its folders.

## QuickAdd menu

Frequent captures stay at the top level. `Entities` groups Person, Meeting, Project,
and Team profile creation. `System` holds Daily, the Weekly submenu, Tasks, and the two startup refreshes.
Use native periodic-note tooling for normal daily/weekly access; QuickAdd keeps secondary utilities.
Nested choices keep their original IDs and command flags so existing shortcuts
continue to work. Apply menu edits to the private `quickadd/data.json` and the public
`data.example.json` separately; preserve private org settings in the former.

## Verification

Run `node --test _scripts/tests/flows.test.cjs` from the vault root. The in-memory vault
tests run QuickAdd scripts in its synchronous wrapper with Node imports unavailable,
and execute the Templater adapter bodies. They cover routing, metadata preservation,
draft activation, collisions, task filtering, and periodic generation. They do not
simulate Obsidian plugin events or replace an on-device desktop/mobile smoke check.
Tests are local development files, not runtime dependencies.
