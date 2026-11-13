// Bar: a quick switcher for the Herdr app. A popup that lists every agent, tab, pane and
// space on every connected machine, with live status, fuzzy search, filters, the app's
// commands and a preview of the selected terminal. Enter goes there.
//
// Opened with `mod.open:bar` (see keys.json). The rows, the search language, the commands and
// the actions live in rows.js, query.js, commands.js, actions.js and fuzzy.js, which have no
// app imports and are tested with `node --test`.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import {
  agents, panes, spaces, terminals, commands, keys, themes, layouts, run, hc, home, appHome, theme, settings, props,
  closeOverlay, shared, setShared, readTextFile, window as appWindow,
} from "herdr";
import { VIEWS, WORDS, build, counts, compose, inView, firstPick, visit, duration } from "./rows.js";
import { parse, without, pill, SIGILS } from "./query.js";
import { commandRows, keyLabel } from "./commands.js";
import { actionsFor, run as actionCommand, leaves } from "./actions.js";
import { segments } from "./fuzzy.js";

const BODY = 432; // the list's and the preview's height
const ROWS = { compact: 36, comfortable: 48 }; // a row's height, by density
const HEAD = 26; // a group heading's height
const PREVIEW_MIN = 760; // narrower than this, the preview is left out
const PREVIEW_LINE = 15;
const PREVIEW_EVERY = 1500; // how often the preview is read again, ms
const PREVIEW_AFTER = 90; // how long the selection must rest before its preview is read, ms
const FLASH = 2600; // how long a note in the footer stays, ms
const RECENT = "bar.recent"; // shared: row keys, most recently visited first
const VIEW = "bar.view"; // shared: the view the bar was last left in
const SHOW_PREVIEW = "bar.preview"; // shared: false once the person hides the preview
const CONFIG = "bar.config"; // shared: the last bar.json read, so the next open starts with it
const GROUPS = { places: "Go to", commands: "Commands", help: "Search syntax" };

/**
 * The person's settings, from bar.json in the app's home. Every key is optional.
 * - density: "compact" (one line a row, the default) or "comfortable" (two lines).
 * - scope: the list the bar opens on: "last" (the default: the one last used) or a view id.
 * - select_current: true opens on the row you are in, instead of the one you came from.
 * - commands: false keeps commands out of "All" searches (">" still lists them).
 */
const DEFAULTS = { density: "compact", scope: "last", select_current: false, commands: true };

// The same space colors the shipped mods keep in shared "space.colors". Read only.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-_]/g;

const nb = (s) => s.replace(/ /g, " ");

export default class Bar extends View {
  init(_props, cx) {
    this.mac = appWindow()?.platform === "macos";
    this.config = { ...DEFAULTS, ...(shared(CONFIG) ?? {}) };
    this.query = "";
    this.view = this.openingView();
    this.opening = this.view; // where Ctrl+U goes back to
    this.at = null; // index of the selected entry; null until the first render picks one
    this.picked = null; // key of the selected row, so it stays selected as the list changes
    this.scroll = 0;
    this.armed = null; // key of the row whose close is waiting for a second press
    this.menu = null; // { at } while the actions menu is open
    this.mode = null; // { kind: "rename", row } while the search field is asking for a name
    this.flash = null; // { text, level }: a note in the footer
    this.flashRun = 0;
    this.emptied = false; // the last key emptied the search, so a backspace now isn't "on empty"
    this.listHeight = BODY;
    this.width = 0;
    this.preview = { key: null, lines: [], loading: false };
    this.previewRun = 0;
    this.handle = cx.focus_handle();

    this.input = InputState.new({ placeholder: "Search agents, tabs, spaces, branches, folders…   ? for help" });
    this.input.on("change", (_e, cx) => {
      const before = this.query;
      this.query = this.input.value();
      this.emptied = Boolean(before) && !this.query;
      this.reset();
      cx.notify();
    });
    this.input.on("submit", (e, cx) => {
      const r = this.rows()[this.at]?.row;
      if (this.menu) this.act(actionsFor(r)[this.menu.at]?.id, r, cx);
      else if (e?.secondary) this.act("peek", r, cx);
      else this.go(r, cx);
      cx.notify();
    });
    this.edit = InputState.new({ placeholder: "A name" });
    this.edit.on("submit", (_e, cx) => {
      this.commitRename(cx);
      cx.notify();
    });
    this.input.focus();
    // The popup takes the keyboard a moment after it opens.
    cx.timer.after(300, () => (this.mode ? this.edit : this.input).focus());

    // Where the person is when the bar opens counts as visited, so it sorts as most recent.
    const here = build(this.model()).filter((r) => r.current && (r.kind === "agent" || r.kind === "tab"));
    let recent = this.recent();
    for (const r of here) recent = visit(recent, r.key);
    if (here.length) setShared(RECENT, recent);

    this.readConfig(cx);
    cx.timer.every(PREVIEW_EVERY, (cx) => this.readPreview(cx));
    // Running times tick without any data changing.
    cx.timer.every(15000, (cx) => cx.notify());
  }

  openingView() {
    const want = this.config.scope === "last" ? shared(VIEW) : this.config.scope;
    return VIEWS.some((v) => v.id === want) ? want : "all";
  }

