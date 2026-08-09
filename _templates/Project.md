---
org: {{org}}
category: project
created: {{created}}
status: active
{{parentLine}}
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
    - project == this
views:
  - type: table
    name: Notes
    sort:
      - property: created
        direction: DESC
```
