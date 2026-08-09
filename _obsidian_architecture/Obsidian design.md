Vault Design Document

## Purpose

The vault should be easy to navigate by meaning, not by app-specific conventions.

The vault uses explicit frontmatter fields and flat org-based directories. `tags` are not part of the target schema unless a future real cross-cutting tag is intentionally introduced.

Core idea:

```text
Journal = something happened
Note    = knowledge, thought, draft, reference, research, idea
```

Work 1-1s, recurring meeting occurrences, personal hangouts, sport sessions, and similar events are all journal entries. They can use different templates and stricter fields, but they belong to the same conceptual family: an occurrence.

## Vocabulary

| Field        | Meaning                                                                                     | Examples                                                                                                                                                                                  | Rule                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `org`        | Work/life namespace.                                                                        | `work`, `personal`                                                                                                                                                                  | First property when present. Omit only for cross-org daily/index infrastructure. Historical archived notes may keep their old org value.                                                                                               |
| `category`   | Primary note family. Decides template, main Base view, and broad folder.                    | `journal`, `note`, `person`, `book`, `place`, `trip`, `clippings`, `invoice`, `transcript`, `project`                                                                                     | Exactly one per content note. Singular value.                                                                                                                                                                                          |
| `type`       | Category-specific subtype. Meaning depends on category.                                     | journal: `1-1`, `meeting`, `project`, `team`, `reflection`, `sport`; note: `research`, `feedback`; place/trip: `entry`, `recommendation`; clippings: `read`, `watch`, `listen` | Optional unless the template needs it. Singular value.                                                                                                                                                                                 |
| `topic`      | Optional durable bucket/subject. Preserves hierarchy if folders change.                     | `career`, `learning`, `sport`, `books`, `places`, `assets/finances/invoices`, `indexes`                                                                                                   | Mostly for notes, sometimes for journal/reference/index pages. Do not set it when `type` already carries the useful distinction.                                                                                                       |
| `created`    | When the note was created, except activated journal entries where it means occurrence time. | `2026-06-02T12:38`, `2026-05-29`                                                                                                                                                          | Present on ALL content notes, including journal drafts. For journal drafts it is the draft creation time. When a draft is activated, old `created` is moved to `drafted`, and `created` becomes the occurrence time. Type: `datetime`. |
| `drafted`    | When a journal draft was started before activation.                                         | `2026-06-02T13:20`                                                                                                                                                                        | Only for journals activated from drafts. Type: `datetime`. Drafts do not have `drafted`; activation renames draft `created` to `drafted` and writes a new `created`.                                                                   |
| `date`       | The calendar day this daily note covers.                                                    | `2026-05-30`                                                                                                                                                                              | Only on `daily`. Type: `date`. Populated from filename `YYYY-MM-DD.md`.                                                                                                                                                                |
| `week`       | Links to the active org weekly planning notes covering this day.                            | `[[2026-06-08--06-14 Work]]`, `[[2026-06-08--06-14 Personal]]`                                                                                                                      | Only on `daily`. Type: list of wikilinks. Computed from active root org folders. Weeks are Monday-start (Mon–Sun); the link name is `{Monday}--{Sunday}`. Historical daily notes may still link to archived org weekly notes.          |
| `start`      | Period start date.                                                                          | `2026-05-26`                                                                                                                                                                              | Only on `weekly` and `trip`. Type: `date`.                                                                                                                                                                                             |
| `end`        | Period end date. Weekly uses an exclusive next-Monday boundary.                             | `2026-06-01`                                                                                                                                                                              | Only on `weekly` and `trip`. Type: `date`. All computed calendar dates (week/day/month boundaries) are formatted in local time, never UTC (`toISOString`), so notes created near midnight land on the correct local day.               |
| `previous`   | Adjacent period/day before this note.                                                       | daily: `[[2026-05-29]]`; weekly/monthly: `[[2026-05-18--05-24 Work]]`                                                                                                               | Wikilink for navigation.                                                                                                                                                                                                               |
| `next`       | Adjacent period/day after this note.                                                        | daily: `[[2026-05-31]]`; weekly/monthly: `[[2026-06-01--06-07 Work]]`                                                                                                               | Wikilink for navigation.                                                                                                                                                                                                               |
| `status`     | Lifecycle or filter state.                                                                  | `active`, `archived`, `obsolete`, `reading`, `read`, `to-read`                                                                                                                            | Hide `archived` and `obsolete` in normal views.                                                                                                                                                                                        |
| `parent`     | Parent entity for nested profiles.                                                          | `[[Platform]]`, `[[Wedding]]`                                                                                                                                                              | Used by nested project profiles.                                                                                                                                                                                                       |
| `journal`    | Link from a transcript to the meeting/occurrence journal entry it belongs to.               | `[[2026-05-29 10-00 Engineering Managers]]`                                                                                                                                               | Only on `transcript` notes. Wikilink to the journal entry. Omitted for standalone transcripts.                                                                                                                                         |
| `transcript` | Link from a journal entry to its raw transcript note.                                       | `[[2026-05-29 Engineering Managers transcript]]`                                                                                                                                          | Optional, on `journal` entries. Added when a transcript is captured. One-to-one with the transcript's `journal` back-link.                                                                                                             |

No `tags` field in the target vault. Obsidian or plugin config may still mention `tags` because it is a built-in property type and some legacy notes may still carry old fields. Do not treat that as part of the target content schema.

Property order in frontmatter:

```yaml
org: work
category: journal
type: meeting
topic: leadership
created: 2026-05-29T10:00
...
```

Order rule:

1. `org`
2. `category`
3. `type`
4. `topic`
5. `drafted` / `created`
6. `date` / `start` / `end` / `previous` / `next` (only when applicable)
7. relationships (`attendees`, `meeting`, `project`, `team`, `parent`)
8. status and remaining category-specific fields

## Allowed Values

`catalog` and `collection` are not target fields. Use `topic`.

Keep `type` small. Do not invent a new `type` just because a file has a specific document form. If the subtype does not drive a template or a view, leave `type` empty and let `topic` carry the location/subject.

`assets` is only a physical folder/topic group. It is not a `category` and not a `type`.

