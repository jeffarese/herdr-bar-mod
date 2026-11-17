# Bar

A quick switcher that drops from the top of the window when its key is pressed. It lists every
agent, tab, pane and space on this computer and on every connected machine, with live status,
and the app's commands. The person types to search, narrows with a sign or filter words,
switches lists with Tab, sees the selected terminal's screen on the right, presses Enter to go
there, and opens a row's actions to peek, rename, pin, settle or close without going.

## What you see

One mod, `bar`, opened as a popup: 980 px wide, at the top of the window, 40 px down. Herdr
draws the frame. Inside, 14 px padding, 10 px between regions, on `popover`, top to bottom:

- **Search field**, 38 px, 10 px radius, 1 px `accent` border on `background`: a 15 px search
  icon in `dim`; when a sign picked the list, that list's name in `accent`, 11 px semibold; the
  input (13.5 px, placeholder "Search agents, tabs, spaces, branches, folders…   ? for help");
  a pill for each filter word (20 px, 6 px radius, `accent` at 13%, its words: `on studio`,
  `not idle`, `in api`; `raised` and `dim` while it has no value or `is:` doesn't know it, with
  a tooltip; a 14 px × that takes the word out of the search); and the count in `dim`, 11 px:
  `6`, `2 of 6` when the search narrows the places, `3 commands` when only commands matched,
  nothing for the cheat sheet.
  While a name is asked for (rename), the field holds a pill "Rename tab" or "Rename space"
  with the row's icon, an input with the current name (empty for a tab nobody named), and
  "empty: its automatic name" in `dim`.
- **Chips**, 24 px, 7 px radius, 11.5 px text, 5 px apart, a 1 × 14 px `border` rule between
  groups: All, Agents | Needs you, Working, Done, Idle | Tabs, Panes, Spaces | Commands. The four
  status chips lead with a 6 px dot in that status's theme color (`dim` at 40% when the count
  is 0) and end with the count of agents in that status. The chip of the list shown (the sign's
  when one is typed) has `foreground` text, semibold, an `accent` border at 40% and an `accent`
  fill at 13%; the others have `muted` text and a `border` border. A chip that has a sign says
  it in a tooltip ("Type @ to search agents").
- **Body**, 432 px tall, two columns 12 px apart:
  - **List**, left half. When the entries come from more than one group (places, then
    commands), each group starts with a 26 px heading in `dim`, 10.5 px semibold capitals:
    GO TO, COMMANDS. Rows are drawn by density:
    - **compact** (the default): 36 px, 7 px radius, 4 px from the edges, one line: a 20 px
      icon; the title (13 px; `foreground` and semibold when it is where the person is,
      `dim` when settled, else `muted`; `foreground` when selected) with its tags; then the
      details in 11 px, 9 px apart, cut at the right: the space (a 7 px square in its color and
      its name in `muted`), what a blocked agent asks in `blocked` (else the detail: the tab,
      `Tab 2` or its name, or what an agent in a named tab says it is doing), the machine with
      a server glyph in `accent`, the branch with a branch glyph, the folder (from `~` on this
      computer); at the right the running time in `dim` and the status mark.
    - **comfortable**: 48 px, 9 px radius, a 28 px icon, the title at 13.5 px with its tags on
      line one and the details on line two.
    The icon: the program's icon from the app's table, on its `tile` color when it has one,
    else on `raised`; a picture icon (`tint` false) drawn as is; a terminal glyph when the
    program has no icon; for a space, its color with its first letter in white; for a command,
    a command glyph (a layout glyph for a layout) on `raised`; for a theme, four of its colors
    (background, accent, working, blocked) in quarters; for a cheat sheet row, its sign in
    `accent`. Tags: a pin glyph when pinned; a small outlined word for rows that are not agents
    (`tab`, `pane`, `space`), for sub-agents (`sub-agent`), for settled tabs (`settled`) and for
    the theme or layout in use (`current`); `+N` when the agent has N sub-agents. A command row
    has its gist where the details go and its global key in a keycap where the time goes.
    Every matched letter, in the title and in each detail, is in `accent` semibold.
  - **Preview**, right half, 10 px radius, 1 px `border`, on `background`. A header on `surface`
    with an 18 px icon, the title in semibold, the machine in `accent`, the status word in its
    color, and under it `space · branch · folder` in `dim`. For a blocked agent that says what
    it asks, a band under the header: "Asks" in `blocked` semibold, the question in
    `foreground`, on `blocked` at 12%. Below, the terminal's screen in the terminal font at
    11 px, 15 px lines, in `muted`, bottom-aligned so the newest lines show. For a space, the
    list of its tabs. For a command, its whole description, its key, and "↵ runs it. The bar
    closes first, so it acts on the tab you are in."; for a theme, swatches of fourteen of its
    colors with their names. For the cheat sheet, the keys. Narrower than 760 px, or hidden with
    ⌘O, the preview is left out and the list takes the width.
  - **Actions**, in the preview's place while open: the same header with "Actions" under the
    title and a `←` keycap, then 32 px items, 7 px radius: the action's label, and its key in a
    keycap when it has one (`↵`, `⌘↵`, `⌘R`, `⌃D×2`). Close and End are in `blocked`, on
    `blocked` at 13% when selected. Narrow, the actions take the list's place.