  // bar.json, read once per open. Kept in shared state, so the next open starts with it.
  readConfig(cx) {
    cx.spawn(async (cx) => {
      let text = null;
      try {
        text = await readTextFile(`${appHome()}/bar.json`);
      } catch {}
      let read = {};
      try {
        read = text ? JSON.parse(text) : {};
      } catch {
        this.note("bar.json isn't valid JSON; using the defaults.", "error", cx);
      }
      const next = { ...DEFAULTS, ...read };
      if (JSON.stringify(next) === JSON.stringify(this.config)) return;
      const viewWas = this.openingView();
      this.config = next;
      setShared(CONFIG, read);
      if (this.view === viewWas && !this.query) this.view = this.opening = this.openingView();
      cx.notify();
    });
  }

  model() {
    return { agents: agents(), panes: panes(), spaces: spaces(), terminals: terminals() };
  }

  recent() {
    const kept = shared(RECENT);
    return Array.isArray(kept) ? kept : [];
  }

  // The entries on screen, in order: [{ row, score, positions, hits, group }]. Built once per render.
  rows() {
    return this.shown ?? [];
  }

  rowHeight() {
    return ROWS[this.config.density] ?? ROWS.compact;
  }

  reset() {
    this.at = null;
    this.picked = null;
    this.scroll = 0;
    this.armed = null;
    this.menu = null;
  }

  close() {
    closeOverlay(props().overlay);
  }

  setQuery(text) {
    this.input.set_value(text);
    this.query = text;
    this.reset();
    this.input.focus();
  }

  setView(id) {
    this.view = id;
    setShared(VIEW, id);
    this.reset();
    this.input.focus();
  }

  // Tab and Shift+Tab. A sign in the search field picked the list: the next one replaces it.
  cycle(step) {
    const parsed = parse(this.query);
    const from = VIEWS.findIndex((v) => v.id === (parsed.scope ?? this.view));
    if (parsed.sigil && parsed.scope !== "help") this.setQuery(this.query.replace(/^\s*\S\s?/, ""));
    this.setView(VIEWS[(Math.max(0, from) + step + VIEWS.length) % VIEWS.length].id);
  }

  select(i) {
    const rows = this.rows();
    if (!rows.length) return;
    this.at = (i + rows.length) % rows.length;
    this.picked = rows[this.at].row.key;
    this.armed = null;
    if (this.menu) this.menu = { at: 0 };
  }

  note(text, level = "info", cx) {
    const mine = ++this.flashRun;
    this.flash = { text, level };
    cx?.timer.after(FLASH, (cx) => {
      if (mine !== this.flashRun) return;
      this.flash = null;
      cx.notify();
    });
  }

  go(r, cx) {
    if (!r) return;
    if (r.kind === "help") return this.setQuery(r.insert);
    if (r.kind === "command") {
      this.close();
      run(r.command, r.args);
      return;
    }
    setShared(RECENT, visit(this.recent(), r.key));
    this.close();
    if (r.kind === "space") run("space.select", { id: r.spaceId });
    else if (r.kind === "tab") run("tab.select", { id: r.tab });
    else if (r.pane) run("pane.focus", { pane: r.pane });
    // A sub-agent has no pane to go to: look at it over the tab.
    else run("terminal.peek", { terminal: r.terminal });
  }

  // Does one of the actions menu's things to a row. Closing asks twice.
  act(id, r, cx) {
    if (!id || !r) return;
    if (id === "go") return this.go(r, cx);
    if (id === "rename") return this.startRename(r);
    if (id === "close") return this.shut(r, cx);
    const command = actionCommand(id, r);
    if (!command) return;
    if (id === "peek" && !r.terminal) return;
    if (leaves(id)) this.close();
    run(...command);
    if (!leaves(id)) {
      this.menu = null;
      const said = { pin: "Pinned", unpin: "Unpinned", settle: "Settled: it comes back when an agent in it needs you", unsettle: "Back in the lists" };
      this.note(`${said[id] ?? "Done"}.`, "success", cx);
    }
  }

  // Closes what the row stands for. The first call arms it, the second does it.
  shut(r, cx) {
    if (!r || r.kind === "command" || r.kind === "help") return;
    if (this.armed !== r.key) {
      this.armed = r.key;
      return;
    }
    this.armed = null;
    this.menu = null;
    run(...actionCommand("close", r));
    this.note(`${this.shutWord(r).replace(/^./, (c) => c.toUpperCase())}: done.`, "success", cx);
  }

  shutWord(r) {
    return r.kind === "space" ? "close space" : r.kind === "pane" ? "close pane" : r.sub ? "end agent" : "close tab";
  }

  startRename(r) {
    if (!r || (r.kind !== "space" && !r.tab) || r.sub) return;
    // The name somebody gave it; an automatic one starts empty, so typing replaces nothing.
    const space = spaces().find((s) => s.id === r.spaceId);
    const tab = spaces().flatMap((s) => s.tabs ?? []).find((t) => t.id === r.tab);
    const current = r.kind === "space" ? (space?.named ? space.name : "") : (tab?.named ? tab.name : "");
    this.mode = { kind: "rename", row: r };
    this.menu = null;
    this.edit.set_value(current ?? "");
    this.edit.focus();
  }