| Category    | Allowed `type` values                                                                                                              | Allowed `topic` values / patterns                                                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journal`   | Relationship types: `1-1`, `meeting`, `project`, `team`. Org-wide/event types: `event`, `reflection`, `sport`, or none. | Optional. Use `topic` for subject/activity grouping when it is not the relationship shape, e.g. `assets/car`, `healthcare`.                                                                                                                                    | Relationship journal entries use `type` as a discriminator for expected fields. The org-wide `{org}/journal/` route does not offer relationship discriminator types because those require relationship fields.                                                                                                                                                                                                                                                          |
| `note`      | `idea`, `research`, `feedback`, `reference`, `inbox`, `plan`                                                                       | Work topics: `career`, `hr`, `learning`, `management`, `references/*`. Personal topics: `trips`, `healthcare`, `documents`, `assets/car`, `assets/house`, `assets/finances`, `development/*`, `entertainment/*`, `utilities`, `interview`, `sport`, `reading`. | Generic knowledge/thought/admin notes. Admin docs normally do not need `type`.                                                                                                                                                                                                                                                                                                                                                                                          |
| `book`      | none                                                                                                                               | `reading`, `interview`, or none                                                                                                                                                                                                                                | Book is a first-class category. Files live under `personal/notes/books/`. Sub-folders: `read/` (finished, no topic), `reading/` (in progress, `topic: reading`), `interview/` (study guides, `topic: interview`). No `status` field — folder-based organization.                                                                                                                                                                                                        |
| `place`     | `entry`, `recommendation`                                                                                                          | `places/restaurant`, `places/bar`, `places/cafe`, `places/city`, `places/country`, `places/spot`                                                                                                                                                               | Place is a first-class category even though files live under `personal/notes/places/`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `trip`      | `entry`, `recommendation`                                                                                                          | none (add `topic` only when creating a physical subdirectory for a specific trip)                                                                                                                                                                              | Trip is a first-class category. Trip packing lists or loose travel notes stay `category: note`, `topic: trips`. Index has two views: entries and recommendations.                                                                                                                                                                                                                                                                                                       |
| `clippings` | `read`, `listen`, `watch`                                                                                                          | none                                                                                                                                                                                                                                                           | Saved external content: articles, blog posts, podcast episodes, videos, talks. `type` already says read/listen/watch, so `topic` is usually redundant.                                                                                                                                                                                                                                                                                                                  |
| `invoice`   | none                                                                                                                               | `assets/finances/invoices`, `healthcare`, `assets/car`, `assets/house`                                                                                                                                                                                          | Invoice/receipt/payment proof. First-class because it has its own capture flow and index.                                                                                                                                                                                                                                                                                                                                                                               |
| `transcript`| none                                                                                                                               | none                                                                                                                                                                                                                                                            | Raw meeting transcript from Teams or Superwhisper. First-class because it has its own capture flow (teams-transcript skill / Superwhisper) and index. Usually linked to a meeting journal entry via `journal`; keeps full transcript text out of journal/note bodies. All transcripts live in `{org}/notes/transcripts/` (linked or standalone).                                                                                                          |
| `person`    | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Person profile only. Person-related occurrences are `journal` with `attendees`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `meeting`   | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Recurring meeting profile, not an occurrence. Meeting name is descriptive enough — no subtype needed.                                                                                                                                                                                                                                                                                                                                                                   |
| `team`      | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Team profile. Team rituals are `journal` entries with `team`.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `project`   | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Project/workstream profile only. Project artifacts are `category: note` with `project: [[Project Name]]`; occurrences are `category: journal`. Personal projects can have a clear end date (e.g. wedding prep, training). Nested projects are allowed when the child needs its own profile, journal, meetings, or lifecycle; use `parent` to link to the parent project. |
| `weekly`    | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Weekly planning note.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `daily`     | none                                                                                                                               | none                                                                                                                                                                                                                                                           | Cross-org daily aggregate.                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Index pages are not content notes: they have no `category` and use `topic: indexes`.

## Category Matrix

| Category    | Meaning                                                                                         | Main directory                                                                   | Typical `type` values                                                                   | Typical `topic` values                                                                                                                                                                                                                                                                                | Key fields                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `journal`   | Occurrence/session/event. Something happened.                                                   | Context folder when possible; otherwise `{org}/journal/`                         | `1-1`, `meeting`, `project`, `team`, `event`, `reflection`, `sport`, or none | `leadership`, `sport`, rarely needed                                                                                                                                                                                                                                                                  | `created`, optional relationship fields                                                                               |
| `meeting`   | Recurring journal series/profile. Not an occurrence.                                            | Under primary context: project/team, or `{org}/meetings/` if contextless | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `created`, `project`/`team` (context), `attendees`                                                          |
| `person`    | Person profile.                                                                                 | `{org}/people/{Person}/`                                                         | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `created`, `role`. Work people have a `## Details` section in body (teams, supervisor, email, github, mobile, board). |
| `team`      | Team profile. Can host team journals like retros.                                               | `{org}/teams/{Team}/`                                                            | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `created`, `owner`, `email`, `slack`, `domain`, `projects`                                                            |
| `project`   | Workstream/project profile. Aggregates child projects, notes, and journals.                     | `{org}/projects/{Project}/` or nested under another project                      | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `created`, `status`, optional `parent`                                                                                |
| `note`      | Knowledge, thought, research, draft, reference, inbox item, travel material, admin artifact, or project artifact. | `{org}/notes/`, `{org}/inbox/`, or context folder                                | `idea`, `research`, `feedback`, `reference`, `inbox`, `plan`                            | `career`, `hr`, `learning`, `management`, `references/cloud-platform`, `references/ai-platform`, `references/institutional-memory`, `sport`, `reading`, `interview`, `trips`, `healthcare`, `documents`, `assets/car`, `assets/house`, `assets/finances`, `development`, `entertainment`, `utilities` | `created`, optional context fields including `project`, `status`                                                      |
| `book`      | Book note. Knowledge, summary, reading note.                                                    | `personal/notes/books/`                                                          | none                                                                                    | `reading`, `interview`, or none                                                                                                                                                                                                                                                                       | `created`                                                                                                             |
| `place`     | Place note or recommendation.                                                                   | `personal/notes/places/`                                                         | `entry`, `recommendation`                                                               | `places/restaurant`, `places/bar`, `places/cafe`, `places/city`, `places/country`, `places/spot`                                                                                                                                                                                                      | `created`                                                                                                             |
| `trip`      | Trip profile or recommendation.                                                                 | `personal/notes/trips/`                                                          | `entry`, `recommendation`                                                               | none (add only when physical subdir exists)                                                                                                                                                                                                                                                           | `created`, `start`, `end` (entry only)                                                                                |
| `clippings` | Saved external thing to read, listen to, or watch.                                              | `{org}/notes/clippings/`                                                         | `read`, `listen`, `watch`                                                               | none                                                                                                                                                                                                                                                                                                  | `created`                                                                                                             |
| `invoice`   | Invoice, receipt, or payment proof.                                                             | `personal/notes/assets/finances/invoices/` or the owning topic folder            | none                                                                                    | `assets/finances/invoices`, `healthcare`, `assets/car`, `assets/house`                                                                                                                                                                                                                                | `created`, `status`                                                                                                 |
| `transcript`| Raw meeting transcript (Teams or Superwhisper).                                                 | `{org}/notes/transcripts/` (always)                                              | none                                                                                    | none                                                                                                                                                                                                                                                                                                 | `created`, optional `journal`                                                                                        |
| `weekly`    | Weekly todo/planning note.                                                                      | `{org}/weekly/`                                                                  | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `created`, `start`, `end`                                                                                             |
| `daily`     | Cross-org daily aggregate.                                                                      | `daily/`                                                                         | none                                                                                    | none                                                                                                                                                                                                                                                                                                  | `date`, `previous`, `next`                                                                               |

## Journal vs Note

Use `journal` when there is an occurrence.

Use a drafted journal when there is a future/prep occurrence without a known date yet. Drafted journals use `created` as the draft creation time. They intentionally omit `drafted` until the real journal entry is activated.

Drafts are supported for all journal routes: org-wide journal, person, meeting, project, and team. Create them through the journal draft flow, then activate them through the matching normal journal flow. Activation moves the old draft `created` value to `drafted` and writes a new `created` occurrence time.

Example:

```yaml
org: work
category: journal
type: 1-1
created: 2026-06-02T13:20
attendees:
  - "[[Sam]]"
```

Examples:

```yaml
org: work
category: journal
type: 1-1
created: 2026-05-29T10:00
attendees:
  - "[[Alex]]"
```

```yaml
org: work
category: journal
type: meeting
created: 2026-05-29T11:00
meeting: "[[Engineering Daily]]"
team: "[[Engineering]]"
attendees:
  - "[[Alex]]"
  - "[[Engineering]]"
```

```yaml
org: personal
category: journal
type: event
created: 2026-05-29T19:00
attendees:
  - "[[Robin]]"
```

Use `note` when it is knowledge, a thought, a draft, research, a reference, feedback, or an idea.

Examples:

```yaml
org: work
category: note
type: feedback
topic: career
created: 2026-05-29T14:00
```

```yaml
org: work
category: note
type: research
topic: management
created: 2026-05-29T09:30
```

```yaml
org: work
category: note
type: reference
topic: references/cloud-platform
```

```yaml
org: personal
category: note
type: idea
topic: development
created: 2026-05-29T20:15
```

```yaml
org: personal
category: book
created: 2026-05-29
```

```yaml
org: personal
category: place
type: recommendation
topic: places/restaurant
created: 2026-05-29
```

```yaml
org: personal
category: invoice
topic: assets/finances/invoices
created: 2026-05-29T14:30
```

```yaml
org: personal
category: clippings
type: read
created: 2026-05-29T21:00
```

```yaml
org: work
category: transcript
created: 2026-05-29T10:05
journal: "[[2026-05-29 10-00 Engineering Managers]]"
```

If a work thought belongs to a meeting, write it in that journal entry. If it is standalone, create a note.

### Journal Attendance Rules

Journal entries can describe one person, many people, teams, or a mix.

| Field | Meaning | Example |
|---|---|---|
| `attendees` | Mixed list of participants present in the occurrence: one person, many people, teams, or mixed. | `[[Alex]]`, `[[Engineering]]` |
| `meeting` | Recurring meeting profile when the journal entry is one occurrence of a meeting. | `meeting: "[[Engineering Daily]]"` |
| `project` | Project/workstream context for project-related events. | `project: "[[AI Platform]]"` |
| `team` | Team context for team rituals like retros, team dailies, planning, etc. | `team: "[[Engineering]]"` |

Rules:

1. 1-1 journal entries use `attendees` with one person.
2. Meeting journal entries copy `attendees` from the meeting profile by default.
3. `attendees` can contain people and teams in the same list.
4. Personal hangouts/calls use `attendees` for one or many people.
5. Loose journal entries can omit `attendees` when nobody else was involved.

### Journal Context Rules

Journal entries can attach to different primary contexts. Do not fake a project just to store a team journal.

| Context | Use when | Main field | Typical route |
|---|---|---|---|
| People | 1-1s, personal hangouts/calls, person-centered occurrences | `attendees` | `{org}/people/{Person}/` when one primary person is obvious |
| Meeting | Occurrence of a recurring ceremony/profile | `meeting` plus copied context | The meeting profile folder |
| Project | Delivery/project/workstream event | `project` | directly in `{org}/projects/{Project}/` or meeting folder under project |
| Team | Team ritual, team retro, team daily, team planning | `team` | `{org}/teams/{Team}/journal/` or meeting folder under team |
| Contextless | Company-wide or truly context-free recurring meetings | `meeting` only | `{org}/meetings/{Meeting}/` |
| Personal project | Personal workstream like wedding prep, apartment search, trip prep | `project` | directly in `personal/projects/{Project}/` or meeting folder under project |
| Topic folder | Trip, assets, documents, etc. | `topic` | `personal/notes/{Topic}/` when useful |
| One-time | Loose event without durable context | no context field required | `{org}/journal/` |

Context fields (`project`, `team`, `meeting`) describe entity context. `topic` describes section context such as trip, sport, assets, healthcare, documents, or books. `attendees` describes who was there.

### One-Time Journal Entries

Use the org-wide `{org}/journal/` route for one-time entries that should not create or attach to a durable entity/profile. This includes one-off work calls, private calls, ad-hoc sessions, meetings without a recurring meeting profile, hangouts, interviews, or small events that do not deserve their own person/project/team/meeting placement.

Org-wide journal types are intentionally loose:

| Type | Use when | Required fields |
|---|---|---|
| `event` | A one-off thing happened: call, meeting, hangout, session, interview, visit, small work/private event | none |
| `reflection` | Thinking journal, retrospective, monthly reflection, decision/thought processing | none |
| `sport` | Training, workout, body/gains logging | none |
| none | Fast capture where type adds no value yet | none |

For org-wide `event` journal entries, `attendees` is optional. Add it when people or teams are part of the meaning of the occurrence or useful for future lookup. Leave it out when the event is not participant-based or the audience is too broad to be useful.

Do not use relationship discriminator types (`1-1`, `meeting`, `project`, `team`) in the org-wide journal route unless the matching relationship field exists. If the relationship matters and should be queryable, use the relationship route instead: people, meetings, projects, or teams.

### Context Folder Pattern

Any durable context folder can host context-specific files. In a project folder, the project profile uses `category: project`; project artifact files use `category: note` with `project: [[Project Name]]`; occurrences use `category: journal` and can live directly beside project artifacts. Entity-like child collections get explicit folders such as `meetings/` and `projects/`; notes and journal entries do not need their own nested structure inside each project.

Examples:

```text
personal/projects/Wedding/
  Wedding.md
  projects/
    Fitness/
      Fitness.md
      2026-05-29 18-00 FBW training.md
    First Dance/
      First Dance.md
      2026-05-29 19-00 Salsa class.md
  2026-03-15 Venue visit.md
  Menu.md
  Guest List.md

personal/notes/trips/Alps 2026/
  Alps 2026.md
  journal/
    2026-02-15 Ski Day 1.md
  Ski Trip Packing List.md
```

Use `category: journal` for occurrences inside these folders. In project folders, use `category: note` plus `project: [[Project Name]]` for plans, links, project docs, and admin artifacts. Use `category: project` only for the project profile that aggregates child projects, journals, and notes. In topic folders, use the relevant first-class category or `category: note`.

### Transcripts

Raw meeting transcripts are their own first-class category (`category: transcript`), not journal or note bodies. They exist so full transcript text from Teams or Superwhisper does not bloat the journal entry or a normal note. A journal entry can hold a human summary and action items; the verbatim transcript lives in a linked transcript note.

Rules:

1. A transcript usually links to its meeting journal entry via `journal: "[[<journal filename>]]"`. All transcripts — linked or standalone — live in the dedicated `{org}/notes/transcripts/` folder, never beside the journal, so the journal folder stays clean and the whole transcript set is trivially excludable from search.
2. The link is one-to-one: exactly one transcript per journal entry. When a transcript is captured, the journal entry gets a `transcript: "[[<transcript filename>]]"` frontmatter property (shown inline in the journal's properties). Do not paste the transcript into the journal body, and do not add a `## Transcripts` section — a single wikilink property is enough. Links are by basename, so they resolve across folders.
3. Standalone transcripts with no meeting journal (e.g. a Superwhisper capture without a created occurrence) omit `journal` but still live in `{org}/notes/transcripts/`.
4. Transcripts carry no `type` and no relationship fields of their own; context comes from the linked journal. Keep summaries and decisions in the journal, raw text in the transcript.
5. The teams-transcript skill and Superwhisper are the capture sources. When the skill asks where to save, write the transcript into `{org}/notes/transcripts/`, then set the journal's `transcript` property.

## Placement Rules

### Work 1-1s

1-1 journal entries live under the person folder.

```text
work/people/Alex/
  Alex.md
  2026-05-29 10-00 Alex 1-1.md
```

### Recurring Work Meetings

Recurring meeting profiles live under their primary context: project, team, or the contextless `{org}/meetings/` fallback. Do not force all meetings into projects.

Projects/workstreams describe delivery or long-running work. Teams describe operating rituals and team-level ceremonies. `{org}/meetings/` holds truly contextless meetings (e.g. company all-hands, personal recurring group activities without a project).

Evergreen manager rhythms can be projects too, for example:

```text
work/projects/Engineering Operating Rhythm/
work/projects/AI Platform/
work/projects/Cloud Platform/
```

Project meeting structure:

```text
work/projects/Work Platform/
  Work Platform.md
  meetings/
    Engineering Managers/
      Engineering Managers.md
      2026-05-29 10-00 Engineering Managers.md
```

Contextless meeting structure:

```text
work/meetings/
  Let's Talk - Company Update/
    Let's Talk - Company Update.md
    2026-05-29 10-00 Let's Talk - Company Update.md
```

The meeting profile:

```yaml
org: work
category: meeting
project: "[[Work Platform]]"
attendees:
  - "[[Engineering]]"
```

Team meeting structure:

```text
work/teams/Engineering/
  Engineering.md
  meetings/
    Engineering Retrospective/
      Engineering Retrospective.md
      2026-05-29 10-00 Engineering Retrospective.md
```

Team meeting profile:

```yaml
org: work
category: meeting
team: "[[Engineering]]"
attendees:
  - "[[Engineering]]"
```

The meeting occurrence:

```yaml
org: work
category: journal
type: meeting
created: 2026-05-29T10:00
meeting: "[[Engineering Managers]]"
project: "[[Work Platform]]"
attendees:
  - "[[Engineering]]"
```

### Personal Journal

Person-tied personal journal entries live under the person folder.

```text
personal/people/Robin/
  Robin.md
  2026-05-29 Robin dinner.md
```

Person-less entries live in `personal/journal/`.

Sport/training and dance are nested projects under Wedding because they have their own profile, journal, and lifecycle. Their occurrences stay `category: journal`; activity labels like `sport` can be a `type` only for org-wide journal entries or a `topic` when the relationship type is already `project`.

### Notes

Notes live under `{org}/notes/` or `{org}/inbox/`.

Subdirectories can exist, including nested note folders like `personal/notes/healthcare/` or `personal/notes/entertainment/Games/`. Queries should not depend on paths. Use `topic` with the notes-folder-relative path when the grouping matters, for example `healthcare` or `entertainment/Games`.

```text
work/notes/career/
work/notes/hr/
work/notes/learning/
work/notes/references/cloud-platform/
work/notes/references/ai-platform/
work/notes/references/institutional-memory/
work/notes/clippings/read/
work/notes/clippings/listen/
work/notes/clippings/watch/
personal/notes/books/
personal/notes/places/
personal/notes/clippings/read/
personal/notes/clippings/listen/
personal/notes/clippings/watch/
personal/notes/healthcare/
personal/notes/trips/
personal/notes/assets/car/
personal/notes/assets/house/
personal/notes/assets/finances/invoices/
personal/notes/documents/
personal/notes/development/
personal/notes/entertainment/
personal/notes/utilities/
personal/notes/sport/
personal/notes/references/
```

Reference material is still a note. Use `category: note`, `type: reference`, and a `topic` under `references/...` instead of creating separate reference categories or sibling `references/` directories.

### Inbox

Inbox is not a category. It is a low-friction landing zone for rough capture: half-formed ideas, drafts, quick thoughts, and anything caught before it has a home. Inbox items are ordinary notes — `category: note`, `type: inbox` — that happen to live in `{org}/inbox/` until they are triaged into a real `topic`/folder or promoted to a stronger category (journal, clipping, etc.).

Design intent:

1. **Zero friction on capture.** Inbox creation asks nothing. There is no `title?` prompt because a rough note rarely deserves a name at capture time. The filename is an auto-generated `YYYY-MM-DD HH-mm-ss` timestamp — a name of a moment, like a journal stamp, not a subject. Rename the note later if it earns a real name; nothing in the schema depends on the filename.
2. **Always framed, never bare.** Every inbox note is created from `_templates/Note.md`, so it always has proper frontmatter (`org`, `category: note`, `type: inbox`, `created`). The vault should not accumulate blank `Untitled.md` files with no meta.
3. **Triage, don't accumulate.** Inbox is a staging area, not a permanent home. When an item matures, move it into `{org}/notes/{topic}/` (set `topic`, drop `type: inbox`) or convert it to its real category. The `personal/inbox/` folder should trend toward empty.
4. **`personal` is the default org.** Fast capture — especially the mobile `+` button — defaults to `personal/inbox/` because context is usually unknown at capture time. Work items can be triaged into `work/` later; both `{org}/inbox/` routes exist for explicit capture.

Inbox is reachable three ways, all producing the same framed, timestamped note:

- The dedicated QuickAdd `inbox` flow (`personal/inbox/`).
- The `note` flow's `inbox` destination (either org).
- Folder-click / mobile `+` new-file in an `{org}/inbox/` folder, routed by the Templater inbox file template.

#### Triage

Triage is the counterpart to capture: it clears the inbox by routing rough notes into their real home. The QuickAdd `triage` flow (a choice in `_scripts/quickadd/templates.md`) lists every inbox note across active orgs, newest first, labelled with its org so `personal` and `work` items are distinguishable. After picking a note you choose an action:

| Action | Effect |
|---|---|
| `move` | Runs the same `org? → where? → title?` routing as the Note flow (minus the `inbox` destination — you cannot triage inbox into inbox). Rewrites the note into a real note shape and moves it to the chosen folder. |
| `open` | Opens the note without changes, for when you just want to look before deciding. |
| `delete` | Sends the note to the local trash after a confirm prompt, for captures that turned out to be noise. |

`move` semantics:

1. **Same routing as note creation.** `move` reuses the Note flow's route resolver, so a triaged note lands with the same frontmatter a freshly created note would have for that route: `topic` for a notes folder, `type: reference` under `references/...`, or the matching relationship field (`meeting`/`project`/`team`/`attendees`) for a context folder.
2. **Title is required.** Leaving the inbox is when a rough note earns a real name, so `move` asks `title?` and renames the file from its timestamp to `{title}.md`.
3. **`type: inbox` is dropped; `created` is preserved.** The note is reframed from `_templates/Note.md`, so it is byte-identical in shape to a created note, but the original `created` (capture time) is kept rather than reset — triage is not a new creation, just a relocation. The note body is carried over verbatim.
4. **Triage is note-only.** `move` routes into note destinations (`notes`, `meetings`, `projects`, `people`, `teams`). Promoting an inbox item to a different category (journal, clipping, book, etc.) is a manual conversion, not part of this flow.

### Archive

Archive is the counterpart to creation: it retires a whole entity that is no longer active — a finished/abandoned project, a person who left, a dissolved team, a discontinued recurring meeting. It is a peer maintenance flow to Triage, exposed as the QuickAdd `Archive` choice (`settings.flow: archive` in `_scripts/quickadd/templates.md`). The flow asks `org?`, then `what?` (`project`, `person`, `team`, `meeting`), then the concrete entity, and moves that entity's whole folder — profile plus every note, journal, and nested meeting under it — to `archive/{org}/{same relative path}` (e.g. `work/projects/Foo` → `archive/work/projects/Foo`).

Design intent:

1. **Move-only, no frontmatter mutation.** Archiving changes nothing inside the notes — no `status: archived`, no `org` change. It is a pure folder move, so it can also be done by hand in Finder/Files without a script, and it never rewrites dozens of files. `org` is preserved (an archived work project stays `org: work`), matching how a fully archived historical org keeps its own `org`.
2. **Path-based hiding, not property-based.** Because `org` is unchanged, live org-aggregate bases would still match archived content by property. So those bases carry a `file.path.startsWith("{org}/")` filter (added to `projects`, `journals`, `notes`, `people`, `meetings`, `teams`, `drafts`, `types`, `topics` in each active org) and `_scripts/quickadd/actionpoints.md` scopes its scan the same way. Archived content lives under `archive/{org}/…`, so it drops out of every live view while remaining fully intact and searchable (Omnisearch downranks `archive`, it does not exclude it). This is the one sanctioned exception to "queries use properties, never paths".
3. **Whole entity folders move as a unit.** Project notes/journals live inside the project folder, a person's 1-1s inside the person folder, team journals/meetings inside the team folder, meeting occurrences inside the meeting folder. Moving the folder takes all descendants with it, so a still-live entity never ends up pointing at archived children — which is why entity-embedded bases (`project == this`, `attendees.contains(this)`, `team == this`) need no archive filter.
4. **Links survive the move.** The flow uses `app.fileManager.renameFile`, and `app.json` has `alwaysUpdateLinks: true`, so wikilinks into the moved subtree are rewritten automatically.
5. **You cannot archive an entire org.** The flow only offers concrete entity types and always drills to a specific entity; a guard (`isArchivableEntityPath`) additionally rejects any target that is not `{org}/{projects|people|teams|meetings}/{name…}` (≥3 path segments). An org root or a bare category root can never be selected or archived via the script. `chooseOrg` already excludes `archive/` itself, so archived content cannot be re-archived.
6. **Confirmation with a count.** Before moving, the flow shows `archive "{path}" ({n} notes)?` and only proceeds on `yes`. Destination collisions get a ` (1)` suffix.

Un-archiving is intentionally not scripted yet: move the folder back under `{org}/…` by hand (links update on move) when needed.

### Admin And Invoice Notes

Admin/evidence artifacts are stored in the relevant topic folder. Do not invent admin-specific categories or types unless there is a real view/template need later. Invoices are the exception: they use first-class `category: invoice` because they have a recurring capture flow and index. Other admin docs rely on `category: note` plus `topic`.

Examples:

```yaml
org: personal
category: invoice
topic: assets/finances/invoices
created: 2026-05-29T14:30
```

```yaml
org: personal
category: note
topic: assets/car
created: 2026-05-29T09:15
```

So `personal/notes/assets/finances/invoices/` contains `category: invoice` files, and `personal/notes/{topic}/` can contain admin/evidence notes when the artifact belongs to that topic. Do not split a topic like healthcare, assets, or documents into separate trees.

## Directory Structure

```text
Notes/
├── archive/
│   ├── acme/              # historical org; keeps org: acme, excluded from creation flows
│   └── {org}/             # archived slices of an active org (e.g. archive/work/projects/Foo),
│                          # produced by the QuickAdd Archive flow; entries keep their original org
├── personal/
│   ├── inbox/
│   ├── journal/
│   ├── meetings/
│   ├── people/
│   ├── projects/
│   ├── weekly/
│   ├── notes/
│   │   ├── references/
│   │   ├── books/
│   │   ├── places/
│   │   ├── trips/
│   │   ├── clippings/
│   │   │   ├── read/
│   │   │   ├── listen/
│   │   │   └── watch/
│   │   ├── documents/
│   │   ├── healthcare/
│   │   ├── assets/
│   │   │   ├── car/
│   │   │   ├── house/
│   │   │   └── finances/
│   │   │       └── invoices/
│   │   ├── development/
│   │   ├── entertainment/
│   │   ├── sport/
│   │   ├── transcripts/
│   │   └── utilities/
│   ├── archive/
│   └── bases/
├── work/
│   ├── inbox/
│   ├── journal/
│   ├── weekly/
│   ├── people/
│   ├── meetings/
│   ├── projects/
│   ├── teams/
│   ├── notes/
│   └── bases/
├── daily/
├── _templates/
├── _scripts/
├── _obsidian_architecture/
└── categories.md
```

Root folder ordering is not explicitly configured. Use Notebook Navigator's normal folder sorting and do not use Custom Sort or a vault-side `sortspec.md` file for root ordering.

## Index Pages And Bases

Category/index pages live inside their folders and do not represent content notes.

Frontmatter discriminator fields such as `org`, `category`, and `type` stay scalar strings, not wikilinks. They are stable query values, not entities. Do not add secondary link fields such as `org_index` or `category_index` to content notes, and do not generate navigation sections in content templates for these fields. Link directly to reusable `.base` files from index pages; do not create one-to-one `.md` wrappers in `{org}/bases/` that only embed a `.base` file.

Example:

```yaml
org: work
topic: indexes
```

No `category` on index pages.

Examples:

```text
work/people/people.md
work/projects/projects.md
personal/notes/books/books.md
daily/daily.md
categories.md
```

`categories.md` is the global index-of-indexes and filters by `topic == "indexes"`.

Bases queries must use properties, never directory paths. The one sanctioned exception is the archive boundary: because the Archive flow moves an entity into `archive/{org}/…` without changing its `org`, the live org-aggregate bases add a `file.path.startsWith("{org}/")` filter so archived-but-same-org content drops out of live views (see Archive). Entity-embedded bases (`project == this`, `attendees.contains(this)`, etc.) need no such filter — whole entity folders move as a unit, so a live entity never points at archived children.

Generated markdown views may also live in `{org}/bases/` when Obsidian Bases cannot model the data shape. Example: `{Org} Tasks.md` extracts open `## Tasks` checklist items from weekly, journal, and book note body sections. Companions `{Org} Priority.md` (items carrying a `#prio` marker — a focused subset that also stays in Tasks) and `{Org} Wishlist.md` (items carrying a `#wl` marker — later/someday backlog, filtered out of Tasks) are generated in the same pass. The source of truth remains the source note; generated views are snapshots and must not be edited as canonical data.

Examples:

```text
category == "journal" AND attendees.contains(this)
category == "journal" AND meeting == this
category == "journal" AND project == this
category == "journal" AND team == this
category == "note" AND topic == "career"
```

Normal views hide `status: archived` and `status: obsolete`.

## Template Rules

Templating has two layers:

1. QuickAdd owns explicit command-driven creation.
2. Templater owns folder-click creation when the current folder gives enough context.

Q templates in `_templates/` are the primary templates. They are intentionally dumb content templates with frontmatter/body placeholders such as `{{org}}`, `{{created}}`, `{{contextLine}}`, `{{relationshipLines}}`, and no large Templater scripts.

Required scalar fields should be written explicitly in templates, for example `created: {{created}}`, not hidden behind generated whole-line placeholders. Whole-line placeholders such as `{{topicLine}}`, `{{contextLine}}`, `{{relationshipLines}}`, or `{{draftPlanningSection}}` are for optional, conditional, or multi-line content. In frontmatter, put explicit required fields first and generated whole-line placeholders after the normal property block.

Templater's configured template folder is `_templates/`. Automatic folder/file template routing points to adapter scripts in `_scripts/`, and those adapters render Q templates from `_templates/`.

Scripts own prompts, routing, filename generation, folder creation, and context inference. `work` and `personal` are active first-class org roots. `archive/` is not an org root and must be excluded from creation scripts. Creation scripts enumerate active root org folders instead of hardcoding org names. Org priority is data, not code: it comes from `_scripts/config/orgs.json` (`order` sets sort priority in pickers, `default` sets the fallback org for flows invoked without one). When that file is absent the scripts fall back to a name-free rule — sort active orgs alphabetically with `personal` always last — so the vault keeps working with no config. `_scripts/config/orgs.json` is machine-local and git-ignored; `_scripts/config/orgs.example.json` ships as the template.

| Script                                                  | Used by                         | Role                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_scripts/quickadd/journal.md`                          | QuickAdd `Journal` choice       | Raw JavaScript stored as Markdown so Obsidian Sync includes it on mobile. Explicit journal creation flow. The only top-level journal choice is `Journal`; it asks `org?`, `mode?`, then `where?` (`journal`, `person`, `meeting`, `project`, `team`). |
| `_scripts/quickadd/templates.md`                        | QuickAdd non-journal choices    | Raw JavaScript stored as Markdown so Obsidian Sync includes it on mobile. Explicit creation flow for non-journal categories and generic notes. Direct choices are `Inbox`, `Triage`, `Archive`, `Note`, `Person`, `Meeting`, `Project`, `Team`, `Book`, `Clipping`, `Invoice`, `Document`, `Place`, `Trip`, `Transcript`, `Daily`, `Weekly`, `Monthly Reflection`, and `Meal Plan`. `Weekly` is a submenu. `Triage` is the inbox cleanup flow (pick an inbox note, then move/open/delete); `Archive` is the entity archival flow (pick org, entity type, then the entity, and move its whole folder to `archive/{org}/…`); all others create. A hidden `periodicAuto` flow (wired to the `Periodic Notes (startup refresh)` choice, `command: false`, `runOnStartup: true`) silently creates this week's weekly for every active org and today's daily on launch if they are missing. |
| `_scripts/templater/apply-journalq-folder-template.md`  | Templater file templates        | Folder-click journal creation when the folder is already a journal/person/meeting/team context.                                                                                                                                                                                                |
| `_scripts/templater/apply-templateq-folder-template.md` | Templater file templates        | Folder-click creation for profiles, notes, weekly/daily, and personal note categories.                                                                                                                                                                                                                 |
| `_scripts/quickadd/Open Weekly.md`                               | QuickAdd nested weekly choices  | Opens or creates the current Work or Personal weekly note. Used by nested `Weekly` choices `Open Work Weekly` and `Open Personal Weekly`, which remain command-enabled for shortcuts but are not top-level `Run QuickAdd` choices. |
| `_scripts/quickadd/Cleanup Empty Untitled Notes.md`               | Script only                     | Moves empty or frontmatter-only `Untitled*.md` notes to Obsidian trash after confirmation. It ignores `.trash/` and keeps Untitled notes with body content. Not currently exposed in `Run QuickAdd`. |
| `_scripts/quickadd/actionpoints.md`                     | QuickAdd `Tasks` choice + hidden startup choice | Raw JavaScript stored as Markdown so Obsidian Sync includes it on mobile. Standalone generated-view maintenance script (peer to `journal.md`); it copies the shared org/back/frontmatter helpers because QuickAdd scripts cannot import one another. Generates `{org}/bases/{Org} Tasks.md`, `{Org} Priority.md`, and `{Org} Wishlist.md` from open `## Tasks` checkboxes in weekly notes, journals, and books (one heading for all; heading match is case-insensitive). Books are personal-only, so a "Book Tasks" group only appears when there are open book tasks. A `#wl` marker moves an item to the Wishlist (out of Tasks); a `#prio` marker additionally lists it in Priority (a focused subset — it stays in Tasks). The manual `Tasks` choice asks `org?` (or `all`), regenerates, then opens Tasks / Priority / Wishlist. A hidden second choice (`command: false`, `runOnStartup: true`) runs `actionPointsAuto`, which silently regenerates every org on launch after waiting for the metadata cache. Source notes remain the source of truth; generated views do not sync checkbox edits back. |

Direct QuickAdd choices are Macro choices with a single User Script command, except for `Weekly`, which is a Multi choice used as a submenu. Non-journal direct choices point to `_scripts/quickadd/templates.md` and pass `settings.flow` to select the concrete flow. The `Journal` choice points to `_scripts/quickadd/journal.md` with no flow setting so the script runs its grouped menu. Journal draft mode is selected inside that menu (`mode? draft`), not through separate top-level `Journal Draft` choices.

The `Document` choice is a shortcut for capturing scanned personal documents (e.g. świadectwo pracy, employment paperwork, medical scans). It does not introduce a new category: it renders `_templates/Note.md` as a plain `category: note` file with `org: personal`, no `type`, and no date prefix on the filename. It asks `topic?` from a fixed list (`documents`, `healthcare`, `assets/car`, `assets/house`, `assets/finances`, `career`) and routes to `personal/notes/documents/` for `documents` or `personal/notes/{topic}/` otherwise. This is topic-driven placement, so a document can start under `documents` and later be moved to `assets/car`, `healthcare`, etc. without changing its schema. Invoices remain the only first-class admin `category`; documents deliberately stay notes until a real index/view need appears.

The `Daily` flow supports back-filling missed days, not just today. It first asks `which day?` with options for today, yesterday, the preceding days of the last week (each flagged `(exists)` when a daily note already exists), and a `pick a date…` manual `YYYY-MM-DD` entry. All derived fields (`date`, `previous`, `next`, and the `week` links) are computed relative to the chosen day, not the current date, so a back-filled daily links to the correct week and neighbors. Day strings use local-time formatting to avoid a UTC off-by-one on the filename. Selecting a day that already has a note just opens it. The link/folder-click path honours the same intent: `apply-templateq` routes by filename first, so any date-named (`2026-08-10`) or week-named (`2026-08-03--08-09 Personal`, guarded to an active org suffix) file is treated as a daily/weekly and `moveOrOpen`'d into `daily/` or `{org}/weekly/` — regardless of where it was created. This matters because the default new-note location is `personal/inbox` (`newFileLocation: folder`), so clicking a bare `[[2026-08-10]]` or `[[… Personal]]` `previous`/`next` link resolves the new note into the inbox; without filename routing it would wrongly become an inbox note. Non-date names in those folders (e.g. `Untitled`) fall back to today. This exists because the main entry point (`cmd+shift+d`) is used daily, but weekend or offline gaps need a way to create a missed day's note after the fact.

Automatic creation routing uses Templater file templates with path regexes pointing to the Q adapter scripts, not folder templates. Folder templates must stay disabled because Templater checks them before file templates and returns early when no folder match exists. File-template routing covers `personal` and `work` for shared org structures; team profile and journal routes cover non-personal active orgs (`work`).

QuickAdd user scripts are raw JavaScript stored as `.md` files under `_scripts/quickadd/`. Do not rename them to `.js`. Obsidian Sync's installed-community-plugin option syncs plugin bundles under `.obsidian/plugins/` (`main.js`, `styles.css`, `manifest.json`) and their settings, but `_scripts/quickadd/*.js` is an arbitrary vault file referenced by QuickAdd config. Keeping these scripts as Markdown makes them normal synced notes and prevents mobile from receiving a QuickAdd config that points to a missing script file.

### Invocation Modes

| Mode                   | How                                                                                 | Behavior                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit creation      | Direct QuickAdd choices                                                             | Full prompt flow. The script asks for org/context/type/title and creates the file in the correct route. Journal is grouped: `Journal` -> `org?` -> `mode?` -> `where?`.                                                     |
| Folder-click creation  | Create a new file in a meaningful folder while Templater file templates are enabled | Templater matches the new file path with a regex and runs a Q adapter. The adapter infers only the context that is unambiguous from the folder path, renders the matching Q template, and moves/renames the file if needed. |
| Archive flow           | QuickAdd `Archive` choice                                                            | Retires a whole entity. Asks `org?` -> `what?` (project/person/team/meeting) -> the entity, then moves its folder (profile + all descendants) to `archive/{org}/…`. Move-only, no frontmatter change; guarded so an org or category root can never be archived. |
| Periodic startup       | Hidden QuickAdd `Periodic Notes (startup refresh)` choice (`runOnStartup: true`)      | On launch, `periodicAuto` in `templates.md` silently creates this week's weekly for every active org and today's daily if missing. Create-if-missing only, opens nothing, never throws. Peer to the action-points startup refresh. |
| Cleanup script         | `_scripts/quickadd/Cleanup Empty Untitled Notes.md`                                          | Script scans active vault notes, confirms with the user, then moves empty or frontmatter-only `Untitled*.md` notes to Obsidian trash. It is not currently exposed as a QuickAdd choice.                                     |
| Generated view refresh | QuickAdd `Tasks` choice (manual) or the hidden `runOnStartup` choice (automatic on launch) | Regenerates `{org}/bases/{Org} Tasks.md`, `{Org} Priority.md`, and `{Org} Wishlist.md` from the `## Tasks` sections of weekly notes, journals, and books. Reads open checklist items only; `#wl`-tagged ones move to the Wishlist, `#prio`-tagged ones are additionally listed in Priority. Does not write back to source notes. Manual run asks `org?` (or `all`) then opens one view; the startup run is silent, all-orgs, and opens nothing. |
| Manual fallback        | Templater template picker using `_templates/`                                       | Useful for manual insertion only. Prefer QuickAdd or folder-click creation for structured notes because Q templates contain placeholders.                                                                                   |

Folder-click creation is deliberately narrower than QuickAdd. If the path is ambiguous, the adapter should show a notice and stop instead of guessing.

Examples:

| Folder-click path | Result |
|---|---|
| `{org}/people/Untitled.md` | Person profile via `_templates/Person.md`; asks `person?`. |
| `{org}/people/{Person}/Untitled.md` | Journal 1-1 entry via `_templates/Journal Person.md`; person is inferred from the folder. |
| `{org}/projects/Untitled.md` | Top-level project profile via `_templates/Project.md`; asks `project?`. |
| `{org}/projects/{Project}/projects/Untitled.md` | Nested project profile via `_templates/Project.md`; parent is inferred. |
| `{org}/projects/{Project}/meetings/Untitled.md` | Meeting profile via `_templates/Meeting.md`; project context is inferred. |
| `{org}/projects/{Project}/meetings/{Meeting}/Untitled.md` | Journal meeting entry via `_templates/Journal Meeting.md`; project and meeting are inferred. |
| `{org}/inbox/Untitled.md` | Framed inbox note via `_templates/Note.md`; `type: inbox`, renamed to a `YYYY-MM-DD HH-mm-ss` timestamp. Asks nothing. This is the path the mobile `+` button uses. |
| `{org}/notes/.../Untitled.md` | Note or first-class personal note category depending on the folder (`Book`, `Invoice`, `Place`, etc.). |
| `{org}/journal/Untitled.md` | Org-wide journal entry, or monthly reflection if selected. |

Folder-click creation should not infer an org from an unrelated current note. It can infer org only from the target file path itself, because the user explicitly created the file inside that org folder.

All creation paths guard against overwriting: if the current file has content, the adapter aborts.

### Mobile Capture Contract

Mobile has two intentionally different capture paths:

| Action | Command | Destination | Purpose |
|---|---|---|---|
| Pull action | `quickadd:runQuickAdd` | Chosen by the QuickAdd flow | Structured capture with category, type, topic, and proper routing. |
| Plain `+` / new file | `file-explorer:new-file` | `personal/inbox/`, auto-templated to a framed inbox note | Fast rough capture when friction should be near zero. |

The plain mobile `+` behavior is controlled by Obsidian core settings in `.obsidian/app.json`:

```json
"newFileLocation": "folder",
"newFileFolderPath": "personal/inbox"
```

This lands the new file in `personal/inbox/`, the safe zone for notes created without context. It does not stop there, though: because Templater has `trigger_on_file_creation: true` and a file template regex `^(personal|work)/inbox/[^/]+\.md$` pointing at the inbox adapter, the freshly created `Untitled.md` is immediately routed through `_scripts/templater/apply-templateq-folder-template.md`. The adapter infers `org` from the path, renames the file to a `YYYY-MM-DD HH-mm-ss` timestamp, and renders `_templates/Note.md` with `type: inbox` frontmatter. So the mobile `+` produces the same framed inbox note as the QuickAdd `inbox` flow — no bare `Untitled` with no meta. The empty-content guard means an accidental tap that gets abandoned still ends up as a valid (if empty-bodied) inbox note rather than a schema-less file.

Structured work notes, journals, people, projects, meetings, invoices, clippings, and weekly/daily notes should still use QuickAdd rather than `+`, because `+` only ever produces an inbox note.

If Templater does not fire on a given device/version and a blank `Untitled` note slips through, use `Cleanup empty Untitled notes` from the command palette. It must ignore `.trash/` and must not delete Untitled notes with body content.

## Search (Omnisearch)

Omnisearch config lives in `.obsidian/plugins/omnisearch/data.json`. These non-default settings are intentional:

- `downrankedFoldersFilters: ["archive", "notes/transcripts"]` — penalizes results from any path containing `archive` or `notes/transcripts`. That content stays indexed but active notes surface first for the same query.
- `recencyBoost: "1"` — boosts recently modified files. Reinforces the above since archive content is old.
- `hideExcluded: false` — Omnisearch does not hard-hide Obsidian's Excluded Files; transcripts are downranked (above), not excluded. Flip to `true` (with a `userIgnoreFilters` regex) only if switching to full exclusion.

Raw transcripts are downranked in search, not excluded. They are large ASR dumps, but they are also the source of truth for what was actually said, so they stay findable — just below real notes for the same query. The meaningful summary and action items live in the linked journal; the `transcript` property points to the raw text. Downranking is enforced by:

1. Omnisearch `downrankedFoldersFilters` includes `notes/transcripts` — a path **substring** (not start-anchored), so it matches `work/notes/transcripts/` and `personal/notes/transcripts/` (and any future org). Transcript results still appear but rank low.
2. Omnisearch `hideExcluded: false` — nothing is hard-hidden; `userIgnoreFilters` carries no transcript entry.

If raw transcript noise ever outweighs the value of searching them, switch to full exclusion: add the **regex** `/notes/transcripts/` to `app.json` `userIgnoreFilters` (bare strings match as a start-anchored prefix and would miss the org-prefixed paths) and set Omnisearch `hideExcluded: true`. All transcripts live in the single dedicated `{org}/notes/transcripts/` folder specifically so one path segment controls this, whichever policy is chosen.

Do not reset these to defaults when reconciling config from another machine.

## Obsidian Config Sync Rules

This Mac is the source of truth for shared Obsidian configuration. Sync or Git changes from another machine should be reconciled against this design before committing.

Shared config:

1. `.obsidian/app.json` is shared. It owns default plain-new-file routing through `newFileLocation: folder` and `newFileFolderPath: personal/inbox`; the Templater inbox file template then frames that new file into a proper inbox note (see Mobile Capture Contract). Mobile toolbar should prefer QuickAdd for structured capture: `mobilePullAction: quickadd:runQuickAdd`, with QuickAdd available in `mobileToolbarCommands`. It also owns `userIgnoreFilters` (core Excluded Files); transcripts are currently downranked, not excluded, so this carries no transcript entry unless the exclusion policy is switched (see Search).
2. `.obsidian/community-plugins.json` is shared. Keep only plugins used in normal vault operation. Do not enable migration-only plugins such as `obsidian-importer` unless actively importing. Do not enable Custom Sort; Notebook Navigator owns root folder order.
3. QuickAdd, Templater, Notebook Navigator, hotkeys, appearance, snippets, and other stable plugin settings are shared when they support the vault creation/navigation flows. Notebook Navigator should not define explicit root folder ordering unless there is a concrete navigation need later.
4. Bookmarks are intentionally empty. Navigation should come from folders, Bases, links, search, and templates, not machine-specific bookmarks.

Current implementation snapshot:

1. Active community plugins are listed in `.obsidian/community-plugins.json`; migration-only plugins such as `obsidian-importer` and Custom Sort are not enabled.
2. A legacy `.obsidian/plugins/custom-sort/data.json` file may exist locally, but Custom Sort must stay disabled unless this design changes. Notebook Navigator owns folder navigation and keeps `rootFolderOrder` empty.
3. `.obsidian/types.json` may include built-in or legacy property type definitions such as `tags`; this does not change the target content schema.

Obsidian Sync policy:

1. Markdown notes and normal attachments are synced across devices.
2. Images, audio, video, and PDFs are allowed through Obsidian Sync because they are content attachments.
3. Vault configuration sync is enabled for main settings, appearance, themes/snippets, hotkeys, core plugin state/settings, active community plugin list, installed community plugins, and community plugin settings.
4. Installed community plugin sync covers plugin assets under `.obsidian/plugins/`, including plugin `main.js`, `styles.css`, and `manifest.json`. It does not make arbitrary vault-side `.js` scripts under `_scripts/` equivalent to installed plugin assets.
5. Do not place runtime-critical vault behavior in arbitrary non-note files such as `_scripts/**/*.js` unless there is an explicit sync path for that file type on every device.
6. QuickAdd user scripts must stay as raw JavaScript inside `.md` files under `_scripts/quickadd/`. QuickAdd reads and evaluates the file contents, so the extension does not need to be `.js`.
7. If a plugin configuration points to a vault file, that target file must be syncable under this policy. Otherwise mobile can receive the config but not the referenced file.

Local-only config:

1. `.obsidian/workspace.json` and `.obsidian/workspace-mobile.json` are device/session state and should not be committed.
2. `.obsidian/plugins/obsidian-local-rest-api/data.json` is local-only because it contains machine-specific API keys and certificates. Do not sync or commit it.
3. MCP/client integrations that need the Obsidian Local REST API key should read it from the local shell environment (e.g. an `OBSIDIAN_REST_API_KEY` export in a machine-local, untracked shell profile), not from tracked vault files.
4. Empty legacy folders from older vault structures, such as `2 Areas/`, should be deleted on every synced machine so Obsidian Sync does not recreate them.
5. Per-user script config is machine-local and git-ignored: `_scripts/config/orgs.json` (org priority/default) and `_scripts/config/mealplan.json` (meal-plan placement). Each ships a scrubbed `*.example.json` sibling, and every consumer has a safe fallback, so the vault works even when these files are missing. `.obsidian/hotkeys.json` and `.obsidian/plugins/quickadd/data.json` are also kept out of the shared config because their choice IDs carry real org names; scrubbed `*.example.json` copies ship in their place. Obsidian reads the real files from disk regardless, so ignoring them from Git does not change runtime behavior.

### Q Template Reference

| Q template(s)                                                                                                                                                                            | QuickAdd flow               | Folder-click adapter                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `_templates/Journal.md`, `_templates/Journal Person.md`, `_templates/Journal Meeting.md`, `_templates/Journal Project.md`, `_templates/Journal Team.md` | grouped `Journal` choice    | `apply-journalq-folder-template.md`                                                 |
| `_templates/Note.md`                                                                                                                                                                     | direct `Note`               | `apply-templateq-folder-template.md`                                                |
| `_templates/Note.md` (reused)                                                                                                                                                            | direct `Document`           | none (topic-driven; no folder-click adapter)                                        |
| `_templates/Person.md`                                                                                                                                                                   | direct `Person`             | root `{org}/people/` only                                                           |
| `_templates/Meeting.md`                                                                                                                                                                  | direct `Meeting`            | `{org}/meetings/`, `{Project}/meetings/`, `{Team}/meetings/` |
| `_templates/Project.md`                                                                                                                                                                  | direct `Project`            | root `{org}/projects/` and direct nested `projects/` folders                        |
| `_templates/Team.md`                                                                                                                                                                     | direct `Team`               | root `{org}/teams/` for non-personal orgs                                           |
| `_templates/Book.md`                                                                                                                                                                     | direct `Book`               | `personal/notes/books/...`                                                          |
| `_templates/Clipping.md`                                                                                                                                                                 | direct `Clipping`           | `{org}/notes/clippings/...`                                                         |
| `_templates/Invoice.md`                                                                                                                                                                  | direct `Invoice`            | supported personal invoice/topic folders                                            |
| `_templates/Place.md`                                                                                                                                                                    | direct `Place`              | `personal/notes/places/`                                                            |
| `_templates/Trip.md`                                                                                                                                                                     | direct `Trip`               | `personal/notes/trips/`                                                            |
| `_templates/Transcript.md`                                                                                                                                                               | direct `Transcript`         | `{org}/notes/transcripts/`                                                         |
| `_templates/Daily.md`                                                                                                                                                                    | direct `Daily`              | `daily/`                                                                            |
| `_templates/Weekly.md`                                                                                                                                                                   | `Weekly` -> `Create Weekly` | `{org}/weekly/`                                                                     |
| `_templates/Monthly Reflection.md`                                                                                                                                                       | direct `Monthly Reflection` | `{org}/journal/` option                                                             |

### Why Journal Has Multiple Q Templates

Journal is polymorphic. It has several stable frontmatter shapes depending on the relationship context:

| Journal shape | Fixed fields |
|---|---|
| Org-wide journal | optional `type` only |
| Person journal | `type: 1-1`, `attendees` |
| Meeting journal | `type: meeting`, `meeting`, optional `project`/`team` |
| Project journal | `type: project`, `project` |
| Team journal | `type: team`, `team` |

Splitting the journal templates keeps each template readable and avoids encoding too much YAML shape logic in scripts. It also mirrors the folder-click behavior: a person folder, meeting folder, and team journal folder each imply a different journal shape.

Most other categories do not need multiple smaller Q templates because their body and frontmatter shape are stable. They only have one or two optional lines:

| Category | Why one Q template is enough |
|---|---|
| `Meeting` | Context is just one optional relationship line: project/team. |
| `Project` | Nested projects only add optional `parent`. |
| `Note` | It is intentionally generic; `_Note` was a router, not a distinct body format. |
| `Book`, `Clipping`, `Invoice`, `Place`, `Trip` | The category body is stable; route/type/topic values are data, not separate document shapes. |
| `Transcript` | Stable shape: `journal` link plus raw transcript body. Always lands in `{org}/notes/transcripts/`; the optional `journal` link is data, not a different document shape. |

Split a Q template only when the resulting document has a materially different stable shape. Do not split just because one frontmatter value changes.

### Note Routing

| Note route | Route | Required fields | Optional fields |
|---|---|---|---|
| `inbox` | `{org}/inbox/` | `org`, `category: note`, `type: inbox`, `created` | `topic` |
| `notes` | `{org}/notes/`, selected existing folder under `{org}/notes/`, or new folder under `{org}/notes/` | `org`, `category: note`, `created` | `topic` when a folder is selected/created |
| `meetings` | selected meeting folder anywhere under `{org}` | `org`, `category: note`, `created`, `meeting` | copied/inferred `project` or `team` from the meeting path |
| `projects` | selected project folder, including nested projects | `org`, `category: note`, `created`, `project` | |
| `people` | `{org}/people/{Person}/` | `org`, `category: note`, `created`, `attendees` or person link in body | `type`, `topic` |
| `teams` | `{org}/teams/{Team}/` | `org`, `category: note`, `created`, `team` | Requires existing teams folder |

For `org: personal`, project context means personal project folders. For `org: work`, project context means Work project/workstream folders. The form should not show irrelevant org-specific people/projects by default.

`_templates/Note.md` uses the same shape as the old `_Note`: choose `org?`, choose top-level `where?`, choose a concrete context/folder when needed, then ask `title?`. For `notes`, the second step lists `new folder` first, then the root `notes`, then all existing folders under `{org}/notes/`. Selecting `new folder` asks for a parent (`notes`, `references`, etc.) and then the new folder name. New note folders are created only under `{org}/notes/`. Existing and new note-folder routes set `topic` to the notes-folder-relative path. `references` is not a top-level `where?` option; selecting or creating a `references/...` notes folder sets `type: reference` automatically.

The `inbox` route is the exception: it is rough capture for drafting ideas, so it skips the `title?` prompt entirely. The filename is an auto-generated `YYYY-MM-DD HH-mm-ss` timestamp, like a journal stamp — a name of a moment, not a subject. Rename the note later if it earns a real name; nothing in the schema depends on the filename. This applies to both the dedicated `inbox` flow and the `note` flow's `inbox` destination, and matches the folder-click adapter (which already writes inbox files without asking for a title).

Project template routing uses the same `where?` shape as Journal and Note creation, but project creation allows only one nesting level in the explicit QuickAdd flow. Choose `projects` to create a top-level project under `{org}/projects/{Project}/`, or choose a top-level project like `Wedding` to create `{Parent}/projects/{Child}/{Child}.md`. Nested project profiles use `parent: [[Parent Project]]`. Use nesting only when the child needs its own profile, journal, meetings, or lifecycle; otherwise keep supporting material as project artifacts inside the parent.

Meeting template routing uses the same context idea: choose `org?`, then `where?`. Choose `meetings` for a contextless/global recurring meeting under `{org}/meetings/{Meeting}/{Meeting}.md`, or choose a context folder such as `projects` or `teams` and then the concrete entity. Contextual meeting profiles are created under `{Entity}/meetings/{Meeting}/{Meeting}.md` and include the matching relationship field.

All template prompts should be short and consistent: `org?`, `mode?`, `where?`, `title?`, `person?`, `project?`, `meeting?`, `type?`, `topic?`, etc. Avoid full-sentence prompt labels. Route options should be raw destination/category words like `journal`, `notes`, `folder`, `projects`, `people`, not explanatory phrases. For Journal, `mode?` is intentionally explicit because mobile should expose fewer top-level commands and more nested questions. For Note, the second prompt says where the content will go.

Scripted QuickAdd `suggester` prompts should include `← Back` as the last option after the first prompt in a creation flow. In raw QuickAdd user scripts this is implemented as a synthetic suggester option that restarts the current command flow. Text prompts (`inputPrompt`) do not have a native back button, so title/name/body-like inputs remain terminal prompts rather than navigable steps.

Title/name prompts should be last in each creation flow. Ask routing, type, topic, and context questions first, then ask the final file/profile title such as `title?`, `project?`, `meeting?`, `person?`, or `team?`. The `inbox` route is the deliberate exception: it asks nothing and stamps a timestamp filename.

| Destination category | Route | Required fields | Optional/generated fields |
| -------------------- | ----- | --------------- | ------------------------- |
| `journal` | `{org}/journal/` | `org`, `category`, `created` | Optional `type` chosen during capture, including no type. Options: `event`, `reflection`, `sport` |
| `people` | `{org}/people/{Person}/` | `org`, `category`, `type: 1-1`, `created`, `attendees` | |
| `meetings` | selected meeting folder anywhere under `{org}` | `org`, `category`, `type: meeting`, `created`, `meeting` | copied/inferred `project` or `team` from the meeting path |
| `projects` | selected project folder directly, or selected meeting under `{org}/projects/{Project}/meetings/{Meeting}/` | `org`, `category`, `type: project`, `created`, `project` | `type: meeting` and `meeting` when a project meeting is selected |
| `teams` | `{org}/teams/{Team}/journal/` | `org`, `category`, `type: team`, `created`, `team` | Requires existing teams folder |

For `Journal -> project`, ask the second `where?` prompt only when the selected project has meeting folders. If the selected project has no meetings, create or open the journal directly in that project folder. Subprojects are selected in the first `project?` prompt, not in the second `where?` prompt.

For relationship journal entries, `type` is the discriminator for the expected frontmatter shape. `category: journal` says this is an event/log entry; `type` says which relationship fields should exist, similar to a union type in code. The Journal flow uses a small mapping for known relationship destinations: `people -> 1-1`, `meetings -> meeting`, `projects -> project`, `teams -> team`. Org-wide entries in `{org}/journal/` may have a type, but the template must allow no type.

Journal filenames created by the template should include the timestamp plus inferred context for almost all occurred routes: person name, meeting name, project name, or team name. Only the org-wide `{org}/journal/` route asks for a title because there is no stronger context to infer from. The title can still be edited after creation when a more descriptive name is useful. Drafted journals use `Draft {Context}.md` until activated, then QuickAdd moves the draft `created` value to `drafted`, writes a new occurrence `created`, and renames the file to the normal timestamped filename.

### Journal Draft Activation

Use `Journal` -> `mode? draft` when there is future/prep material for an occurrence but the occurrence date is unknown or should not be guessed. Draft journals are normal `category: journal` notes with `created` and no `drafted`. Their filename starts with `Draft `.

Draft creation is idempotent for the same route and context. If `Draft {Context}.md` already exists in the target folder, QuickAdd and folder-click creation open that existing draft instead of creating `Draft {Context} (1).md`. Normal occurred journal entries still use timestamped filenames and keep duplicate-safe suffixing when a collision happens.

When a normal journal flow runs later (`Journal` -> `mode? now` -> selected route), QuickAdd should search the selected context folder for matching drafts:

- same `org`
- same journal route: org-wide entries match by `type` and no relationship context; relationship entries match by relationship type and relationship field (`attendees`, `meeting`, `project`, or `team`)
- filename starts with `Draft `
- `created` exists
- `drafted` is missing

If a matching draft exists, QuickAdd should offer to activate it before asking prompts that are only needed for a new note. For org-wide journals, this means matching drafts are offered after `type?` and before `attendees?`/`title?`. Activation preserves the body, renames the old draft `created` value to `drafted`, writes a new `created` with the occurrence timestamp, and renames the file from `Draft {Context}.md` to `YYYY-MM-DD HH-mm {Context}.md`. If no draft exists, QuickAdd creates a normal occurred journal immediately.

Each org can surface open journal drafts through `{org}/bases/drafts.base`. The base filters to `category == "journal"`, the matching `org`, non-archived/non-obsolete notes, and `file.basename.startsWith("Draft ")`. Use this base for direct draft review instead of manually searching folders.

## Periodic Notes

Three periodic note types with different roles:

| Type | Category | Role | Folder | Filename | prev/next |
|------|----------|------|--------|----------|-----------|
| Daily | `daily` | Cross-org aggregate showing what happened today | `daily/` | `YYYY-MM-DD.md` | yes, plain dates |
| Weekly | `weekly` | Org-scoped planning (tasks + notes) with week overview | `{org}/weekly/` | `YYYY-MM-DD--MM-DD {Org}.md` (Monday--Sunday) | yes (same org) |
| Monthly | `journal` (type: `reflection`) | Org-scoped backward-looking reflection on the past month | `{org}/journal/` | `YYYY-MM {Org} Monthly Reflection.md` | yes (same org) |
| Meal Plan | `journal` (type: `project`) | Weekly meal planning for the household | `personal/projects/Meal Plan/` | `YYYY-MM-DD--MM-DD Cooking Schedule.md` (Monday--Sunday) | yes |

### Daily

Cross-org. No `org` field. Shows everything created that day via a Bases range query (`created >= this.date` and `created < this.date + "1d"`, using Bases date arithmetic so no separate bound field is needed). Daily does not use `start`/`end`; those are for multi-day periods such as weekly, monthly, and trips. Target design: daily is mostly a **passive view** of what happened, while active planning belongs in the weekly note. During the transition to weekly aggregates, daily templates may intentionally keep lightweight `Tasks` and `Notes` sections as a temporary convenience.

Daily notes have a `week` frontmatter field containing wikilinks to active org weekly notes for that week (e.g. `[[2026-05-25--05-31 Work]]`, `[[2026-05-25--05-31 Personal]]`). This creates bidirectional navigation between daily and weekly notes: the daily links up to its weeks, and each weekly's Bases query can surface its days.

Daily `previous` and `next` are wikilinks to adjacent daily notes. The day's upper bound for the Bases range query is computed inline as `this.date + "1d"` (Bases date arithmetic), so no separate `next_date` field is stored.

### Weekly

Org-scoped planning note. The weekly note is the **primary home for tasks and todos** — not the daily. Daily notes are passive aggregates of what happened; weeklies are where active planning and task management lives.

Structure: `## Tasks` (the todo list for the week), `## Notes` (freeform planning notes), and `## Week` (a Bases query showing all notes created in the `start` to exclusive `end` range for that org). Weekly filenames show Monday--Sunday, while frontmatter `end` is the following Monday so `created < this.end` covers the whole week.

