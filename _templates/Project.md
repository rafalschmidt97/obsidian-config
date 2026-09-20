---
org: {{org}}
category: project
created: {{created}}
status: active
{{parentLine}}
{{relationshipLines}}
---

## Goal



## Links

- 

## Tasks

- [ ] 

## Projects

```base
filters:
  and:
    - category == "project"
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
    - parent == this
views:
  - type: table
    name: Projects
    sort:
      - property: created
        direction: DESC
```

## Journal

```base
filters:
  and:
    - category == "journal"
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
    - project == this
views:
  - type: table
    name: Entries
    sort:
      - property: created
        direction: DESC
```

## Notes

```base
filters:
  and:
    - category == "note"
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
    - project == this
views:
  - type: table
    name: Notes
    sort:
      - property: created
        direction: DESC
```
