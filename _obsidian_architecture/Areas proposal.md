# Areas: context-first capture and navigation

Status: proposed design. This document does not change the running vault contract.
After approval and implementation, incorporate the accepted rules into `Obsidian design.md`
and its LLM summary. No existing notes move as part of writing this proposal.

## Decision

Introduce Area as a durable context that can contain notes, journal entries, invoices,
and other content. Keep `category` and `type` for content shape and templates.
Notes and journals belonging to an area live together under `{org}/notes/{area}/`.
Loose notes and loose journals remain possible.

Precreate eight personal areas: home, cooking, travel, car, friends, health, growth,
and finances. Let users select existing areas or create one during capture.

## Vocabulary and boundaries

| Concept | Meaning | Example |
| --- | --- | --- |
| Area | A durable part of life or work that benefits from ongoing attention and a shared history. No completion condition. | Health, Finances, Recruitment |
| Project | A bounded effort with a completion condition, even when its end date is unknown. | Change bank, Fill a particular role |
| Category | What this file is and which template it uses. | note, journal, invoice, meeting, area |
| Type | A category-specific variation. | journal/event, journal/sport, journal/meeting |
| Collection | A browsing group based on an existing category. Not a new property or entity. | Books, Places, Clippings |
| Loose entry | A note or journal with no chosen area or other owning context. | A one-off thought or call |

An area is broader than a strict obligation: Cooking, Friends, and Travel are valid
when they are parts of life the user wants to develop or revisit. Do not create an
area for every article subject or nested folder. Areas remain a small, flat list per org.

Areas are org-scoped. A work Recruitment area and a personal career project are
different contexts. Names and config examples in the public repository remain generic.

## Physical layout

```text
personal/
  inbox/
  notes/
    finances/
      Finances.md
      Budget principles.md
      Bank comparison.md
      2026-09-20 14-00 Advisor call.md
      2026-09-20 Accounting invoice.md
    health/
      Health.md
      Medical history.md
      2026-09-20 18-00 Training.md
    home/
      Home.md
    cooking/
      Cooking.md
    travel/
      Travel.md
    car/
      Car.md
    friends/
      Friends.md
    growth/
      Growth.md
    books/                     # Existing specialized collections remain usable
    clippings/
    places/
    trips/
    transcripts/
    Loose idea.md
  journal/
    2026-09-20 12-00 Unrelated event.md
  projects/
    Change bank/
      Change bank.md            # area links to Finances
      Comparison.md
  people/
  meetings/
  weekly/
  bases/
```

`notes/` is the container for non-project material, not a restriction to
`category: note`. It already contains books, places, and invoices today.

Inside an area, put content together. Do not create `notes/` and `journal/` subfolders.
Create a `meetings/` child collection only when a recurring meeting needs a profile
and its own history. Optional ordinary subfolders inherit the nearest area's context;
they do not automatically become new areas.

Keep specialized collections as neutral destinations for entries with no area.
An entry explicitly assigned to an area lives there unless a more specific owning
context applies. Collections' Bases query category across the org, not only the old folder.

## Metadata

Area profile at `personal/notes/finances/Finances.md`:

```yaml
org: personal
category: area
created: 2026-09-20T12:00
status: active
```

Area-owned event:

```yaml
org: personal
category: journal
type: event
created: 2026-09-20T14:00
area: "[[personal/notes/finances/Finances]]"
```

An ordinary note uses `category: note` and the same `area` link. An invoice keeps
`category: invoice`. A recurring meeting occurrence keeps `type: meeting` and its
`meeting` relationship alongside `area`.

Rules:

- `category: area` is for the profile only, never the files collected beneath it.
- `area` is an optional, single wikilink. Use a vault-relative target to avoid
  collisions between orgs with identically named areas. Display aliases are optional.
- Omit `area` for loose entries; do not create an Unsorted area or empty property.
- An area profile does not point to itself with `area`.
- A project may have an `area` link while remaining under `{org}/projects/`.
- Project and meeting captures inherit `area` from their owning profile. If both
  a meeting and its project declare different areas, report the conflict instead
  of choosing silently.