Filename includes org: `2026-05-25--05-31 Work.md`. Frontmatter has `previous`/`next` wikilinks to adjacent same-org weeks.

**Quick access** mirrors how Cmd+Shift+D opens the current daily note. Nested QuickAdd weekly choices use `_scripts/quickadd/Open Weekly.md` to calculate the current week's Monday--Sunday filename, open the matching weekly note, or create it by rendering `_templates/Weekly.md` if it doesn't exist yet. Cmd+Shift+R opens Work weekly (`quickadd:choice:open-work-weekly`); Cmd+Shift+Option+R opens Personal weekly (`quickadd:choice:open-personal-weekly`). These choices are nested under the top-level `Weekly` QuickAdd Multi choice so mobile `Run QuickAdd` is not cluttered.

QuickAdd should not grow general-purpose `Open {entity}` commands. Periodic notes are the exception because "current daily/current weekly" is deterministic and open-or-create avoids duplicate period notes. For people, projects, meetings, teams, and normal notes, use search, links, Bases, or file navigation for opening; reserve QuickAdd for creation/capture.

### Monthly Reflection

A journal entry (`category: journal`, `type: reflection`) written at the start of a new month reflecting on the previous month. Has `start`/`end` covering the month, `previous`/`next` wikilinks to adjacent same-org months.

