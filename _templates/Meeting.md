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
    - category == "journal"
    - meeting == this
views:
  - type: table
    name: Entries
    sort:
      - property: created
        direction: DESC
```