  commitRename(cx) {
    const r = this.mode?.row;
    if (!r) return;
    const name = this.edit.value().trim();
    // An empty name gives the tab or space its automatic name back.
    if (r.kind === "space") run("space.rename", { id: r.spaceId, name });
    else run("tab.rename", { id: r.tab, name });
    this.mode = null;
    this.input.focus();
    this.note(name ? `Renamed to “${name}”.` : "Back to its automatic name.", "success", cx);
  }

  // Reads the selected row's terminal screen. Only the latest read is kept.
  readPreview(cx) {
    const r = this.rows()[this.at]?.row;
    const address = r?.terminal;
    if (!r || !address || r.kind === "command" || r.kind === "help") {
      this.preview = { key: r?.key ?? null, lines: [], loading: false };
      return;
    }
    const mine = ++this.previewRun;
    if (this.preview.key !== r.key) this.preview = { key: r.key, lines: [], loading: true };
    cx.spawn(async (cx) => {
      let lines = null;
      try {
        const out = await hc(["read", address]);
        if (out.code === 0) lines = out.stdout.replace(ANSI, "").replace(/\s+$/, "").split("\n").map((l) => l.replace(/\s+$/, ""));
      } catch {}
      if (mine !== this.previewRun || this.preview.key !== r.key) return;
      const same = lines && lines.length === this.preview.lines.length && lines.every((l, i) => l === this.preview.lines[i]);
      if (same && !this.preview.loading) return;
      this.preview = { key: r.key, lines: lines ?? [], loading: false, failed: !lines };
      cx.notify();
    });
  }

  // Asks for the preview once the selection has rested on a row.
  followPreview(cx) {
    const key = this.rows()[this.at]?.row.key ?? null;
    if (key === this.wanted) return;
    this.wanted = key;
    cx.timer.after(PREVIEW_AFTER, (cx) => {
      if (this.wanted === key) this.readPreview(cx);
    });
  }

  spaceColor(t, id) {
    const c = (shared("space.colors") ?? {})[id];
    return c ? (c.startsWith("#") ? c : (MARK[c] ?? t[c] ?? t.dim)) : t.dim;
  }

  // --- Drawing ---------------------------------------------------------------------------

  icon(t, r, size) {
    const p = r.program;
    const radius = Math.round(size / 4);
    const glyph = (path, color) => svg(path).size(size * 0.58).flex_none().text_color(color);
    const tile = (bg, child) => h_flex().size(size).flex_none().rounded(radius).bg(bg).items_center().justify_center().child(child);
    if (r.kind === "space") return tile(this.spaceColor(t, r.spaceId), div().text_size(size * 0.46).font_bold().text_color("#ffffff").child([...r.title][0]?.toUpperCase() ?? "?"));
    if (r.kind === "command") {
      if (r.colors) return this.swatch(r.colors, size, radius);
      return tile(t.raised, glyph(r.command === "layout.switch" ? "mods/bar/layout.svg" : "mods/bar/command.svg", t.muted));
    }
    if (r.kind === "help") return tile(t.raised, div().text_size(size * 0.42).font_semibold().text_color(t.accent).child(r.sign.replace(/:$/, "")));
    if (!p?.icon) return tile(t.raised, glyph("mods/bar/terminal.svg", t.muted));
    if (!p.tint) return image(p.icon).w(size).h(size).flex_none().rounded(radius);
    return tile(p.tile ?? t.raised, glyph(p.icon, p.tile ? (p.color ?? "#ffffff") : t.foreground));
  }

  // A theme as four of its colors in a tile.
  swatch(c, size, radius) {
    const half = size / 2;
    const cell = (color) => div().w(half).h(half).bg(color ?? "#888888");
    return v_flex().size(size).flex_none().rounded(radius).overflow_hidden().border(1).border_color(c.border ?? "#00000033")
      .child(h_flex().child(cell(c.background)).child(cell(c.accent)))
      .child(h_flex().child(cell(c.working)).child(cell(c.blocked)));
  }

  status(t, r) {
    const st = r.status;
    if (st === "working") return svg("mods/bar/spinner.svg").size(13).flex_none().text_color(t.working).spin(900);
    if (st === "blocked" || st === "done") {
      return h_flex().flex_none().px(7).h(19).rounded(6).bg(t[st] + "26").items_center().text_size(10.5).font_semibold().text_color(t[st]).child(WORDS[st]);
    }
    if (st === "idle") return div().size(8).mx(2).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return null;
  }

  // Text with the characters the search matched in the accent color. Text has no styled
  // runs, so it is a row of divs, one per run.
  lit(t, text, positions, el) {
    if (!positions?.length) return el.child(div().truncate().child(text));
    return el.children(segments(text, positions).map((s) => div().flex_none().when(s.hit, (d) => d.text_color(t.accent).font_semibold()).child(nb(s.text))));
  }

  title(t, f, on, size) {
    const r = f.row;
    const color = on || r.current ? t.foreground : r.settled ? t.dim : t.muted;
    const el = h_flex().min_w(0).flex_shrink(1).overflow_hidden().whitespace_nowrap().text_size(size).text_color(color).when(r.current, (el) => el.font_semibold());
    return this.lit(t, r.title, f.hits?.title, el);
  }