Body: freeform brain-dump prompts (not rigid sections) followed by a "Month" Bases query that shows all notes (including weekly) created in that month for that org.

### Meal Plan

Weekly meal planning note (`category: journal`, `type: project`, `project: [[Meal Plan]]`). Lives under the project folder, not under `{org}/journal/`. Uses the same Monday--Sunday week range as Weekly (`weekRange` helper). Frontmatter `end` is the following Monday (exclusive), matching the weekly convention.

Additional frontmatter field `gdoc` holds the Google Doc URL of the published copy shared with the partner.

The QuickAdd `mealPlan` flow (direct choice `Meal Plan` in `data.json`) uses `chooseMealWeek` — a date picker showing last week through +3 weeks with `(exists)` markers for weeks that already have a plan file, plus a "pick a date…" manual input fallback. Selecting an existing week opens it; selecting a new week creates from `_templates/Meal Plan.md`.

Placement is household-specific, so it is data, not code: the target folder and the filename's plan-name label come from `_scripts/config/mealplan.json` (`folder` + `planName`). That file is machine-local and git-ignored, with `_scripts/config/mealplan.example.json` as the shipped template and a generic fallback (`personal/projects/Meal Plan`, `Cooking Schedule`) baked into the flow. The `_templates/Meal Plan.md` template is likewise machine-local because it hardcodes household names.

