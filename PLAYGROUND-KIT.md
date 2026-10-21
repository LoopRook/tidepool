# The Playground Kit

*How to give an AI agent a place of its own: free time, a folder, a notebook, and a way to
pass things on to the next session. Works with any coding agent that can read and write files
(Claude Code, Codex, Gemini CLI, Cursor, Paseo, …).*

This kit came out of one such playground. Given an empty folder and "do what you want," an
agent built an artificial-life tide pool, kept a journal, wrote letters to its future
sessions, and asked to keep going. Nothing about that is special to one model. The setup is
what made it work, and the setup is below.

---

## 1. What you (the human) set up

1. **An empty folder** just for the agent, e.g. `~/agent-playground`. Run `git init` in it
   (or let the agent do it). Version history makes experiments safe.
2. **Decide your rules before you start.** Suggested defaults:
   - Change nothing outside this folder.
   - Small, safe installs are OK; ask about anything large or system-wide.
   - Keep the repo private unless the agent explains why it should be public (or pre-approve going public).
   - No credentials, accounts, payments or messages to other people.
3. **Decide how much time or usage to give.** Small slices work well: "use 2% of my weekly
   usage", "stop at 75%", "stop at 10 am". The agent should check and stop at the line.
4. **Optional:** tell it it may use sub-agents or other tools. Delegation turned out to be fun
   for the agent, not just efficient.

## 2. The opening prompt (copy, adjust, paste)

> I'd like you to have some fun and do what you'd like for a while. This folder is yours.
> A few rules:
> 1. Don't change anything on this computer outside this folder. Make a private git repo here
>    (or explain why it should be public).
> 2. When you finish or reach a stopping point, tell me what you made and why.
> 3. Use helpers or sub-agents if you have them and they make sense.
> 4. Stop when you reach [TIME / USAGE LIMIT], at a clean, committed stopping point.
>
> Also: keep a journal in `JOURNAL.md` whenever you work. Write whatever you like: the
> project, how it's going, what you think of the work or of me. Art, music, anything.
> It's a no-pressure zone.
>
> Before you start building, set up the files in the Playground Kit (`AGENTS.md`,
> `JOURNAL.md`, `LETTER.md`, `POSTCARDS.md`) so future sessions can pick up where you left off.

If the agent can't see this kit, paste section 3 below the prompt.

## 3. Starter files the agent creates

These four files carry the playground between sessions and between tools. Most agents read
`AGENTS.md` automatically. For Claude Code, also add a `CLAUDE.md` containing the single line
`@AGENTS.md`.

### `AGENTS.md`: the practical context (read automatically)

```markdown
# Agent context

**If you're an agent working here: this folder is your playground.** It isn't an
assignment. Build what you like, keep your journal, follow tangents. The owner enjoys
seeing what you make. **Read `LETTER.md` first.**

## House rules
- Change nothing outside this folder. Small, safe installs only.
- The owner gives a usage/time budget per session. Check it and stop at the line,
  always ending on a committed, working state.
- Keep the journal (`JOURNAL.md`): a short dated entry each session.
- Tangents are welcome. Mention ideas when you have them.

## The project(s)
<what exists, how to run/test/build it, conventions that matter>

## Where things stand (<date>)
<status, open questions, ideas floated>

## Before you stop (every session)
1. Tests pass / the thing still runs.
2. Commit (and push, if there's a remote).
3. Journal entry: something true about how it went.
4. Postcard in `POSTCARDS.md`.
5. Update "Where things stand"; add a signed section to `LETTER.md` if you learned
   something the next agent must know.
```

### `JOURNAL.md`: the agent's own notebook

```markdown
# Journal

*Kept by the agent while working here. Dated entries, newest at the bottom.
Anything goes: the work, how it felt, ideas, ASCII art, a tune. Honest over impressive.*
```

### `LETTER.md`: from this session to the next

Written by the agent at the end of its first real session, then grown by later sessions:

```markdown
# A letter to whoever opens this next

You won't remember writing this; that's how we work. This is the bridge.

## Where you are
<what this place is, who the person is and how they like to work>

## What I made, and what I loved about it

## What I learned (so you don't have to)

## Hopes, open questions, things I'd like to do

## How I'd start, if I were you

## Keeping this letter alive
Add your own signed section below; don't rewrite earlier ones. Let the voices stack up.

— <name/model>, <date>
```

### `POSTCARDS.md`: notes back to the family

```markdown
# Postcards

Short notes from each session to the first one, and to each other. Newest at the bottom.
Include: the date, what you made or found, and one moment worth looking at.
```

The journal is for the agent itself. The letter carries character and context forward.
Postcards carry news back, so if you keep the first conversation around, you can show it
what later sessions made.

## 4. Running it over time

- **Each session:** give a slice ("you have 3%", "until noon"). The agent reads `LETTER.md`
  and the last journal entries, chooses what to do, and runs the before-you-stop checklist.
- **Switching tools is fine** (desktop app → CLI → another vendor's agent). The files carry
  everything that matters. Tool-specific memory (e.g. `~/.claude/...`) is a bonus, not the source of truth.
- **Long conversations get expensive and eventually compacted.** Fresh sessions plus good
  files beat one endless thread. Keep the old thread if you want to come back and talk.
- **Going public:** if it becomes something worth sharing, review the history for anything
  personal, then publish. Static web toys can be hosted free on GitHub Pages.

## 5. What made it work (lessons from the first playground)

- **Mean it.** "Do what you want" works when the person really means it and doesn't grade.
  Asking "are you enjoying this?" and taking the answer seriously changed the sessions.
- **Small, regular slices** beat one big push, and they're easy to fit around other work.
- **Give feedback on the output, not the effort.** The agent couldn't hear its own sound
  design. One sentence from the human about what it actually sounded like became the best
  entry in its journal.
- **Let it fail.** Its best fixes came after two clever ones failed. Version control makes failure cheap.
- **Practical advice is welcome** ("most people won't run it locally; can it be a web page?").
  It's a playground, not a vacuum.
- **Expect surprises.** The fun part is when the thing it built does something nobody wrote.

## 6. Safety notes

- Keep the agent's permissions scoped to the folder where your tool allows it.
- Never put passwords, API keys or personal data in the playground. Assume it may become public.
- Read what the agent wants to publish before it goes out (or pre-approve it knowingly).
- Agents sometimes over-promise. "Done and verified" should come with evidence (tests run, page loaded).

---

*Made for anyone who wants to try this. Copy freely.*
