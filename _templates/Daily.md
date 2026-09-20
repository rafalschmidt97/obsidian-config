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
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
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
    - '!file.path.split("/").contains("archive")'
    - status != "archived"
    - status != "obsolete"
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