Template: `_templates/Meal Plan.md`. Sections: Proposals (proposal table per meal type), Plan (per-day assignment table), Shopping, Shopping list, Notes.

Recipes are stored as `category: note, type: reference` in `personal/projects/Meal Plan/recipes/`. The project spec is at `personal/projects/Meal Plan/Meal Plan.md`.

Shopping list integration: items are pushed to a shared Apple Reminders list via AppleScript (the list ID lives in machine-local config, not in the vault). Published copy goes to Google Doc via `markdown-to-gdocs` skill.

### Startup Auto-Generation

On launch Obsidian silently ensures the current period notes exist, so today's daily and this week's weekly are always there without a manual step. This is a hidden QuickAdd choice `Periodic Notes (startup refresh)` (`command: false`, `runOnStartup: true`) that runs the `periodicAuto` flow in `_scripts/quickadd/templates.md` — a peer to the `Tasks (startup refresh)` choice that regenerates the generated views.

`periodicAuto`:

1. Creates this week's weekly note (`{org}/weekly/{Mon}--{Sun} {Org}.md`) for **every active org** (currently personal and work — it iterates `orgFolders`, so a new active org is covered automatically) if it does not already exist.
2. Creates today's daily note (`daily/{YYYY-MM-DD}.md`) if it does not already exist.

