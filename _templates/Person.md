---
org: {{org}}
category: person
created: {{created}}
role: 
---
{{detailsBlock}}
## Mission & Context



## Personality & Communication Style

## Journal

```base
filters:
  and:
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
    - category == "journal"
    - attendees.contains(this)
views:
  - type: table
    name: Entries
    sort:
      - property: created
        direction: DESC
```
