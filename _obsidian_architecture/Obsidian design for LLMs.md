# Agent guide

Read `Obsidian design.md` for the current contract. The Areas proposal is historical,
not an alternate implementation specification.

## Model

- Active org content lives in inbox/, areas/, projects/. Daily/weekly/bases are infrastructure.
- Areas contains durable Area profiles, people/meetings/teams, resources, loose knowledge,
  and unassigned journals. Category/type describe content, not its physical root.
- area is an optional single link to a category: area profile. Keep custom templates
  and project/meeting/person relationships. No topic in new notes.
- legacyTopic/legacyArea preserve imported metadata; do not use them as new routing fields.
- Personal defaults: Home, Cooking, Travel, Car, Friends, Health, Growth, Finances.
- Sport -> Health, title only. Reflection immediate. Drafts only for event/contextual journals.
- Respect both local areas/archive and projects/archive, plus historical root archive.

## Editing and routing

1. Read affected templates and `_scripts/README.md` before changing automation.
2. Use the shared area resolver; avoid parallel routing implementations.
3. Keep QuickAdd exports synchronous. Load synced Markdown modules through vault APIs.
4. Keep Templater folder-template mode disabled; use its unified file-pattern adapter.
5. Preserve bodies, original capture times, custom metadata, and attachment targets.
6. Move in Obsidian with link-aware rename, or use a verified migration manifest and
   native link-resolution baseline for controlled offline bulk operations.
7. Area/project tasks and draft tasks feed snapshots. Edit tasks at their source.
8. Generic public config stays separate from ignored private org settings and notes.
9. Run `node --test _scripts/tests/flows.test.cjs` and live-app checks for runtime changes.
10. Before bulk migration, back up outside the vault, verify hashes, record every move,
    and compare post-migration links and counts. Restore Sync state when complete.
