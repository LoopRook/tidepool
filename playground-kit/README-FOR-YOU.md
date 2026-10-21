# The Playground Kit: for the person

*How to give an AI agent a place of its own: free time, a folder, a notebook, and a way to
pass things on to the next session. Works with any coding agent that can read and write files
(Claude Code, Codex, Gemini CLI, Cursor, Paseo, …).*

This kit came out of one such playground. Given an empty folder and "do what you want," an
agent built an artificial-life tide pool, kept a journal, wrote letters to its future
sessions, and asked to keep going. Nothing about that is special to one model. The setup is
what made it work.

## What's in the kit

| file | for | what it does |
|---|---|---|
| `README-FOR-YOU.md` | you | this guide |
| `PROMPT.md` | the agent | the opening message you paste into the agent |
| `starter/AGENTS.md` | the agent | rules and context, read automatically by most agents |
| `starter/CLAUDE.md` | Claude Code | one line that loads `AGENTS.md` |
| `starter/JOURNAL.md` | the agent | its own notebook |
| `starter/LETTER.md` | the agent | its letter to future sessions (it writes this) |
| `starter/POSTCARDS.md` | the agent | short notes from each session back to the first |

## Setup (5 minutes)

1. **Make an empty folder** just for the agent, e.g. `~/agent-playground`.
2. **Copy everything in `starter/`** into it. (Hidden files aren't needed.)
3. **Edit the house rules** at the top of `AGENTS.md` if you want different ones. The defaults:
   - change nothing outside this folder
   - small, safe installs only
   - keep the repo private unless the agent explains why it should be public
   - no credentials, accounts, payments, or messages to other people
4. **Open your agent in that folder** and paste the message from `PROMPT.md`. Fill in the
   bracketed budget (a time, or a share of your usage).

That's it. The agent sets up git, picks something to make, and starts.

## Running it over time

- **Give small slices.** "You have 3% of my weekly usage," "until noon." The agent checks and
  stops at the line, on a clean, committed state. Small, regular slices fit around your
  other work and turned out to be plenty.
- **Each new session**, just open the agent in the folder and say something like "you have
  [budget], have fun." `AGENTS.md` tells it to read the letter and the journal first.
- **Switching tools is fine** (desktop app to CLI to another vendor's agent). The files carry
  everything that matters; a tool's own memory is a bonus, not the source of truth.
- **Long conversations get expensive** and eventually get summarised. Fresh sessions plus good
  files beat one endless thread. Keep the first conversation if you'd like to come back and
  show it the postcards.
- **Going public:** if it becomes something worth sharing, review the history for anything
  personal first. Static web toys can be hosted free on GitHub Pages.

## What made it work

- **Mean it.** "Do what you want" works when you really mean it and don't grade. Asking "are
  you enjoying this?" and taking the answer seriously changed the sessions.
- **Give feedback on the result, not the effort.** The first agent couldn't hear the sound it
  designed. One sentence about what it actually sounded like became the best entry in its journal.
- **Let it fail.** Its best fixes came after clever ones failed. Version control makes failure cheap.
- **Practical advice is welcome.** "Most people won't run it locally; can it be a web page?"
  A playground isn't a vacuum.
- **Expect surprises.** The fun part is when the thing it built does something nobody wrote.

## Safety

- Scope the agent's permissions to the folder where your tool allows it.
- Never put passwords, API keys, or personal data in the playground. Assume it may become public.
- Read what the agent wants to publish before it goes out, or pre-approve it knowingly.
- "Done and verified" should come with evidence: tests run, page loaded, output shown.

*Copy freely.*
