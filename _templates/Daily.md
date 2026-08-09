---
category: daily
date: {{date}}
previous: "[[{{previous}}]]"
next: "[[{{next}}]]"
week:
{{weekLines}}
---
## Journals

```base
filters:
  and:
    - category == "journal"
    - created >= this.date
    - created < this.date + "1d"
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


## Today

```base
filters:
  and:
    - category != "daily"
    - category != "weekly"
    - category != "journal"
    - created >= this.date
    - created < this.date + "1d"
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
