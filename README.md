# cc-timestamps

A Claude Code mod that puts a timestamp on every prompt, reply and tool call in the transcript, plus the time elapsed since the previous row. Slow steps become obvious at a glance.

```
14:32:07         > fix the failing parser test
14:32:09 +2s     ⏺ Let me look at the parser first.
14:32:10 +1s     ⏺ Read(src/parse.ts)
14:32:11 +1s     ⏺ Bash(npm test -- parse)
14:32:42 +31s    ⏺ The test fails because the tokenizer drops trailing
                   whitespace. Fixing that in `tokenize()`.
14:32:44 +2s     ⏺ Update(src/parse.ts)
14:33:19 +35s    ⏺ Bash(npm test)
14:35:03 +1m44s  ⏺ All 212 tests pass.
```

The stamp sits in a dim 16 column gutter to the left of each row; everything else draws exactly as before.

## Install

At the prompt of a Claude Code session:

```
/plugin install timestamps --marketplace katosh/cc-timestamps
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). From a shell instead:

```bash
claude plugin install timestamps --marketplace katosh/cc-timestamps
```

Requires a Claude Code build with mod support (2.1.303 or newer; check with `claude --version`).

## What gets stamped

| Row | Stamped |
| --- | --- |
| Your prompts | yes |
| Claude's replies | yes, each text block |
| Tool calls (`Bash`, `Read`, `Edit`, MCP tools, ...) | yes |
| Grouped tool calls, subagent progress, slash command output | not yet |

Elapsed time reads `+12s`, `+3m05s` or `+1h02m`. Times are local.

## How it works and its limits

Claude Code's transcript rows carry no time of their own, so the mod records the moment a row is first drawn during a live turn (between submitting a prompt and a few seconds after the turn completes). That is within about a second of the real event.

Consequences worth knowing:

- **Rows from before the mod loaded, or from a resumed session, stay unstamped.** The mod prefers no stamp over a wrong one, so redrawn history (`--resume`, `ctrl+o`, a reload) keeps its original look.
- **Stamps live in memory.** Restarting Claude Code clears them; rows drawn after the restart are stamped again.
- **The gutter costs 16 columns,** which gets tight in narrow panes.

For exact historical times, every message is also stored with an ISO timestamp in `~/.claude/projects/<project>/<session>.jsonl`:

```bash
f=$(ls -t ~/.claude/projects/*/*.jsonl | head -1)
jq -r 'select(.timestamp) | "\(.timestamp)  \(.type)"' "$f"
```

## Development

```bash
git clone https://github.com/katosh/cc-timestamps && cd cc-timestamps
claude plugin validate .
claude plugin test .
claude --plugin-dir .        # a session with your working copy loaded
```

The whole mod is `hooks/register.tsx`; tests are in `tests/`.