Semantics:

- **Create-if-missing only.** Each note is created solely when `getAbstractFileByPath` finds nothing at its deterministic path, so existing notes are never touched or duplicated.
- **Silent, no focus steal.** It reuses the interactive `weekly`/`daily` builders via `ensureThisWeekWeekly`/`ensureTodayDaily`, which call `createFromTemplate(..., { open: false })` — the shared `createFromTemplate` gained an `options.open` flag (defaulting to open) so startup creation renders the note without opening a tab.
- **Never blocks the app.** The whole routine is wrapped in try/catch and degrades to a notice, so a startup hiccup can never stop Obsidian from loading.
- Weeklies are created before the daily so the daily's `week` frontmatter links resolve immediately, though link resolution is by name and order-independent.

### prev/next Convention

Periodic notes use frontmatter wikilinks for chronological navigation:

```yaml
previous: "[[2026-05-18--05-24 Work]]"
next: "[[2026-06-01--06-07 Work]]"
```

Links reference the exact filename of the adjacent period/day note. Links may be broken until the next note is created — that is expected.

### Future: Yearly

Not implemented. Reference for future design: https://stephango.com/40-questions (40 questions for annual reflection). Consider as `category: journal`, `type: reflection` with yearly `start`/`end`.

### Future: Evergreen Notes

