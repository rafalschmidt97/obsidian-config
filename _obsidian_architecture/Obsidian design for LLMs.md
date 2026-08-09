
Source of truth: `_obsidian_architecture/Obsidian design.md` (vault-relative).
## Agent Checklist

Before changing vault architecture, templates, scripts, or config:

1. Read `Obsidian design.md` for the authoritative rule.
2. Read the relevant template in `_templates/`.
3. Read the relevant script in `_scripts/`.
4. Read the relevant config under `.obsidian/`, but avoid local REST API data unless explicitly required.
5. Make the smallest correct change.
6. Keep QuickAdd scripts as `.md` raw JavaScript.
7. Keep Templater folder templates disabled.
8. Do not add `tags` to new target-schema content.
9. Do not make Bases depend on paths when a property query can model the relationship.
10. Do not edit generated action-point views as canonical data.
11. Do not enable Custom Sort or migration-only plugins unless the source design changes.
12. If you change behavior, update both `Obsidian design.md` and this LLM summary if needed.
