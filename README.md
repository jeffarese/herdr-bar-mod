# herdr-bar-mod

[![CI](https://github.com/jeffarese/herdr-bar-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/jeffarese/herdr-bar-mod/actions/workflows/ci.yml)

A mod for the [Herdr](https://herdr.dev) desktop app: a quick switcher for your agents, tabs,
panes and spaces, on this computer and on every connected machine. Press a key, type a few
letters of a task, a branch, a folder or a machine, and Enter takes you there.

It is the desktop-app counterpart of [herdr-bar](https://github.com/jeffarese/herdr-bar), the
Cmd+K command bar for the Herdr TUI. The two share no code: the app has its own extension
system, and this is written for it.

This is an unofficial mod. It is not affiliated with Herdr.

## What it does

- **One row per agent**, not per tab, with its program icon, what it is working on, its space,
  tab, branch, folder and machine.
- **Live status.** A turning ring for working, a red "Needs you", a green "Done", a grey ring
  for idle. The list updates while it is open.
- **Filters.** Chips for All, Needs you, Working, Done, Idle, Tabs, Panes and Spaces, with a
  live count on each status. Tab and Shift+Tab move between them.
- **Fuzzy search** over the title, tab, space, branch, program, machine, folder, status and
  terminal address. Every word must match somewhere; the matched letters of the title are
  highlighted.
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

| Key | Does |
| --- | --- |
| Type | Search |
| ↑ ↓, Ctrl+P Ctrl+N, Ctrl+K Ctrl+J | Move the selection |
| Page Up, Page Down | Move a screenful |
| Enter, or a click | Go to the row |
| Tab, Shift+Tab | Next list, previous list |
| Ctrl+D, twice | Close the row's tab, pane or space, or end a sub-agent |
| Esc | Leave |

## What it runs and reads

The mod reads the app's live lists of agents, panes, spaces and terminals. For the preview it
runs `hc read <terminal>`, which prints that terminal's screen. It makes no network requests
and reads no files. It keeps two values in the app's shared state: `bar.recent` (the rows you
visited, latest first) and `bar.view` (the list you last had open). It reads `space.colors`,
which the shipped mods keep, and never writes it.

## Development

```sh
npm test                      # the row and search logic, with node --test
herdr-app check mods/bar      # loads the mod and renders it once
./install.sh                  # copies it into the running app, which reloads it
```

`mods/bar/rows.js` and `mods/bar/fuzzy.js` hold the logic and import nothing from the app, so
they run under Node. `mods/bar/main.js` is the view. [RECIPE.md](RECIPE.md) describes the mod
in enough detail to build it from scratch.

The icons in `mods/bar` come from [Lucide](https://lucide.dev) (ISC license), some by way of
the Herdr app's shipped mods.

## License

MIT