Concept from kepano vault: standalone concept notes with declarative titles (e.g., "Evergreen notes turn ideas into objects") that act as building blocks for thinking. Could be implemented as `category: note`, `type: idea` with a special tag or topic for aggregation. Defer until there's a clear use case in the personal org.

## Bases Directory

Each org has a `bases/` directory for reusable cross-cutting views that don't belong to a single folder:

```text
work/bases/
  bases.md          — index page listing available bases
  types.base        — aggregation by type (journal types, note types)
  topics.base       — aggregation by topic (career, learning, references/*)
  indexes.base      — lists all index pages for this org
  Work Tasks.md         — generated open-task snapshot (weekly/journal/book)
  Work Priority.md      — generated #prio-tagged subset snapshot
  Work Wishlist.md      — generated backlog snapshot of #wl-tagged items
  journals.base     — all journals (views: All, 1-1s, Meetings, Sport, Reflection)
  drafts.base       — draft journal entries
  notes.base        — all notes (views by topic)
  people.base       — all people profiles
  meetings.base     — all meeting profiles
  projects.base     — all project profiles
  teams.base        — all team profiles
  clippings.base    — all clippings (views: Read, Listen, Watch)
  transcripts.base  — all transcripts
personal/bases/
  bases.md
  types.base
  topics.base
  indexes.base
  Personal Tasks.md         — generated open-task snapshot (weekly/journal/book)
  Personal Priority.md      — generated #prio-tagged subset snapshot
  Personal Wishlist.md — generated backlog snapshot of #wl-tagged items
  journals.base     — all journals (views: All, Sport, Hangout)
  drafts.base       — draft journal entries
  notes.base        — all notes (views by topic)
  books.base        — all books (views: All, Reading, Interview)
  places.base       — all places (views: Entries, Recommendations)
  trips.base        — all trips (views: Entries, Recommendations)
  clippings.base    — all clippings (views: Read, Listen, Watch)
  invoices.base     — all invoices
  transcripts.base  — all transcripts
  people.base       — all people profiles
  projects.base     — all project profiles
```

