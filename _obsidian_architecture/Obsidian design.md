# Obsidian design

## Purpose

Capture quickly, keep material beside its context, and navigate through properties
and live views. The vault is organized around ongoing areas and bounded projects.
Journal and Note describe content, not separate top-level storage systems.

## Content model

| Field | Meaning | Rule |
| --- | --- | --- |
| `org` | Personal or work namespace | Matches the active top-level org; historical orgs may live under root archive |
| `area` | Durable context | Optional single wikilink to a `category: area` profile, preferably vault-relative |
| `category` | File family/template | One value: note, journal, area, project, person, meeting, team, book, clippings, invoice, place, trip, transcript, daily, weekly, index |
| `type` | Useful category-specific subtype | Optional except where required by a template |
| `created` | Capture time, or occurrence time after draft activation | Datetime; preserve during moves |
| `drafted` | Original preparation time | Set only when activating a draft |
| `status` | Lifecycle or reading state | archived/obsolete excluded from active views; book may use to-read/reading/read |
| `project`, `meeting`, `team` | Owning contextual profile | Wikilinks; a more specific context determines the physical destination |
| `attendees` | People involved | List of links; person capture supplies its person, no interactive attendee prompt |
| `parent` | Parent project | Wikilink for nested project profiles |
| `journal`, `transcript` | Transcript/occurrence relationship | Reciprocal links when captured together |
| `placeKind` | Place classification | restaurant, bar, cafe, spot, city, country |
| `date`, `week` | Daily period and weekly links | Daily only; cross-org daily has no required org |
| `start`, `end`, `previous`, `next` | Period/trip boundaries and navigation | Use where applicable, not on every content note |

Property order: org, category, type, created/drafted, context relationships, lifecycle
and category-specific data. Empty optional properties are omitted, except intentional
editable fields such as an event's empty attendees list.

`topic` is retired. New captures do not write it. Migrated subject data without a
semantic area mapping is preserved as `legacyTopic`. Imported documents that already
used `area` for an unrelated external classification retain it as `legacyArea`.
These legacy fields are preservation data, not selectors for new captures.

No required tags field. Body task markers `#prio` and `#wl` have specific task-view
semantics and are independent of the content classification model.

### Category and type

- Journal: event, reflection, sport, meeting, 1-1, project, team. Type describes the
  occurrence/template; Health is an area, not a replacement for sport.
- Note: normally no type; reference/research/idea/feedback/plan can be used when useful.
- Clippings: read, watch, listen. Saved external material keeps its own category.
- Place and Trip: entry or recommendation.
- Profiles are category area/project/person/meeting/team. Content beside them retains
  its own category. A Person profile inside areas is not `category: area`.
- Index pages and generated task snapshots use `category: index`.

## Directory structure

```text
daily/                              # Cross-org periodic infrastructure
personal/                           # Other active orgs follow the same shape
  inbox/
  areas/
    home/Home.md
    cooking/Cooking.md
    travel/Travel.md
    car/Car.md
    friends/Friends.md
    health/Health.md
    growth/Growth.md
    finances/Finances.md
    people/{Person}/{Person}.md
    meetings/{Meeting}/{Meeting}.md
    teams/{Team}/{Team}.md
    resources/                      # Neutral reusable category/subject collections
      books/
      clippings/
      documents/
      invoices/
      places/
      trips/
      transcripts/
      references/
    journal/                        # Loose events and monthly reflections
    loose/                          # Loose knowledge
    archive/                        # Retired area/entity contexts
  projects/
    {Project}/{Project}.md
    archive/                        # Retired projects
  weekly/
  bases/
archive/{former-org}/                # Historical org archive, never active capture
_templates/
_scripts/
_obsidian_architecture/
```

`areas/` is the broad container for ongoing contexts and resources. The eight
personal default Area profiles are Home, Cooking, Travel, Car, Friends, Health,
Growth, and Finances. Work areas are created as needed, not guessed from every folder.

Notes, journals, invoices, and references coexist directly within an area. Do not
add separate notes/journal child folders. Recurring meetings can have their own
profile folder at `areas/{area}/meetings/{Meeting}/`. More specific context wins.

Projects have a completion condition, not necessarily an end date. They stay in
`projects/` and can link to an area. Child projects live under a parent's `projects/`.
Area-linked project material appears in area views without duplicate physical copies.

Loose category captures use `areas/resources/{collection}/`. Category Bases query
across the org so a book in Growth or invoice in Car is still visible globally.

