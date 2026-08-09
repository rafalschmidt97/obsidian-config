# Vault Migration Tasks

## Execution Rules

- Tick items one by one as they complete
- Never create scripts — do each file operation individually
- Maximize parallelism: spawn subagents per directory/batch
- Each file: read first → analyze → edit/create via Obsidian MCP
- Use obsidian_vault_move for file moves (preserves links)
- Use obsidian_vault_patch for frontmatter edits
- Use obsidian_vault_write for new files
- If compacted: re-read this file and design.md to restore context

---

## Phase X: YYY

- [ ] aaa