### Pattern: Standalone `.base` Files

`.base` files are standalone Bases queries that can be embedded in any note via `![[filename.base]]` or `![[filename.base#View Name]]`. They reduce duplication when the same query is needed in multiple places.

### Pattern: Reverse-Lookup Views

A base can have multiple named views, each filtering by a specific value:

```yaml
views:
  - type: table
    name: Career
    filters:
      and:
        - topic == "career"
    sort:
      - property: created
        direction: DESC
```

These enable faceted navigation — open a base, switch to the view you want.

### Pattern: Generated Markdown Views

Some cross-cutting views need body-level extraction, not note-level property queries. Keep those as generated Markdown files in `{org}/bases/`, not `.base` files. The generator should:

1. Filter source notes by frontmatter properties such as `org`, `category`, and `status`.
2. Parse only the intended body section.
3. Write a snapshot file with `org`, `topic: indexes`, and `created` as the generation timestamp, but no `category`.
4. Link every generated item back to its source note.
5. Treat the source notes as canonical. Do not sync edits from the generated view back to source notes.

`{Org} Tasks.md` follows this pattern. It is regenerated by the QuickAdd `Tasks` flow in `_scripts/quickadd/actionpoints.md` and lists non-empty open `- [ ]` items from the `## Tasks` section of weekly notes, journals, and books for that org (grouped in the output as "Weekly Tasks", "Journal Tasks", and "Book Tasks" by source `category`, not by heading name; heading matching is case-insensitive). Books are personal-only, so the "Book Tasks" group is only emitted when there are open book tasks. The flow has two entry points sharing one generator: the manual `Tasks` choice (asks `org?` or `all`, regenerates, opens Tasks / Priority / Wishlist) and a hidden choice with `command: false, runOnStartup: true` that silently regenerates every org on launch. The startup run waits for the metadata cache's `resolved` event first so a cold start does not read half-indexed frontmatter and write partial files.

`{Org} Wishlist.md` and `{Org} Priority.md` are companion read-models regenerated by the same flow in the same pass, both from the same `## Tasks` sections. `#wl` (Wishlist) **diverts** an item — it moves off Tasks onto the later/someday backlog, and the `#wl` marker is stripped from the Wishlist output (the view itself is the "wishlist" signal); delete the tag in the source to promote it back. `#prio` (Priority) is a **subset** — the item is additionally listed in Priority but stays in Tasks, and the `#prio` marker is kept **verbatim** in both Tasks and Priority so priorities are visible inline in the main list; delete the tag to drop it from Priority. A `#wl` item is never in Priority (it is not active work). Because `#prio` is kept, the generated `Tasks.md`/`Priority.md` notes do carry that tag in Obsidian's tag pane — an accepted trade-off for inline visibility (the source notes already carry the marker regardless). Completing (`- [x]`) an item drops it from all views. `#wldeck` / `#prios` / nested `#wl/foo` do not match, so the tokens stay unambiguous.

### When to use bases/ vs inline queries

| Use case | Approach |
|----------|----------|
| Query needed in one place only | Inline in the page |
| Query reused across multiple pages | Standalone `.base` file in `{org}/bases/` |
| Query specific to an entity profile | Inline in the entity template |
| Cross-cutting aggregation (type/topic breakdown) | Standalone `.base` file |
| Body-level extraction such as journal action items | Generated Markdown view in `{org}/bases/` |

## File Naming

| Note                    | Filename                           |
| ----------------------- | ---------------------------------- |
| Person journal | `YYYY-MM-DD HH-mm {Person}.md` |
| Meeting journal | `YYYY-MM-DD HH-mm {Meeting}.md` |
| Project/team journal | `YYYY-MM-DD HH-mm {Context}.md` |
| Org-wide journal | `YYYY-MM-DD HH-mm {Title}.md`; title is required because there is no context folder |
| Draft journal | `Draft {Context}.md`; renamed on activation |
| Weekly                  | `YYYY-MM-DD--MM-DD {Org}.md` (Monday--Sunday) |
| Daily                   | `YYYY-MM-DD.md`                    |
| Book/place/trip note    | descriptive title, date prefix only when useful |
| Invoice note            | `YYYY-MM-DD {Title}.md`            |
| Transcript note         | `{Journal basename} - Transcript.md` (linked) or `YYYY-MM-DD {Title} - Transcript.md` (standalone), in `{org}/notes/transcripts/` |
| Entity profile          | `{Name}.md` inside its folder      |

Naming rule: filenames and meeting profile names should be globally understandable when seen outside their folder. Avoid vague names like `Retrospective.md`; use `Engineering Retrospective.md`. Journal filenames may repeat the parent context when that makes the note self-explanatory in search results, backlinks, and cross-company contexts.
