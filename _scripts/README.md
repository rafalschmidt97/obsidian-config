# Vault automation

Runtime JavaScript is stored as Markdown so Obsidian Sync includes it on mobile.
Keep the shared modules and templates together on each device.

## Module boundaries

- `shared/runtime.md`: vault IO, rendering, calendars, org config, archive detection.
- `shared/areas.md`: context discovery, area creation/selection, inheritance and defaults.
- `shared/capture.md`: content creation, triage, reassignment, archive and folder capture.
- `shared/periodic.md`: daily, weekly, monthly and private meal-plan creation.
- `quickadd/templates.md`: stable QuickAdd dispatcher; `settings.flow` selects a flow.
- `quickadd/journal.md`: occurrences and event drafts; uses the same context resolver.
- `quickadd/actionpoints.md`: Tasks, Priority and Wishlist snapshots.
- `templater/apply-templateq-folder-template.md`: unified new-file adapter.
- `templater/apply-journalq-folder-template.md`: compatibility shim for old device settings.

## QuickAdd compatibility

Verified against QuickAdd 2.12.3's
[script loader](https://github.com/chhoumann/quickadd/blob/2.12.3/src/utilityObsidian.ts)
and [invocation](https://github.com/chhoumann/quickadd/blob/2.12.3/src/engine/MacroChoiceEngine.ts).
Exports are synchronous; `entry(params, settings)` is awaited. Load trusted vault
modules inside async calls through app.vault. Do not depend on desktop window.require,
Node filesystem imports, ESM imports, or top-level await. No global module cache.

## QuickAdd menu

Inbox, Journal, Note, Sport, Reflection, Monthly Reflection, Invoice, Document,
Meal Plan, Transcript, Clipping remain the top-level captures.

- Actions: Move / reassign, Triage, Archive.
- Entities: Area, Person, Meeting, Project, Team, Book, Place, Trip.
- System: Setup personal areas, Daily, Weekly, Tasks, startup refreshes.

The bottom menus keep their icons and order: Actions, Entities, System.
Existing command IDs remain stable. Update the public example and private QuickAdd
config separately, preserving private org-specific weekly shortcuts.

## Area and config contract

Per org: inbox/, areas/, projects/, with local archive folders in areas and projects.
Notes and journals coexist in contexts. Neutral resources live under areas/resources;
loose notes under areas/loose and events under areas/journal.

Org folders drive discovery. Local orgs.json overrides orgs.example.json ordering
and defaults. areas.json overrides areas.example.json; explicit Setup personal areas
creates eight personal defaults idempotently. New areas are selectable inline.
Private mealplan.json chooses placement and filename label; its private template
accepts `relationshipLines` for the Cooking area. Actual configs stay ignored.

Templater uses file-pattern rules, folder-template mode disabled. Skip archive paths
and non-empty files. The unified adapter handles context inference and periodic
link-click creation. It creates filled notes and removes only empty placeholders.

## Verification

Run `node --test _scripts/tests/flows.test.cjs`. The in-memory vault exercises
synchronous QuickAdd loading without Node imports, context routing, inline creation,
cancellation, drafts, metadata preservation, archive filtering, periodic idempotence,
specialized captures, and the Templater adapter. Live checks must also confirm
Obsidian metadata indexing, plugin wiring, link resolution and Base rendering.

Before bulk content migration, take and verify a full external backup. Keep manifests
private, preserve binary attachments, audit resolved links against the original,
and restore the prior Sync state after validation. Runtime tests do not replace
file-by-file migration reconciliation.
