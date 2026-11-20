# herdr-bar-mod

[![CI](https://github.com/jeffarese/herdr-bar-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/jeffarese/herdr-bar-mod/actions/workflows/ci.yml)

A mod for the [Herdr](https://herdr.dev) desktop app: a quick switcher for your agents, tabs,
panes and spaces, on this computer and on every connected machine. Press a key, type a few
letters of a task, a branch, a folder or a machine, and Enter takes you there. It runs the
app's commands too, and does things to a row without going there: peek, rename, pin, settle,
close.

It is the desktop-app counterpart of [herdr-bar](https://github.com/jeffarese/herdr-bar), the
Cmd+K command bar for the Herdr TUI. The two share no code: the app has its own extension
system, and this is written for it.

[![The Herdr window with agents on a laptop and on a Mac Studio called studio. Command-K drops a panel from the top that lists every agent, tab and shell on both machines, one line each, with its space, machine, branch and status: one needs you and says what it asks, one is done, four are working. On the right, the selected agent's screen, with its question above it. The selection moves down the list and the screen follows it, to "review", a Codex sub-agent the webhook agent in api started; Command-period lists what can be done to it: peek, give it a tab, end it. Typing "on:studio" turns into a pill and leaves what runs on studio: two agents and their space. "is:working" leaves what is at work: four agents and studio's space. Typing "flaky" leaves one agent, "Fix the flaky checkout test", with those letters lit, and Enter goes to its tab, where Codex says what it changed. Behind the panel: the Sessions sidebar on the left, Claude Code at work under a pane header, pull requests, stats and what's running on the right, and two notifications in the corner; the "Finished" one leaves partway through. The sessions are made up.](docs/media/demo.gif)](docs/media/demo.mp4)

*Around it: the [Sessions sidebar](https://github.com/jeffarese/herdr-agents-sidebar) on the left, a pane header with the model and limits, [pull requests](https://github.com/jeffarese/herdr-prs) and [stats](https://github.com/jeffarese/herdr-stats-mod) on the right with what's running, and two notifications in the corner. Every session in it is made up.*

The film is the real mod in the real app, with real key presses, on the
[showcase stage](docs/demo/README.md). Click it for the 60 frames a second version.

This is an unofficial mod. It is not affiliated with Herdr.

## What it does

- **One line per agent**, not per tab: its program icon, what it is working on, then its
  space, tab, machine, branch and folder, and at the right how long it has run and its status.
  An agent that needs you says what it asks. Two lines a row is a setting away.
- **Live status.** A turning ring for working, a red "Needs you", a green "Done", a grey ring
  for idle. The list updates while it is open.
- **Lists.** Chips for All, Agents, Needs you, Working, Done, Idle, Tabs, Panes, Spaces and
  Commands, with a live count on each status. Tab and Shift+Tab move between them, and a sign
  typed first picks one: `@` agents, `!` needs you, `$` tabs, `%` panes, `#` spaces,
  `>` commands. Backspace on an empty search goes back to All.
- **Filters** anywhere in the search: `is:working`, `on:studio`, `in:api`, `app:codex`, and
  `-is:idle` to leave some out. Each shows as a pill in the search field; its × takes it out.
  `?` lists them all.
- **Fuzzy search** over the title, tab, space, branch, program, machine, folder, status, what a
  blocked agent asks and the terminal address. Every word must match somewhere, as letters in
  order that sit together or start words (`ftl` finds "Fix the login"). The matched letters are
  lit wherever the row shows them: the title, the space, the branch, the folder.
- **Commands.** Every app command that needs no argument, each theme and each layout, with its
  key, and a **Show:** or **Hide:** row for each panel in the layout you're on ("hide prs",
  "show team"). Hiding the last panel in a sidebar hides the sidebar too. `>` lists them; an All
  search shows the best few after the places it found.
- **Actions.** ⌘. (or a right-click) lists what can be done to the row: go, peek without
  leaving, rename its tab or space in place, pin, zoom, settle the tab, close it. The common
  ones have keys of their own.
- **Other machines.** Agents and tabs on machines connected through herdr-core are listed with
  the machine's name, and typing the name finds them.
- **Preview.** The right side shows the selected terminal's screen, read again every second
  and a half, so you can look before you go. For a space it lists the space's tabs.
- **Opens on what matters.** Agents that need you come first, then finished ones, then pinned
  ones, then what you visited most recently. The selection starts on the first row that is
  not where you already are, so opening the bar and pressing Enter works like alt-tab.
- **Running time** on every row: how long the agent has been working, or how long the
  terminal has been up.
- **Sub-agents.** Agents started by another agent with `hc run` are listed too. Enter peeks
  at one, since it has no pane.
- **Tidy up.** Ctrl+D on a row, twice, closes its tab (or pane, or space, or ends a sub-agent).
  Settled tabs, the ones you put away, sort last and say so.

## Install

Ask your agent, in a terminal inside Herdr:

> Add the Herdr mod at github.com/jeffarese/herdr-bar-mod

Or run the installer:

```sh
curl -fsSL https://raw.githubusercontent.com/jeffarese/herdr-bar-mod/main/install.sh | sh
```

It copies `mods/bar` into `~/.config/herdr-app/mods`. Run it again to update. From a clone,
`./install.sh` does the same, and `./install.sh --remove` takes the mod out.

Then bind a key. In `~/.config/herdr-app/keys.json`, under `global`:

```json
"cmd-k": "mod.open:bar"
```

On Linux and Windows, `ctrl-shift-k` is the shipped picker's key; pick another, or replace it.
Editing `keys.json` makes the whole file yours: Herdr then stops adding new default shortcuts
to it.

Tested with the Herdr app 0.1.15 and herdr-core 0.1.20.

## Keys

| Key (Mac) | Elsewhere | Does |
| --- | --- | --- |
| Type | | Search. `?` alone lists the signs and filters |
| ↑ ↓, ⌃P ⌃N, ⌃K ⌃J | Ctrl+P … | Move the selection |
| Page Up, Page Down | | Move a screenful |
| ↵, or a click | | Go to the row, or run the command |
| ⌘↵ | Ctrl+Enter | Peek at the row's terminal without leaving the tab you are in |
| ⌘. , → on an empty search, or a right-click | Ctrl+. | Actions for the row; ← goes back |
| ⌘R | Ctrl+R | Rename the row's tab or space in place. An empty name gives back the automatic one |
| ⌃D, twice | Ctrl+D | Close the row's tab, pane or space, or end a sub-agent |
| ⌘O | Ctrl+O | Hide or show the preview |
| Tab, Shift+Tab | | Next list, previous list |
| ⌃U | Ctrl+U | Clear the search and go back to the list the bar opened on |
| Backspace on an empty search | | Back to All |
| Esc | | Leave |

The bar's own keys avoid the ones Herdr binds for the whole window (⌘1–⌘9, ⌘P, ⌘D, ⌘W and the
rest): those still reach Herdr while the bar is open.

## Settings

Optional. Write `bar.json` in the app's home (`~/.config/herdr-app/bar.json`):

```json
{
  "density": "compact",
  "scope": "last",
  "select_current": false,
  "commands": true
}
```

| Key | Default | Means |
| --- | --- | --- |
| `density` | `"compact"` | `"compact"`: one line a row. `"comfortable"`: two, with the details on the second |
| `scope` | `"last"` | The list the bar opens on: `"last"` (the one you left it on), or `all`, `agents`, `blocked`, `working`, `done`, `idle`, `tabs`, `panes`, `spaces`, `commands` |
| `select_current` | `false` | `true` opens on the row you are in, instead of the one you came from |
| `commands` | `true` | `false` keeps commands out of All searches; `>` still lists them |

It is read each time the bar opens.

## What it runs and reads

The mod reads the app's live lists of agents, panes, spaces and terminals, its commands, key
bindings, themes and layouts, and the shown layout's tree (for the panel rows). For the preview
it runs `hc read <terminal>`, which prints that terminal's screen. It reads `bar.json` in the
app's home, if you wrote one, and the `mod.json` of each mod docked in the shown layout (for its
title), and makes no network requests. It runs app commands only when you ask: going somewhere,
a command row, an action, a rename or a close. It keeps five values in the app's shared state:
`bar.recent` (the rows you visited, latest first), `bar.view` (the list you last had open),
`bar.preview` (false once you hide the preview), `bar.config` (the last `bar.json` it read) and
`bar.modTitles` (the panel titles it read). It reads
`space.colors`, which the shipped mods keep, and never writes it.

## Development

```sh
npm test                        # the row and search logic, with node --test
herdr-app check mods/bar        # loads the mod and renders it once
./install.sh                    # copies it into the running app, which reloads it
sh docs/demo/showcase-shots.sh  # films the demo again, on the showcase stage
```

`mods/bar/rows.js` (the rows, their order and the list), `query.js` (the search language),
`commands.js` (command rows and key labels), `actions.js` (the actions menu) and `fuzzy.js`
hold the logic and import nothing from the app, so they run under Node. `mods/bar/main.js` is the view. [RECIPE.md](RECIPE.md) describes the mod
in enough detail to build it from scratch.

The icons in `mods/bar` come from [Lucide](https://lucide.dev) (ISC license), some by way of
the Herdr app's shipped mods.

## Works well with

The pictures above are one Herdr window with these mods running together:

- [Sessions sidebar](https://github.com/jeffarese/herdr-agents-sidebar): every agent and shell on all your machines in one sidebar, with sub-agents and background work.
- [Pull requests](https://github.com/jeffarese/herdr-prs): your pull requests and the state of their checks, in a sidebar.
- [Stats](https://github.com/jeffarese/herdr-stats-mod): CPU, memory, GPU, network and temperatures beside your terminals, and which agent is using them.
- [Mod hub](https://github.com/jeffarese/herdr-mod-hub): browse the gallery, read a mod's code before installing it, and manage your mods.
- [Outside](https://github.com/jeffarese/herdr-outside): the agents and terminals herdr-core runs outside your spaces.

## License

MIT