- **Footer**, 11 px: on the left, keys in small outlined boxes with what they do, for what is
  selected: `↑↓ move`, `↵ go`, `⌘↵ peek` (rows with a terminal), `⌘. actions`, `tab next list`,
  `esc leave`; `↵ run` for a command; `↵ use it`, `⌃U clear` for the cheat sheet; `↑↓ choose`,
  `↵ do it`, `← back` in the actions; `↵ rename`, `esc leave` while renaming. On the right,
  `? search tips`, or for 2.6 s a note of what was just done ("Pinned.", "Renamed to “x”.") in
  `done`, or a problem in `blocked`. Keys are drawn the platform's way: `⌘⇧T` on a Mac,
  `Ctrl+Shift+T` elsewhere.

![Bar](preview.png)

## How it behaves

- **Statuses.** Working: a 13 px ring in `working`, turning once every 900 ms. Blocked: a pill
  "Needs you", `blocked` text on `blocked` at 15%. Done: the same pill, "Done", in `done`. Idle:
  an 8 px ring, 1.5 px, in `idle`. A program that reports no status has no mark. A status of
  `error` counts as blocked. A sub-agent that is done shows as idle: it reports to its parent.
- **Rows.** An agent row for every entry of `agents()`, and for every live terminal that one of
  them started, directly or through others, and that has no pane. A tab row for every tab, a
  pane row for every terminal pane, a space row for every space. A blocked agent's question is
  the `msg` (or `message`, `question`) of its terminal's status report, first line. A row is
  settled when its tab is (`tab.settle`).
- **Titles.** An agent alone in a tab somebody named goes by the tab's name. Otherwise it goes
  by its terminal title with the leading status glyph removed, unless that title only repeats
  the program, a path, a `user@host` or the terminal's address; then by the title it reports
  with its status; then by its program's name.
- **Lists.** All: agents, and tabs with no agent in them; once the person searches or filters,
  spaces too, and with a search of two letters or more the best four commands after the
  places (not while a filter is typed: commands have no status, space or machine). Agents:
  every agent. Needs you, Working, Done, Idle: agents in that status. Tabs: every tab. Panes:
  every terminal pane. Spaces: every space. Commands: every command row, in the app's order
  until the person types. The list last used is kept and opens again next time (see `scope`).
