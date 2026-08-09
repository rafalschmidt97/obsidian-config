---
org: {{org}}
category: weekly
created: {{created}}
start: {{start}}
end: {{end}}
previous: "[[{{previous}}]]"
next: "[[{{next}}]]"
---

## Tasks

- [ ] 

## Notes

- 

## Week

```base
filters:
  and:
    - category != "daily"
    - category != "weekly"
    - org == this.org
    - created >= this.start
    - created < this.end
views:
  - type: table
    name: Entries
    properties:
      - name: category
      - name: type
      - name: attendees
      - name: meeting
    sort:
      - property: created
        direction: ASC
```