- People and teams are not automatically mapped to areas. They often span several.
- One primary area determines placement. Use normal body links for secondary relevance.
- Existing `project`, `meeting`, `attendees`, `transcript`, and `parent` relationships
  retain their meanings. No new journal `type: area` is needed.

`area` is stored explicitly on content for reliable Bases queries. Changing a
project or meeting's area requires an explicit reassignment operation that updates
its affected content too; it is not a live formula inherited at query time.

## Default areas and creation

| Folder | Profile | Intended scope |
| --- | --- | --- |
| home | Home.md | Household, housing, maintenance, domestic administration |
| cooking | Cooking.md | Recipes, food planning, cooking practice |
| travel | Travel.md | Travel knowledge, destinations, trip experiences |
| car | Car.md | Ownership, servicing, insurance, running costs |
| friends | Friends.md | Social life and shared plans; person profiles remain separate |
| health | Health.md | Healthcare, training, recovery, wellbeing |
| growth | Growth.md | Learning, career development, personal development |
| finances | Finances.md | Budgeting, banking, taxes, general financial administration |

Setup creates these eight profiles once, with empty user sections and live views.
The setup operation is idempotent: existing profiles and content are preserved.
An existing destination folder without a profile can be adopted; do not move or
retag its contents implicitly. A filename collision with an unrelated note is a
reported conflict requiring a different name or explicit adoption.

The defaults seed only `personal`. Work orgs start without areas and can create
their own, for example Recruitment or Management.

Put `Area` first in the existing Entities submenu. Explicit creation asks:

```text
org? -> area name? -> create and open profile
```

The area selector used during capture lists active area profiles in the chosen
org, plus `Create area…`. It discovers profiles by category and canonical location,
not arbitrary child folders of `notes/`. Sort alphabetically by display name.

Custom creation uses a sanitized lowercase folder name, preserving meaningful
Unicode and turning whitespace into hyphens. Profile titles retain the entered
display name. Detect case-insensitive path/name collisions; offer to select an
existing area instead of making a suffixed duplicate. Reserved collection paths
such as `books` and `transcripts` cannot become area roots.

During inline creation, collect the remaining capture inputs before writing the
new area and entry. Cancelling prompts leaves no orphan area or blank entry.
If a write fails partway, report the files already created and make retry reuse
them safely. Explicit Area creation intentionally creates only the profile.

## Capture flows

### Note and Journal

Use the same context choices for both:

```text
org? -> where?
  Loose
  Area -> select existing / Create area…
  Project
  Meeting
  Person
  Team                         # only where supported
```

Note then asks for a title. Journal keeps `now / draft` for events and contextual
occurrences, resolves the context, offers a matching draft if applicable, then asks
for a title. No attendee prompt and no generic type prompt.

- Loose Note -> `{org}/notes/{Title}.md`.
- Loose Journal -> `{org}/journal/{timestamp} {Title}.md`.
- Area Note -> `{org}/notes/{area}/{Title}.md`.
- Area Journal -> `{org}/notes/{area}/{timestamp} {Title}.md`, `type: event`.
- Existing contextual routes keep their destinations and custom templates.

Area draft matching is bounded by org, area, category, and type, excludes contextual
meeting/project drafts, and still asks which draft to activate when several exist.
Preparation timestamps and collision-safe activation behavior remain unchanged.

Inbox remains the one-step timestamped capture, with no area question. Triage
reuses Note's context selector, including inline area creation, and preserves custom
metadata. Add `Actions > Move / reassign` for already-organized content using the
same resolver: preserve category, type, dates, body, and unrelated relationships.
Moving to Loose removes a prior area. Context-owned entries require reassignment
through their owning context, rather than leaving contradictory project/area fields.

### Fast and specialized captures

