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
    - category == "journal"
    - attendees.contains(this)
views:
  - type: table
    name: Entries
    sort:
      - property: created
        direction: DESC
```