Attachments stay in their owning `_attachments/` directories. All moves preserve
link targets and attachments. Resources and historical documents are never discarded
merely because their metadata is old.

## Areas and relationships

An area profile contains About, Links, Tasks, and an embedded `area-content.base`.
Its views cover All, Notes and documents, Journal, Projects, and Meetings.

Content stores `area: "[[personal/areas/health/Health]]"` explicitly. The area profile
does not link to itself. Use full paths for cross-org name collisions. One primary
area controls placement; ordinary links express secondary relevance.

Project and meeting captures inherit area from the selected profile. A meeting and
its project cannot disagree about area. People and teams span responsibilities and
are not automatically assigned an area merely from their identity.

Creation supports existing areas and `Create area…`. New area paths use sanitized
lowercase hyphenated names, preserving Unicode. Profile filenames use display names.
Reserved roots (archive/resources/journal/loose/people/meetings/teams) are not area names.
Duplicate profiles reuse the existing entity or fail on a conflicting file; never
silently create a suffixed duplicate entity.

Inline creation collects capture inputs before writing the area profile. Cancellation
must leave no empty area. Setup is explicit and idempotent; it never recreates removed
areas automatically on startup. `_scripts/config/areas.example.json` defines defaults;
`areas.json` is the ignored local override. Missing defaults require selection.

## Invocation modes

### QuickAdd

Top-level capture order:

1. Inbox
2. Journal
3. Note
4. Sport
5. Reflection
6. Monthly Reflection
7. Invoice
8. Document
9. Meal Plan
10. Transcript
11. Clipping

Bottom menus:

- Actions: Move / reassign, Triage, Archive.
- Entities: Area, Person, Meeting, Project, Team, Book, Place, Trip.
- System: Setup personal areas, Daily, Weekly shortcuts, Tasks, startup refreshes.

Existing command IDs remain stable. Native daily/periodic tooling is the normal
daily and weekly entry point. The private QuickAdd settings and public example
share flow contracts while retaining private org-specific shortcuts separately.

### Note and event capture

Note: org -> where (Loose / Area / Project / Meeting / Person / Team) -> context -> title.
Journal: org -> now/draft -> same context choices -> matching draft or title.

Loose Note lands in `areas/loose/`; loose event in `areas/journal/`.
Area entries land next to the profile. A selected person, project, team, or meeting
uses that context's folder and custom journal template. Contextual entries use the
profile name as their default occurrence subject.

Event is the ordinary journal type. No type or attendee prompt is added to this flow.
Sport uses Health and asks only title. Reflection asks org, optional selected/new
area or Loose, then title. Sport and Reflection never create or activate drafts.
Monthly Reflection remains the previous-month period review in `areas/journal/`.

### Draft lifecycle

Draft filename: `Draft {Subject}.md`; `created` is its preparation timestamp.
Activation copies created to drafted, sets created to occurrence time, and renames
to `YYYY-MM-DD HH-mm {Subject}.md`. Preserve body and unrelated metadata.

Matching includes org, type, area and context relationships, within the owning folder.
Empty attendees and an omitted attendees property are equivalent. Drafts from another
area or meeting must not be offered. Collisions use a unique occurrence filename;
an incompatible existing draft is reported rather than overwritten.

### Specialized captures

Book, Clipping, Place, Trip, Invoice, and Document offer selected/new Area or Loose.
Loose uses its resource collection; assigned content lives in the area. Books have
reading status. Place uses placeKind instead of a pseudo-topic path.

Project creation selects a parent or top-level placement and optional area. Meetings
can be loose or belong to an area, project, or team. Person and Team retain their
dedicated roots inside areas.

Transcripts live in `areas/resources/transcripts/`, optionally link to a journal,
inherit its area, and update its reciprocal transcript link. Standalone transcripts
remain supported. The flow assumes one capture per occurrence; duplicate enforcement
is not added automatically.

Meal Plan uses the private template and placement config, normally Cooking. Household
names and content are never committed. Periodic dates use local time, weeks start on
Monday, and weekly end is the following Monday (exclusive).

### Folder-click capture

One Templater file-pattern adapter handles active org inbox/areas/projects/weekly
and daily. Folder-template mode stays disabled. Skip non-empty files and archive paths.

Infer the deepest context profile; ask Note or Journal in an area or project folder.
Person and meeting occurrence folders default to Journal. Entity collection roots
create a profile. Area folder names never imply Invoice. No attendee prompt.