| Capture | Area behavior | Physical home |
| --- | --- | --- |
| Sport | Health automatically; title only, no draft prompt | Health area |
| Reflection | Org, then Loose or selected/new Area, then title; immediate | Loose journal or area |
| Monthly Reflection | Org-wide period review; no area prompt | Existing journal destination |
| Invoice / Document | Replace opaque topic path picker with Loose or selected/new Area | Area, or neutral `notes/invoices/` / `notes/documents/` |
| Book / Clipping / Place / Trip | Offer Loose or selected/new Area after org is known | Area, or existing category collection |
| Project | Optional area at creation; may remain unassigned | Existing projects tree |
| Meeting | Allow Area as an owning context in addition to existing contexts | `notes/{area}/meetings/{Meeting}/` when area-owned |
| Person / Team | No new mandatory area prompt | Existing entity folders |
| Transcript | Inherit area from linked journal; standalone stays unassigned | Existing `notes/transcripts/` collection |
| Meal Plan | Cooking by default; preserve custom template/config | Existing configured project folder, associated with Cooking |

Books and places remain their own categories even when assigned to Growth or Travel.
A trip profile can be stored in Travel; related material uses the `area` property
and a body link to the trip. This proposal does not introduce a new `trip` property.
Avoid turning every trip into a project automatically. A substantial trip-planning
project remains a separate bounded effort when useful.

Sport keeps its existing cross-sport previous-session view. The view remains
property-based so old sport journals outside Health still appear.

Category defaults live in ignored `_scripts/config/areas.json`, with a generic
example defining the eight initial personal areas and Health/Cooking defaults.
Use validated vault-relative profile references, not ambiguous display names.
If a default profile is missing or archived, offer to create/select a replacement
instead of failing or silently recreating an intentionally removed area on startup.

### Folder-click behavior

Inside an area folder, infer org and area, then ask `Note / Journal` and title.
Journal creation additionally supports `now / draft` for events. Neither choice
silently turns an existing non-empty file into another category.

More-specific existing routes win: a recurring meeting folder still creates its
meeting occurrence template, and a profile-creation folder still creates its entity.
Invoices and other specialized categories use their explicit QuickAdd commands;
an area folder name alone never implies invoice.

Use one shared context resolver for QuickAdd, Templater, triage, and reassignment.
Templater adapters remain thin and use vault APIs plus the synced Markdown runtime.

## Navigation and tasks

Each Area profile has:

1. `About`: scope, boundaries, and what the user wants to maintain or develop.
2. `Links`: important references, edited manually.
3. `Tasks`: open actions owned directly by the area.
4. One embedded Base with All, Notes & Documents, Journal, Projects, and Meetings views.

All includes every active linked category, not only `note` and `journal`.
Journal is newest first and can show drafts distinctly; a Past entries view excludes
drafts. Projects and Meetings list linked profiles. The global Areas index lists
active profiles, and global Journal/Notes collections still query across all locations.

All views exclude archived/obsolete content and archive paths. An archived owning
Area is not surfaced as an active capture context. Existing relationship-profile
views must adopt the same archive filters where they currently lack them.

New area-owned notes and journals show their Area link in frontmatter. Journal
templates also expose a `Previous entries` Base view for that same area, excluding
the current entry and drafts and limiting to five earlier occurrences. This is
navigation, not five manually maintained previous/next links. Sport uses its existing
sport-only history rather than mixing doctor visits into training history.

Extend Tasks / Priority / Wishlist sources to include Area-profile `## Tasks`.
Journals and project profiles continue to contribute regardless of physical location.
Draft-journal Tasks remain included; Talking Points remain excluded. Do not start
collecting arbitrary Note checkboxes as an incidental part of this change.

## Projects, recurrence, and recruitment example

```text
work/
  notes/recruitment/
    Recruitment.md
    Interview rubric.md
    2026-09-20 10-00 Candidate interview.md
    meetings/Hiring review/
      Hiring review.md
      2026-09-21 09-00 Hiring review.md
  projects/Fill engineering role/
    Fill engineering role.md
    Interview plan.md
```

The recruitment area shows all these items through `area`. The hiring review keeps
its meeting template and `meeting` relationship. The hiring project ends when the
role is filled; Recruitment continues. One-off interviews can be ordinary area
events without inventing a recurring meeting profile for each candidate.