  // The second half of a row: space, detail, machine, branch, folder, each lit where matched.
  meta(t, f, compact) {
    const r = f.row;
    const h = f.hits ?? {};
    const bits = [];
    const bit = (field, text, { icon = null, color = t.dim, max = 190 } = {}) => {
      const el = h_flex().flex_none().max_w(max).min_w(0).gap(4).items_center().overflow_hidden().whitespace_nowrap().text_color(color)
        .when(Boolean(icon), (el) => el.child(svg(icon).size(11).flex_none()));
      return this.lit(t, text, h[field], el);
    };
    if (r.kind === "command") {
      if (r.detail) bits.push(bit("detail", r.detail, { max: 420 }));
    } else if (r.kind === "help") {
      bits.push(bit("detail", r.detail, { max: 520 }));
    } else {
      if (r.kind !== "space") {
        bits.push(h_flex().flex_none().max_w(160).min_w(0).gap(5).items_center()
          .child(div().size(7).flex_none().rounded(2).bg(this.spaceColor(t, r.spaceId)))
          .child(this.lit(t, r.space || "no space", h.space, h_flex().min_w(0).overflow_hidden().whitespace_nowrap().text_color(t.muted))));
      }
      if (r.ask) bits.push(bit("ask", r.ask, { color: t.blocked, max: 260 }));
      else if (r.detail) bits.push(bit("detail", r.detail, { max: 170 }));
      if (r.machine) bits.push(bit("machine", r.machine, { icon: "mods/bar/machine.svg", color: t.accent, max: 120 }));
      if (r.branch) bits.push(bit("branch", r.branch, { icon: "mods/bar/branch.svg", max: 150 }));
      if (r.where) bits.push(this.lit(t, r.where, h.where, h_flex().min_w(0).flex_shrink(1).overflow_hidden().whitespace_nowrap().text_color(t.dim)));
    }
    return h_flex().min_w(0).when(compact, (el) => el.flex_1()).gap(compact ? 9 : 10).items_center().overflow_hidden().text_size(11).children(bits);
  }

  tags(t, r) {
    const kind = r.kind === "agent" ? (r.sub ? "sub-agent" : null) : r.kind === "command" || r.kind === "help" ? null : r.kind;
    const tag = (text) => div().flex_none().px(5).h(15).rounded(4).border(1).border_color(t.border).text_size(9.5).text_color(t.dim).flex().items_center().child(text);
    return [
      r.pinned ? svg("mods/bar/pin.svg").size(11).flex_none().text_color(t.dim) : null,
      kind ? tag(kind) : null,
      r.settled ? tag("settled") : null,
      r.kind === "command" && r.current ? tag("current") : null,
      r.subs > 0 ? div().flex_none().text_size(11).text_color(t.dim).child(`+${r.subs}`) : null,
    ].filter(Boolean);
  }

  // The right end of a row: the close question, a command's key, or the running time and status.
  tail(t, r, now) {
    if (this.armed === r.key) {
      return [div().flex_none().px(7).h(19).rounded(6).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child(`${this.mac ? "⌃D" : "Ctrl+D"} again to ${this.shutWord(r)}`)];
    }
    if (r.kind === "command") return r.keys ? [this.keycap(t, keyLabel(r.keys, this.mac))] : [];
    if (r.kind === "help") return [];
    const age = r.kind === "agent" && r.status === "working" && r.changed ? now - r.changed : r.created ? now - r.created : null;
    const mark = this.status(t, r);
    return [
      age !== null ? div().flex_none().text_size(11).text_color(t.dim).child(duration(age)) : null,
      mark ? h_flex().flex_none().min_w(17).justify_center().child(mark) : null,
    ].filter(Boolean);
  }