Date/week filenames override placement so clicking periodic previous/next links
creates or opens the correct period. The adapter fills empty period placeholders,
preserves non-empty existing periods, and removes only the empty capture placeholder
after successful creation. New non-empty files exit Templater immediately.

## Maintenance

### Triage and reassignment

Inbox remains immediate and timestamped. Triage selects an inbox item, then opens,
trashes with confirmation, or moves it using the shared context resolver.
Preserve body, aliases, created, and custom fields. Remove inbox type, obsolete topic,
and the previous area; set destination relationships explicitly.

Move / reassign operates on the active loose/area content note. Profiles and entries
owned by project/meeting/team are blocked from independent relocation to avoid
inconsistent relationships. Reassign such contexts deliberately as a folder and
update their content together; automated bulk context reassignment is not implied.

### Archive

Select a concrete area/project/person/meeting/team profile and confirm. Move its
entire folder to `{org}/areas/archive/{relative-context}` or
`{org}/projects/archive/{relative-context}`. Preserve relationships using Obsidian's
link-aware rename API. Report destination collisions; never overwrite.

Archiving an area does not silently archive external projects linked to it. Active
linked projects must be resolved first. Root `archive/{former-org}` remains a valid
historical boundary. All active selectors and views exclude archive path segments
and archived/obsolete status, not merely the root archive directory.

### Tasks and periodic startup

Task sources are open `## Tasks` checkboxes in weekly, journal, project, area, and
book notes. Draft journal Tasks count; Talking Points do not. Exclude archive paths
and archived/obsolete status. Arbitrary note checkboxes are not newly collected.

`#prio` adds an item to Priority and leaves it in Tasks. `#wl` moves it to Wishlist.
These are generated Markdown snapshots, refreshed on startup or System > Tasks.
Edit source tasks; snapshots never write checkbox changes back.

Periodic startup creates missing current daily/weekly notes, opens nothing, and
never replaces user content. Metadata-dependent task startup waits for cache readiness.

## Bases and navigation

Area content and category collections are property-based. Paths identify active org
scope and archive boundaries, not content categories. Views exclude archived/obsolete
content. Use `category: index` for index discovery.

Area journals embed five previous occurrences from the same area through
`area-history.base`. Sport uses `sport-history.base` across all sports, irrespective
of whether an older entry lives in Health. Both exclude drafts/current/future entries.
Links and timestamps are preserved during moves.

Legacy imported metadata can be inspected in existing legacy-subject views. It is
not silently reinterpreted as an Area and is not required for new navigation.

## Runtime architecture

QuickAdd exports are synchronous and load modules inside async calls through vault
APIs. Runtime JavaScript stays in Markdown for mobile Sync. No Node filesystem
imports, ESM imports, or top-level await in runtime modules.

| Module | Responsibility |
| --- | --- |
| shared/runtime.md | File/render/calendar primitives, org discovery, archive predicate |
| shared/areas.md | Area profiles, selection/creation, defaults, context inference/inheritance |
| shared/capture.md | Non-periodic capture, triage, reassignment, archive, folder dispatch |
| shared/periodic.md | Daily/weekly/monthly/meal-plan creation and startup |
| quickadd/journal.md | Journal templates, draft matching/activation, contextual occurrence capture |
| quickadd/templates.md | Stable command dispatcher |
| quickadd/actionpoints.md | Generated task snapshots |
| templater/apply-templateq-folder-template.md | Thin Templater UI adapter |

Runtime config is data, not hardcoded org identity. Org discovery uses top-level
folders excluding infrastructure and archive. Config priority loads local orgs.json,
then the generic example; remaining orgs sort alphabetically with personal last.
Only eligible existing orgs are defaults. Area discovery uses profile metadata.

## Migration and verification contract

Before bulk changes, take a full external backup and hash every file. Keep private
inventories, manifests, link-resolution baselines and rollback maps outside this repo.
Pause Sync for migration and restore its original state after verification.

Preserve original content and attachments. Resolve ambiguous links using the live
Obsidian metadata cache; distinguish pre-existing unresolved references from regressions.
Legacy topic/source-area values are retained under explicit preservation fields.
Do not guess a semantic area for an ambiguous resource; keep it under resources.

Verify every original file has exactly one destination, binary hashes match, YAML
and Base definitions parse, and previously resolving links keep their destinations.
Check rendered Bases and capture in the live app as well as isolated flow tests.
Backup/migration manifests never enter the public repository.

Public commits include generic scripts/templates/config examples and docs only.
Match the remote before using the direct-main exception. Stage intended files only;
private note trees and real plugin settings remain ignored.