## Retiring topic and simplifying assets

Do not rename `topic` mechanically. Stop writing it in the new area flows.
During migration, preserve legacy values until their meaning has a destination:

| Existing use | Treatment |
| --- | --- |
| Durable life/work context | Map to Area after reviewing content |
| `assets/house`, `assets/car`, `assets/finances` | Move reviewed items to Home, Car, Finances; remove the redundant assets level |
| `healthcare` | Map reviewed items to Health |
| `development/*` | Growth is a candidate; inspect before moving |
| `sport` | Health is a candidate; preserve `type: sport` and history |
| `books`, `places`, `clippings`, `transcripts` | Category collections, not Areas |
| Place subtype paths such as `places/cafe` | Preserve until a separate category-specific replacement is designed |
| `references/*`, `entertainment/*`, `utilities`, `documents` | Review individually; a subject or format is not automatically an Area |
| `indexes` | Infrastructure marker; retain until index metadata is separately revised |

Finances is not the destination for every invoice. A car service receipt belongs
to Car; medical receipts to Health; housing bills to Home. General accounting and
bank documents belong to Finances. Category-based invoice views still show all of them.

Existing personal and work topic trees need a dry-run inventory before any move.
Unknown mappings stay in place. Do not automatically make every directory an area.

## Migration and rollout

Implement and commit one stage at a time:

1. Area profile/template, validated discovery, creation, generic config, and explicit
   one-time setup of the eight personal defaults. Runtime output stays private;
   only templates, scripts, tests, and generic config examples are committed.
2. Shared area-aware context routing for Note, Journal, and Triage, including inline
   creation and loose entries. Keep all current contextual routes functioning.
3. Specialized flows, folder-click support, defaults, navigation Bases, and area tasks.
   Wire Area under Entities and Move / reassign under Actions in both QuickAdd configs.
4. Produce a private dry-run manifest: source path, category, existing relationships,
   proposed destination, proposed area, metadata changes, conflict, approval, result.
   Agree mappings before touching content.
5. Move approved files using Obsidian's link-aware rename API; preserve content,
   capture timestamps, draft timestamps, custom fields, and attachment references.
   Update route-owned area metadata explicitly. Never resolve collisions by overwrite.
6. Verify links, profile views, global collections, drafts, and generated tasks.
   Remove old empty folders only after checking their index notes and attachments.
   Publish the accepted design and update the LLM summary and README.

No bulk migration script should commit private paths or content into the public repo.
Keep the manifest locally and record each completed operation for rollback. Rollback
uses the original paths and changed property values; it must not overwrite subsequent
user edits. Preserve a content backup before the approved migration begins.

Moving a project to archive does not archive its Area. Archiving an Area removes it
from capture selectors, moves its own folder through the existing archive mechanism,
and updates links through Obsidian. Linked projects or people outside that folder
are not silently archived. Flag active linked projects before completing the archive;
the user must keep, reassign, or archive those explicitly.

## Acceptance criteria

- Setup yields exactly eight personal Area profiles; running again changes no content.
- Creating an area explicitly or inline makes it selectable without a restart.
- A Note and a Journal can be created beside each other in the same area, or left loose.
- Area creation cancellation, duplicate names, reserved names, missing defaults,
  and filename collisions have defined non-destructive behavior.
- A meeting in an Area retains its meeting template and is visible in both histories.
- Projects remain bounded entities; their area-linked content appears in the Area view.
- Sport stays title-only and shows previous sports across old and new locations.
- Sport and Reflection never create or activate drafts; event drafts remain supported.
- All category collections discover entries outside their legacy category folders.
- Area-profile Tasks appear in snapshots exactly once; existing sources still work.
- Private and public QuickAdd wiring use the same generic flow contracts without
  leaking real org names into tracked files.
- Desktop and mobile execution use vault APIs and synchronized runtime files.
- Approved migration reconciles source/destination counts with no lost files,
  broken internal links, or overwritten custom metadata.