  row(t, f, i, top, height, now) {
    const r = f.row;
    const on = i === this.at;
    const compact = this.config.density !== "comfortable";
    const iconSize = compact ? 20 : 28;
    const body = compact
      ? h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(h_flex().flex_shrink(0).max_w(compact && r.kind !== "command" ? 340 : 420).min_w(0).gap(7).items_center()
          .child(this.title(t, f, on, 13)).children(this.tags(t, r)))
        .child(this.meta(t, f, true))
      : v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().min_w(0).gap(7).items_center().child(this.title(t, f, on, 13.5)).children(this.tags(t, r)))
        .child(this.meta(t, f, false));
    return h_flex()
      .id(`bar-${r.key}`)
      .absolute()
      .left(0)
      .right(0)
      .top(top - this.scroll)
      .h(height)
      .px(4)
      .child(
        h_flex()
          .size_full()
          .px(compact ? 8 : 10)
          .gap(compact ? 9 : 11)
          .items_center()
          .rounded(compact ? 7 : 9)
          .cursor_pointer()
          .when(on, (el) => el.bg(t.selected ?? t.hover))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
          .child(this.icon(t, r, iconSize))
          .child(body)
          .children(this.tail(t, r, now)),
      )
      .on_click((_e, cx) => {
        this.go(r, cx);
      })
      .on_mouse_down("right", (_e, cx) => {
        this.select(i);
        this.menu = { at: 0 };
        cx.stop_propagation();
        cx.notify();
      });
  }

  chips(t, n, scope) {
    const out = [];
    let group = 0;
    for (const v of VIEWS) {
      if (v.group !== group) {
        out.push(div().w(1).h(14).flex_none().mx(3).bg(t.border));
        group = v.group;
      }
      const on = v.id === scope;
      const count = v.status ? n[v.status] : null;
      out.push(
        h_flex()
          .id(`bar-view-${v.id}`)
          .flex_none()
          .h(24)
          .px(9)
          .gap(6)
          .items_center()
          .rounded(7)
          .text_size(11.5)
          .cursor_pointer()
          .border(1)
          .border_color(on ? t.accent + "66" : t.border)
          .text_color(on ? t.foreground : t.muted)
          .when(on, (el) => el.bg(t.accent + "22").font_semibold())
          .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .when(Boolean(v.sigil), (el) => el.tooltip(`Type ${v.sigil} to search ${v.label === "Needs you" ? "what needs you" : v.label.toLowerCase()}`))
          .on_click((_e, cx) => {
            if (parse(this.query).sigil) this.setQuery(this.query.replace(/^\s*\S\s?/, ""));
            this.setView(v.id);
            cx.notify();
          })
          .when(Boolean(v.status), (el) => el.child(div().size(6).flex_none().rounded(3).bg(count ? t[v.status] : t.dim + "66")))
          .child(v.label)
          .when(count !== null, (el) => el.child(div().text_color(count ? t.muted : t.dim).child(String(count)))),
      );
    }
    return h_flex().flex_none().gap(5).items_center().children(out);
  }

  keycap(t, k) {
    return div().flex_none().px(5).h(17).rounded(4).border(1).border_color(t.border).text_size(10).text_color(t.muted).flex().items_center().child(k);
  }

  // The filters typed in the search field, as pills; × takes one out again.
  pills(t, parsed) {
    return parsed.filters.map((f, i) =>
      h_flex().id(`bar-pill-${i}`).flex_none().h(20).pl(7).pr(3).gap(3).items_center().rounded(6).text_size(11)
        .bg(f.valid ? t.accent + "22" : t.raised)
        .text_color(f.valid ? t.foreground : t.dim)
        .when(!f.valid, (el) => el.tooltip(f.value ? `is: knows needs, working, done, idle, pinned, sub, here, settled, remote, local` : "Type a value"))
        .child(pill(f))
        .child(div().id(`bar-pill-x-${i}`).size(14).rounded(4).flex().items_center().justify_center().text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .child("×")
          .on_click((_e, cx) => {
            this.setQuery(without(this.query, f));
            cx.stop_propagation();
            cx.notify();
          })));
  }

  searchField(t, parsed, found, total) {
    const field = h_flex().h(38).flex_none().px(11).gap(9).items_center().rounded(10).border(1).border_color(t.accent).bg(t.background);
    if (this.mode) {
      const r = this.mode.row;
      const what = r.kind === "space" ? "Rename space" : "Rename tab";
      return field
        .child(h_flex().flex_none().h(22).px(8).gap(6).items_center().rounded(6).bg(t.accent + "22").text_size(11.5).font_semibold().text_color(t.foreground)
          .child(this.icon(t, r, 14)).child(what))
        .child(Input.new(this.edit).flex_1().h_full().text_size(13.5).text_color(t.foreground))
        .child(div().flex_none().text_size(11).text_color(t.dim).child("empty: its automatic name"));
    }
    const scope = VIEWS.find((v) => v.id === parsed.scope);
    return field
      .child(svg("mods/bar/search.svg").size(15).flex_none().text_color(t.dim))
      .when(Boolean(scope), (el) => el.child(div().flex_none().text_size(11).text_color(t.accent).font_semibold().child(scope.label)))
      .child(Input.new(this.input).flex_1().h_full().text_size(13.5).text_color(t.foreground))
      .children(this.pills(t, parsed))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(this.count(parsed, found, total)));
  }

  // The count beside the search: "10", "2 of 10", or how many commands an "All" search found.
  count(parsed, found, total) {
    if (parsed.scope === "help") return "";
    const commandsFound = this.rows().filter((f) => f.group === "commands").length;
    if (!found && commandsFound && parsed.scope !== "commands") return `${commandsFound} command${commandsFound === 1 ? "" : "s"}`;
    return found === total ? `${found}` : `${found} of ${total}`;
  }

  frame(height) {
    const t = theme();
    return v_flex().flex_1().min_w(0).h(height).rounded(10).border(1).border_color(t.border).bg(t.background).overflow_hidden();
  }

  header(t, r, { sub = null, right = [] } = {}) {
    return v_flex().flex_none().px(12).py(9).gap(3).border_b(1).border_color(t.border).bg(t.surface).rounded_tl(9).rounded_tr(9)
      .child(
        h_flex().gap(8).items_center()
          .child(this.icon(t, r, 18))
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_semibold().text_color(t.foreground).child(r.title))
          .children(right),
      )
      .when(Boolean(sub), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(sub)));
  }

  previewPane(t, r, height) {
    const frame = this.frame(height);
    if (!r) return frame;
    const note = (text) => v_flex().flex_1().items_center().justify_center().px(20).text_size(12).text_color(t.dim).child(text);
    if (r.kind === "help") return frame.child(this.header(t, { ...r, title: "Searching the bar" })).child(this.cheatSheet(t));
    if (r.kind === "command") return frame.child(this.header(t, r, { sub: r.command + (Object.keys(r.args).length ? ` ${JSON.stringify(r.args)}` : "") })).child(this.commandCard(t, r));
    const where = [r.space, r.branch, r.where].filter(Boolean).join("  ·  ");
    const right = [
      r.machine ? div().flex_none().text_size(11).text_color(t.accent).child(r.machine) : null,
      r.status ? div().flex_none().text_size(11).text_color(t[r.status] ?? t.dim).child(WORDS[r.status]) : null,
    ].filter(Boolean);
    const head = this.header(t, r, { sub: where, right });
    if (r.kind === "space") {
      const tabs = build(this.model(), { home: home() }).filter((x) => x.kind === "tab" && x.spaceId === r.spaceId);
      return frame.child(head).child(
        v_flex().flex_1().min_h(0).p(8).gap(2).overflow_hidden().children(
          tabs.map((x) => h_flex().h(26).px(6).gap(8).items_center().text_size(12)
            .child(this.icon(t, x, 16))
            .child(div().flex_1().min_w(0).truncate().text_color(x.current ? t.foreground : t.muted).child(x.title))
            .when(Boolean(this.status(t, x)), (el) => el.child(this.status(t, x)))),
        ),
      );
    }
    const ask = r.ask
      ? h_flex().flex_none().mx(10).mt(8).px(10).py(7).gap(8).rounded(8).bg(t.blocked + "1f").text_size(11.5).text_color(t.blocked)
        .child(div().flex_none().font_semibold().child("Asks"))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(r.ask))
      : null;
    const p = this.preview.key === r.key ? this.preview : { lines: [], loading: true };
    const shown = frame.child(head).when(Boolean(ask), (el) => el.child(ask));
    if (!p.lines.length) return shown.child(note(p.failed ? "Couldn't read this terminal." : p.loading ? "" : "Nothing on screen."));
    // The newest lines, as many as fit: a terminal's bottom is where things happen.
    const fit = Math.max(1, Math.floor((height - 62 - (ask ? 42 : 0)) / PREVIEW_LINE));
    return shown.child(
      v_flex().flex_1().min_h(0).px(12).py(8).justify_end().overflow_hidden()
        .font_family(settings().font_family ?? "JetBrains Mono")
        .text_size(11)
        .text_color(t.muted)
        .children(p.lines.slice(-fit).map((l) => div().h(PREVIEW_LINE).flex_none().whitespace_nowrap().overflow_hidden().child(nb(l) || " "))),
    );
  }

  commandCard(t, r) {
    const body = v_flex().flex_1().min_h(0).p(14).gap(12).text_size(12.5).text_color(t.muted).overflow_hidden();
    if (r.colors) {
      const names = ["background", "surface", "foreground", "accent", "working", "blocked", "done", "idle", "ansi1", "ansi2", "ansi3", "ansi4", "ansi5", "ansi6"];
      return body
        .child(div().child(r.current ? "The theme in use." : "↵ switches to this theme. Every mod follows it."))
        .child(h_flex().flex_wrap().gap(8).children(names.filter((n) => r.colors[n]).map((n) =>
          v_flex().w(58).gap(4).items_center()
            .child(div().w(58).h(30).rounded(6).border(1).border_color(t.border).bg(r.colors[n]))
            .child(div().text_size(10).text_color(t.dim).child(n)))));
    }
    return body
      .child(div().child(r.about ?? r.detail ?? ""))
      .when(Boolean(r.keys), (el) => el.child(h_flex().gap(8).items_center().child(div().text_color(t.dim).child("Key")).child(this.keycap(t, keyLabel(r.keys, this.mac)))))
      .child(div().text_color(t.dim).child("↵ runs it. The bar closes first, so it acts on the tab you are in."));
  }

  cheatSheet(t) {
    const k = (s) => keyLabel(s, this.mac);
    const keysList = [
      ["↑ ↓", "Move"],
      ["↵", "Go to the row"],
      [k("secondary-enter"), "Peek without leaving"],
      [k("secondary-."), "Actions for the row"],
      [k("secondary-r"), "Rename the tab or space"],
      [`${k("ctrl-d")} ${k("ctrl-d")}`, "Close it"],
      ["Tab", "Next list"],
      [k("secondary-o"), "Hide or show this preview"],
      [k("ctrl-u"), "Clear the search"],
      ["Esc", "Leave"],
    ];
    return v_flex().flex_1().min_h(0).px(14).py(10).gap(5).overflow_hidden().text_size(11.5)
      .child(div().text_color(t.dim).pb(2).child("Signs go first, filters anywhere: “@ login on:studio -is:idle”."))
      .children(keysList.map(([key, what]) => h_flex().gap(10).items_center()
        .child(h_flex().w(110).flex_none().justify_end().child(this.keycap(t, key)))
        .child(div().text_color(t.muted).child(what))));
  }

  menuPane(t, r, height) {
    const items = actionsFor(r);
    const k = { enter: "↵", peek: keyLabel("secondary-enter", this.mac), rename: keyLabel("secondary-r", this.mac), close: `${keyLabel("ctrl-d", this.mac)}×2` };
    return this.frame(height)
      .child(this.header(t, r, { sub: "Actions", right: [this.keycap(t, "←")] }))
      .child(v_flex().flex_1().min_h(0).p(6).gap(2).overflow_hidden().children(items.map((a, i) => {
        const on = i === this.menu.at;
        const armed = a.id === "close" && this.armed === r.key;
        const color = a.danger ? t.blocked : t.foreground;
        return h_flex().id(`bar-act-${a.id}`).h(32).px(10).gap(10).items_center().rounded(7).cursor_pointer().text_size(12.5)
          .text_color(color)
          .when(on, (el) => el.bg(a.danger ? t.blocked + "22" : t.selected ?? t.hover))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
          .child(div().flex_1().min_w(0).truncate().child(armed ? `Press again to ${a.label.toLowerCase()}` : a.label))
          .when(Boolean(a.key), (el) => el.child(this.keycap(t, k[a.key])))
          .on_click((_e, cx) => {
            this.menu = { at: i };
            this.act(a.id, r, cx);
            cx.notify();
          });
      })));
  }

  hints(t, sel) {
    const k = (s) => keyLabel(s, this.mac);
    const key = (cap, what) => h_flex().flex_none().gap(5).items_center().child(this.keycap(t, cap)).child(div().text_color(t.dim).child(what));
    let list;
    if (this.mode) list = [["↵", "rename"], ["esc", "leave"]];
    else if (this.menu) list = [["↑↓", "choose"], ["↵", "do it"], ["←", "back"]];
    else if (sel?.kind === "command") list = [["↵", "run"], ["tab", "next list"], ["esc", "leave"]];
    else if (sel?.kind === "help") list = [["↵", "use it"], [k("ctrl-u"), "clear"]];
    else if (!sel) list = [["tab", "next list"], [k("ctrl-u"), "clear"], ["esc", "leave"]];
    else {
      list = [["↑↓", "move"], ["↵", "go"]];
      if (sel?.terminal) list.push([k("secondary-enter"), "peek"]);
      list.push([k("secondary-."), "actions"], ["tab", "next list"], ["esc", "leave"]);
    }
    const right = this.flash
      ? div().flex_none().text_color(this.flash.level === "error" ? t.blocked : this.flash.level === "success" ? t.done : t.muted).child(this.flash.text)
      : h_flex().flex_none().gap(5).items_center().child(this.keycap(t, "?")).child(div().text_color(t.dim).child("search tips"));
    return h_flex().flex_none().gap(14).items_center().text_size(11)
      .children(list.map(([cap, what]) => key(cap, what)))
      .child(div().flex_1())
      .child(right);
  }

  // Where each entry and heading sits in the list, top to bottom.
  place(found, rowH) {
    const items = [];
    const tops = [];
    const grouped = new Set(found.map((f) => f.group)).size > 1;
    let y = 0;
    let group = null;
    found.forEach((f, i) => {
      if (grouped && f.group !== group) {
        items.push({ head: GROUPS[f.group] ?? f.group, top: y });
        y += HEAD;
      }
      group = f.group;
      tops.push(y);
      items.push({ i, top: y });
      y += rowH;
    });
    return { items, tops, total: y, grouped };
  }

  render(cx) {
    const t = theme();
    const now = Date.now();
    const rowH = this.rowHeight();
    const all = build(this.model(), { home: home() });
    const parsed = parse(this.query);
    const cmds = commandRows({
      commands: commands(),
      keys: keys(),
      themes: themes(),
      layouts: layouts(),
      theme: settings().theme ?? null,
      layout: shared("layout") ?? null,
    });
    const found = compose({ rows: all, commands: cmds, view: this.view, parsed, recent: this.recent(), withCommands: this.config.commands !== false });
    const scope = parsed.scope ?? this.view;
    // The count beside the search: the places found of those the list holds.
    const searching = parsed.terms.length > 0 || parsed.filters.some((f) => f.valid);
    const listed = scope === "commands" ? found.length : found.filter((f) => f.group === "places").length;
    const pool = scope === "commands" ? cmds.length : scope === "help" ? found.length : inView(all, scope, searching).length;
    this.shown = found;

    // Keep the selection on the same row as the list changes under it.
    const kept = this.picked ? found.findIndex((f) => f.row.key === this.picked) : -1;
    if (kept >= 0) this.at = kept;
    else if (this.at === null) this.at = parsed.terms.length ? 0 : firstPick(found, Boolean(this.config.select_current));
    this.at = Math.max(0, Math.min(this.at, found.length - 1));
    this.picked = found[this.at]?.row.key ?? null;
    const sel = found[this.at]?.row ?? null;
    this.followPreview(cx);

    // Only the rows in view are drawn; the list scrolls just enough to keep the selection in it,
    // with its group's heading when it is the group's first row.
    const height = Math.min(BODY, this.listHeight);
    const { items, tops, total: full, grouped } = this.place(found, rowH);
    const maxScroll = Math.max(0, full - height);
    if (found.length) {
      const top = tops[this.at];
      const headed = grouped && (this.at === 0 || found[this.at - 1].group !== found[this.at].group);
      const want = headed ? top - HEAD : top;
      if (want < this.scroll) this.scroll = want;
      if (top + rowH > this.scroll + height) this.scroll = top + rowH - height;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const visible = items.filter((it) => it.top + (it.head ? HEAD : rowH) > this.scroll && it.top < this.scroll + height);
    const wide = (!this.width || this.width >= PREVIEW_MIN) && shared(SHOW_PREVIEW) !== false;
    const page = Math.max(1, Math.floor(height / rowH));

    const words = parsed.text || parsed.filters.map((f) => f.raw).join(" ");
    const empty = words
      ? `Nothing matches “${words}”${scope === "all" ? "." : ". Tab switches lists."}`
      : scope === "commands" ? "No commands." : "Nothing here.";

    const listBox = div()
      .id("bar-list")
      .relative()
      .when(wide, (el) => el.w(0).flex_1())
      .when(!wide, (el) => el.w_full())
      .h(BODY)
      .min_h(0)
      .overflow_hidden()
      .on_size_change((size, cx) => {
        this.listHeight = size.height / (settings().zoom ?? 1);
        cx.notify();
      })
      .on_scroll_wheel((e, cx) => {
        this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
        // The selection follows the wheel, so the next frame doesn't scroll back to it.
        if (found.length) {
          const first = tops.findIndex((y) => y >= this.scroll);
          let last = tops.length - 1;
          while (last > 0 && tops[last] + rowH > this.scroll + height) last--;
          if (first >= 0) this.select(Math.max(first, Math.min(this.at, Math.max(first, last))));
        }
        cx.notify();
      })
      .when(!found.length, (el) => el.child(
        v_flex().size_full().items_center().justify_center().gap(8).text_size(12.5).text_color(t.dim)
          .child(div().child(empty))
          .child(h_flex().gap(6).items_center().text_size(11)
            .child("Try").children(Object.keys(SIGILS).map((s) => this.keycap(t, s))).child("or").child(this.keycap(t, "?")).child("for tips")),
      ))
      .children(visible.map((it) => it.head
        ? h_flex().absolute().left(0).right(0).top(it.top - this.scroll).h(HEAD).px(12).items_end().pb(5).text_size(10.5).font_semibold().text_color(t.dim).child(it.head.toUpperCase())
        : this.row(t, found[it.i], it.i, it.top, rowH, now)));

    const side = this.menu && sel ? this.menuPane(t, sel, BODY) : this.previewPane(t, sel, BODY);

    return v_flex()
      .id("bar")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(14)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_size_change((size, cx) => {
        this.width = size.width / (settings().zoom ?? 1);
        cx.notify();
      })
      .on_key_down((e, cx) => {
        const k = e.key;
        const m = e.modifiers;
        const sec = this.mac ? m.platform : m.control;
        // Backspace on an empty search goes back to the opening list, but not the press that
        // emptied it.
        const emptied = this.emptied;
        this.emptied = false;
        // Esc belongs to the app: it closes the popup whatever the bar is doing.
        if (k === "escape") return this.close();
        if (this.mode) return;
        if (this.menu && (k === "down" || k === "up" || (m.control && (k === "n" || k === "p" || k === "j" || k === "k")))) {
          const n = actionsFor(sel).length;
          const step = k === "down" || k === "n" || k === "j" ? 1 : -1;
          this.menu = { at: (this.menu.at + step + n) % n };
          this.armed = null;
        } else if (k === "down" || (m.control && (k === "n" || k === "j"))) this.select(this.at + 1);
        else if (k === "up" || (m.control && (k === "p" || k === "k"))) this.select(this.at - 1);
        else if (k === "pagedown") this.select(Math.min(found.length - 1, this.at + page));
        else if (k === "pageup") this.select(Math.max(0, this.at - page));
        else if (k === "tab") this.cycle(m.shift ? -1 : 1);
        else if (k === "d" && m.control) this.shut(sel, cx);
        else if (sec && k === ".") this.menu = this.menu ? null : sel ? { at: 0 } : null;
        else if (sec && k === "r") this.startRename(sel);
        else if (sec && k === "o") setShared(SHOW_PREVIEW, shared(SHOW_PREVIEW) === false);
        else if (m.control && k === "u") {
          this.setQuery("");
          this.setView(this.opening);
        } else if (k === "backspace" && !this.query && !emptied && this.view !== "all") this.setView("all");
        else if (k === "right" && !this.query && sel && !this.menu) this.menu = { at: 0 };
        else if (k === "left" && this.menu) this.menu = null;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(this.searchField(t, parsed, listed, pool))
      .child(this.chips(t, counts(all), scope))
      .child(h_flex().flex_none().gap(12).items_start().child(this.menu && !wide && sel ? this.menuPane(t, sel, BODY) : listBox).when(wide, (el) => el.child(side)))
      .child(this.hints(t, sel));
  }
}
