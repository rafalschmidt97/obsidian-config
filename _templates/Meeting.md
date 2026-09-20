---
org: {{org}}
category: meeting
created: {{created}}
attendees: []
{{contextLine}}
---

## About



## Journal

```base
filters:
  and:
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
    - category == "journal"
    - meeting == this
views:
  - type: table
    name: Entries
    sort:
      - property: created
        direction: DESC
```
