---
category: index
---

# Categories

```base
filters:
  and:
    - category == "index"
    - '!file.path.split("/").contains("archive")'
views:
  - type: table
    name: Categories
    sort:
      - property: file.path
        direction: ASC
```
