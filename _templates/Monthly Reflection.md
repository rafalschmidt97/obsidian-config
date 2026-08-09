---
org: {{org}}
category: journal
type: reflection
created: {{created}}
start: {{start}}
end: {{end}}
previous: "[[{{previous}}]]"
next: "[[{{next}}]]"
---

## Notes

What went well this month? What didn't go well and why? What would I like to improve or change? What am I grateful for? What was the best day of the month and why? What were my favourite things — conversations, meals, books, places? What would I like to focus on next month? Any goals I want to carry forward or drop?



## Month

```base
filters:
  and:
    - category != "daily"
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