- **Search language.** A first character from `@ ! $ % # >` picks Agents, Needs you, Tabs,
  Panes, Spaces or Commands, whatever chip is chosen; a lone `?` lists the cheat sheet, whose
  rows put their sign or filter in the search field. Words `key:value` anywhere are filters,
  `-key:value` leaves those rows out: `is:` (needs, blocked, error, working, done, idle, pinned,
  sub, here, current, settled, remote, local, agent, tab, pane, space), `on:` (part of the
  machine's name; `local`, `here`, `this`: this computer), `in:` (part of the space's name),
  `app:` (part of the program's key or name). A value may be quoted to hold spaces. A word
  with a colon whose key is none of these is a search word.
- **Commands.** A row for every command `commands()` lists that needs no argument, except those
  that need a selection or context the bar never has (`space.select`, `tab.select`,
  `tab.unsettle`, `pane.focus`, `pane.swap`, `terminal.show`, `terminal.copy`,
  `terminal.paste`, `terminal.paste_image`, `overlay.close`) and the escape hatches
  (`app.reset`, `layout.reset`, `app.update`). `pane.split` is two rows (right, down),
  `terminal.scroll` two (top, bottom), `app.settings` four (all, look, alerts, updates). A
  known command has a name for people ("New tab"); one the app adds later reads "Tab: foo bar".
  The gist is the description up to the first ` (`, `.`, `:` or `;`. The key is the `global`
  binding whose action is the command, or `command:first argument`. Then a row per mod block in
  the shown layout (not `workspace-chrome`, `tabs` or floating ones): "Hide: Pull requests" when
  it shows, "Show: Pull requests" when it or a column around it is hidden or it is a stack's
  other child. Its title is the block's `title` prop, else its `mod.json` title, else the mod
  name; two blocks of one title add their `spot`, `block` or id. Hide hides the block, or the
  column or stack it is alone in, and any column that leaves empty, never one holding the tabs;
  Show shows each hidden node on the way down and selects it in its stack. The words "show",
  "hide", "open", "close", the mod name and the block id find it. Then a row per theme
  (`app.theme {name}`) and per layout (`layout.switch {name}`).
- **Order.** Without a search: blocked, then done, then settled last, then pinned, then most
  recently visited, then working before idle, then newest. With a search: best match first, the
  same order breaking ties; commands by match. "Visited" is where the person was each time the
  bar opened and each row they went to through it.
- **Selection.** Starts on the first place that is not where the person is (`select_current`:
  the first that is), the top row once they type. It stays on the same row while the list
  changes under it. The list scrolls so a group's first row shows with its heading.
- **Search.** Words separated by spaces; each must match, as letters in order, in the title,
  the detail, what a blocked agent asks, the space, the branch, the program, the machine, the
  folder as shown, the status word or the terminal address. Lowercase ignores case; a capital
  asks for it. The letters must sit together or start words: a match that averages under 22
  points a letter (16 for a letter, 12 more at a word start, 14 more next to the previous one,
  less for gaps) is not one. Each word lights its letters in every shown field it matches.
- **Keys.** Up, Down, Ctrl+P, Ctrl+N, Ctrl+K, Ctrl+J move, wrapping (in the actions while they
  are open). Page Up and Page Down move by a screenful. Enter goes (runs a command, does the
  selected action). Secondary+Enter peeks (Cmd on a Mac, Ctrl elsewhere, as for all the keys
  below). Secondary+. opens or closes the actions; so do Right on an empty search and Left (to
  close). Secondary+R renames. Secondary+O hides or shows the preview, remembered. Tab and
  Shift+Tab switch lists; with a sign typed, the sign goes and the list after its list is
  chosen. Ctrl+D arms a close: the row shows "⌃D again to close tab" in the blocked pill, and a
  second Ctrl+D does it; moving the selection disarms it. Ctrl+U clears the search and goes
  back to the list the bar opened on. Backspace on an empty search goes back to All, but not
  the press that emptied it. Esc belongs to Herdr: it closes the popup, whatever is open in it.
- **Enter and click.** Space: `space.select`. Tab: `tab.select`. Agent or pane: `pane.focus`
  with its pane. Sub-agent: `terminal.peek`. Command: the command with its arguments. The bar
  closes first. A right-click selects the row and opens its actions.
- **Actions.** Agent: Go, Peek without leaving, Rename tab, Pin to the top / Unpin
  (`terminal.pin`), Zoom pane, Settle tab / Bring the tab back (`tab.settle`, `tab.unsettle`),
  Close tab. Tab: Go, Peek, Rename tab, Settle, Close tab. Pane: Go, Peek, Rename tab, Zoom,
  Settle, Close pane. Sub-agent: Peek, Give it a tab (`terminal.keep`), End agent. Space: Show,
  New tab in this space (`tab.new {space}`), Rename space, Close space. Going, peeking, zooming
  and opening close the bar; pinning and settling leave it open with a note. Close asks twice:
  the item reads "Press again to close tab".
- **Rename.** In place, in the search field. Enter runs `tab.rename {id, name}` or
  `space.rename {id, name}`; an empty name gives the automatic name back.
- **Close.** Space: `space.close`. Pane: `pane.close`. Sub-agent: `terminal.kill`. Agent or
  tab: `tab.close`. Space and tab closes pass `confirmed: true`. The bar stays open.
- **Preview.** Read 90 ms after the selection rests on a row, and again every 1500 ms. The
  wheel scrolls the list and the selection follows it.
- **Settings.** `bar.json` in the app's home, read each time the bar opens and kept in shared
  `bar.config` so the next open starts with it: `density` ("compact" or "comfortable"), `scope`
  ("last" or a list's id), `select_current` (boolean), `commands` (boolean). Invalid JSON is
  reported in the footer and the defaults are used.

## Built from

- `mods/bar/mod.json`: `{ "place": "none", "title": "Bar", "overlay": { "kind": "popup", "at":
  "top", "offset": 40, "width": 980, "height": 0.9 } }`. Opened with `mod.open {name: "bar"}`.
- `mods/bar/main.js`: the view. From `herdr`: `agents`, `panes`, `spaces`, `terminals`,
  `commands`, `keys`, `themes`, `layouts`, `run`, `hc`, `home`, `appHome`, `theme`, `settings`,
  `props`, `closeOverlay`, `shared`, `setShared`, `readTextFile`, `window`. From `gpui-base`:
  `InputState`, `Input`, `v_flex`, `h_flex`.
- `mods/bar/rows.js`: `VIEWS`, `build` (the rows), `inView`, `search`, `order`, `compose` (the
  list: places, commands or the cheat sheet, each tagged with its group), `firstPick`,
  `visit`, `counts`, `duration`, `shortPath`, `HELP`.
- `mods/bar/query.js`: `parse` (sign, filters, search words), `filter`, `passes`, `without`,
  `pill`.
- `mods/bar/commands.js`: `commandRows`, `keyLabel`, `humanize`, `gist`.
- `mods/bar/actions.js`: `actionsFor`, `run` (an action as an app command), `leaves`.
- `mods/bar/fuzzy.js`: `match(term, text)` returns `{ score, positions }` or null, by dynamic
  programming over the two strings; `segments` splits a text into matched and unmatched runs.
  None of these five import anything from the app.
- Programs: `hc read <address>` for the preview, through `hc()`.
- Shared state: `bar.recent` (row keys, latest first, at most 60), `bar.view`, `bar.preview`,
  `bar.config`. Reads `space.colors` and `layout`.
- Art: `spinner.svg`, `search.svg`, `branch.svg`, `machine.svg`, `pin.svg`, `terminal.svg`,
  `command.svg`, `layout.svg`, Lucide outlines drawn with `svg()` so they take the text color.
- `keys.json`: `"cmd-k": "mod.open:bar"` under `global`.

## Watch out

- `flex_shrink` takes a number. `flex_shrink()` fails the render with "expected a number, got
  nil", and `herdr-app check` does not catch it because rows are not drawn with empty data.
- Text has no styled runs. A highlighted text is a row of `div`s, one per run; spaces at the
  edge of a run are written as non-breaking spaces so they are not dropped.
- The list draws only the entries and headings in view, each `absolute` at its own top minus
  the scroll, inside a `relative` box with `overflow_hidden`. Headings make the tops uneven, so
  they are summed once per render. Sizes from `on_size_change` are divided by `settings().zoom`.
- The popup takes the keyboard a moment after it opens: focus the input in `init` and again
  300 ms later. Keys are handled on the root's `on_key_down`; they reach it from the input.
  Enter does not: it is the input's `submit`, whose event says whether Cmd (`secondary`) was
  held.
- Esc never reaches the bar: Herdr closes the popup first. Anything that would want Esc to step
  back (the actions, a rename) needs another key: Left, or a second press of its own key.
- Herdr's `global` keys win over the bar while it is open: ⌘1–⌘9, ⌘P, ⌘D, ⌘W, ⌘N, ⌘T and
  ⌘⇧P are taken by default. Pick the bar's keys around them.
- A preview read can finish after the selection has moved on. Each read carries a counter and
  only the latest is kept. The view re-renders only when the text changed.
- Remote ids carry a `machine/` prefix; `hc read studio/t7` reads that machine's terminal.
- A remote shell's pane title is its own address. Treat it as saying nothing.
- A mod cannot draw a live terminal inside its own view, so the preview is text without color.
- A popup in a window that is not in front draws no new frame until it gets input, so
  `herdr-app shot` right after `mod.open` can show the frame from before.
- With more than a few hundred rows the search runs on every keystroke over all of them; it
  was built for tens.

## Done when

- `npm test` passes and `herdr-app check mods/bar` prints `check passed`.
- `herdr-app do mod.open --name bar` drops the bar from the top; running it again closes it.
- With an agent working in another tab, its row shows a turning ring and a running time.
- An agent that needs you shows what it asks, in its row and over its preview.
- Typing part of a title leaves the matching rows, with the matched letters in the accent color.
- Typing `on:studio` shows a pill "on studio" and leaves what runs there; its × takes it out.
- `@` turns the Agents chip on; Tab then moves to Needs you and the `@` is gone.
- `>` lists the commands with their keys; Enter on Zoom in makes everything bigger.
- ⌘. on an agent lists its actions; Pin to the top puts a pin on the row and says "Pinned.".
- ⌘R on a tab asks for its name in the search field; Enter renames it.
- Tab moves the chosen chip one to the right, and the list changes to that kind.
- Selecting an agent on another machine shows that machine's name and its screen in the preview.
- Enter on a row closes the bar and shows that agent, tab or space; ⌘Enter peeks at it instead.
- Ctrl+D shows "⌃D again to close tab"; pressing Down removes it without closing anything.
- With `{"density": "comfortable"}` in bar.json, rows take two lines.
