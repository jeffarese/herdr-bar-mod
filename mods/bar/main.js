// Bar: a quick switcher for the Herdr app. A popup that lists every agent, tab, pane and
// space on every connected machine, with live status, fuzzy search, status filters and a
// preview of the selected terminal. Enter goes there.
//
// Opened with `mod.open:bar` (see keys.json). The rows, their order and the search live in
// rows.js and fuzzy.js, which have no app imports and are tested with `node --test`.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, panes, spaces, terminals, run, hc, home, theme, settings, props, closeOverlay, shared, setShared } from "herdr";
import { VIEWS, WORDS, build, counts, inView, search, order, firstPick, visit, duration, shortPath } from "./rows.js";
import { segments } from "./fuzzy.js";

const ROW = 48; // a row's height
const LIST = ROW * 9; // the list's height: nine rows
const PREVIEW_MIN = 760; // narrower than this, the preview is left out
const PREVIEW_LINE = 15;
const PREVIEW_EVERY = 1500; // how often the preview is read again, ms
const PREVIEW_AFTER = 90; // how long the selection must rest before its preview is read, ms
const RECENT = "bar.recent"; // shared: row keys, most recently visited first
const VIEW = "bar.view"; // shared: the view the bar was last left in

// The same space colors the shipped mods keep in shared "space.colors". Read only.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-_]/g;

export default class Bar extends View {
  init(_props, cx) {
    this.query = "";
    this.view = VIEWS.some((v) => v.id === shared(VIEW)) ? shared(VIEW) : "all";
    this.at = null; // index of the selected row; null until the first render picks one
    this.picked = null; // key of the selected row, so it stays selected as the list changes
    this.scroll = 0;
    this.armed = null; // key of the row whose close is waiting for a second press
    this.listHeight = LIST;
    this.width = 0;
    this.preview = { key: null, lines: [], loading: false };
    this.previewRun = 0;
    this.handle = cx.focus_handle();

    this.input = InputState.new({ placeholder: "Search agents, tabs, spaces, branches, folders…" });
    this.input.on("change", (_e, cx) => {
      this.query = this.input.value();
      this.reset();
      cx.notify();
    });
    this.input.on("submit", () => this.go(this.rows()[this.at]?.row));
    this.input.focus();
    // The popup takes the keyboard a moment after it opens.
    cx.timer.after(300, () => this.input.focus());

    // Where the person is when the bar opens counts as visited, so it sorts as most recent.
    const here = build(this.model()).filter((r) => r.current && (r.kind === "agent" || r.kind === "tab"));
    let recent = this.recent();
    for (const r of here) recent = visit(recent, r.key);
    if (here.length) setShared(RECENT, recent);

    cx.timer.every(PREVIEW_EVERY, (cx) => this.readPreview(cx));
    // Running times tick without any data changing.
    cx.timer.every(15000, (cx) => cx.notify());
  }

  model() {
    return { agents: agents(), panes: panes(), spaces: spaces(), terminals: terminals() };
  }

  recent() {
    const kept = shared(RECENT);
    return Array.isArray(kept) ? kept : [];
  }

  // The rows on screen, in order: [{ row, score, positions }]. Built once per render.
  rows() {
    return this.shown ?? [];
  }

  reset() {
    this.at = null;
    this.picked = null;
    this.scroll = 0;
    this.armed = null;
  }

  close() {
    closeOverlay(props().overlay);
  }

  setView(id) {
    this.view = id;
    setShared(VIEW, id);
    this.reset();
    this.input.focus();
  }

  select(i) {
    const rows = this.rows();
    if (!rows.length) return;
    this.at = (i + rows.length) % rows.length;
    this.picked = rows[this.at].row.key;
    this.armed = null;
  }

  go(r) {
    if (!r) return;
    setShared(RECENT, visit(this.recent(), r.key));
    this.close();
    if (r.kind === "space") run("space.select", { id: r.spaceId });
    else if (r.kind === "tab") run("tab.select", { id: r.tab });
    else if (r.pane) run("pane.focus", { pane: r.pane });
    // A sub-agent has no pane to go to: look at it over the tab.
    else run("terminal.peek", { terminal: r.terminal });
  }

  // Closes what the row stands for. The first call arms it, the second does it.
  shut(r) {
    if (!r) return;
    if (this.armed !== r.key) {
      this.armed = r.key;
      return;
    }
    this.armed = null;
    if (r.kind === "space") run("space.close", { id: r.spaceId, confirmed: true });
    else if (r.kind === "pane") run("pane.close", { pane: r.pane });
    else if (r.sub) run("terminal.kill", { terminal: r.terminal });
    else run("tab.close", { id: r.tab, confirmed: true });
  }

  shutWord(r) {
    return r.kind === "space" ? "close space" : r.kind === "pane" ? "close pane" : r.sub ? "end agent" : "close tab";
  }

  // Reads the selected row's terminal screen. Only the latest read is kept.
  readPreview(cx) {
    const r = this.rows()[this.at]?.row;
    const address = r?.terminal;
    if (!r || !address) {
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

  icon(t, r, size) {
    const p = r.program;
    const glyph = (path, color) => svg(path).size(size * 0.58).flex_none().text_color(color);
    const tile = (bg, child) => h_flex().size(size).flex_none().rounded(7).bg(bg).items_center().justify_center().child(child);
    if (r.kind === "space") return tile(this.spaceColor(t, r.spaceId), div().text_size(size * 0.46).font_bold().text_color("#ffffff").child([...r.title][0]?.toUpperCase() ?? "?"));
    if (!p?.icon) return tile(t.raised, glyph("mods/bar/terminal.svg", t.muted));
    if (!p.tint) return image(p.icon).w(size).h(size).flex_none().rounded(7);
    return tile(p.tile ?? t.raised, glyph(p.icon, p.tile ? (p.color ?? "#ffffff") : t.foreground));
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

  // The title, with the characters the search matched in the accent color.
  title(t, f, on) {
    const color = on || f.row.current ? t.foreground : t.muted;
    const el = h_flex().min_w(0).flex_shrink(1).overflow_hidden().whitespace_nowrap().text_size(13.5).text_color(color).when(f.row.current, (el) => el.font_semibold());
    if (!f.positions.length) return el.child(div().truncate().child(f.row.title));
    return el.children(segments(f.row.title, f.positions).map((s) => div().flex_none().when(s.hit, (d) => d.text_color(t.accent).font_semibold()).child(s.text.replace(/ /g, "\u00a0"))));
  }

  meta(t, r) {
    const bits = [];
    const bit = (icon, text, color = t.dim) => h_flex().flex_none().max_w(190).gap(4).items_center().text_color(color)
      .when(Boolean(icon), (el) => el.child(svg(icon).size(11).flex_none()))
      .child(div().truncate().child(text));
    if (r.kind !== "space") bits.push(h_flex().flex_none().max_w(170).gap(5).items_center().child(div().size(7).flex_none().rounded(2).bg(this.spaceColor(t, r.spaceId))).child(div().truncate().text_color(t.muted).child(r.space || "no space")));
    if (r.detail) bits.push(bit(null, r.detail));
    if (r.machine) bits.push(bit("mods/bar/machine.svg", r.machine, t.accent));
    if (r.branch) bits.push(bit("mods/bar/branch.svg", r.branch));
    if (r.cwd) bits.push(div().min_w(0).flex_shrink(1).truncate().text_color(t.dim).child(shortPath(r.cwd, r.machine ? null : home())));
    return h_flex().min_w(0).gap(10).items_center().overflow_hidden().text_size(11).children(bits);
  }

  row(t, f, i, now) {
    const r = f.row;
    const on = i === this.at;
    const armed = this.armed === r.key;
    const kind = r.kind === "agent" ? (r.sub ? "sub-agent" : null) : r.kind;
    const age = r.kind === "agent" && r.status === "working" && r.changed ? now - r.changed : r.created ? now - r.created : null;
    const mark = this.status(t, r);
    return h_flex()
      .id(`bar-${r.key}`)
      .absolute()
      .left(0)
      .right(0)
      .top(i * ROW - this.scroll)
      .h(ROW)
      .px(4)
      .child(
        h_flex()
          .size_full()
          .px(10)
          .gap(11)
          .items_center()
          .rounded(9)
          .cursor_pointer()
          .when(on, (el) => el.bg(t.selected ?? t.hover))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
          .child(this.icon(t, r, 28))
          .child(
            v_flex().flex_1().min_w(0).gap(3)
              .child(
                h_flex().min_w(0).gap(7).items_center()
                  .child(this.title(t, f, on))
                  .when(r.pinned, (el) => el.child(svg("mods/bar/pin.svg").size(11).flex_none().text_color(t.dim)))
                  .when(Boolean(kind), (el) => el.child(div().flex_none().px(5).h(15).rounded(4).border(1).border_color(t.border).text_size(9.5).text_color(t.dim).flex().items_center().child(kind)))
                  .when(r.subs > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`+${r.subs}`))),
              )
              .child(this.meta(t, r)),
          )
          .when(armed, (el) => el.child(div().flex_none().px(7).h(19).rounded(6).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child(`ctrl-d again to ${this.shutWord(r)}`)))
          .when(!armed, (el) => el
            .when(age !== null, (e) => e.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(age))))
            .when(Boolean(mark), (e) => e.child(h_flex().flex_none().min_w(17).justify_center().child(mark)))),
      )
      .on_click(() => this.go(r));
  }

  chips(t, n) {
    return h_flex().flex_none().gap(5).items_center().children(
      VIEWS.map((v) => {
        const on = v.id === this.view;
        const count = v.status ? n[v.status] : null;
        return h_flex()
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
          .on_click((_e, cx) => {
            this.setView(v.id);
            cx.notify();
          })
          .when(Boolean(v.status), (el) => el.child(div().size(6).flex_none().rounded(3).bg(count ? t[v.status] : t.dim + "66")))
          .child(v.label)
          .when(count !== null, (el) => el.child(div().text_color(count ? t.muted : t.dim).child(String(count))));
      }),
    );
  }

  previewPane(t, r, height) {
    const frame = v_flex().flex_1().min_w(0).h(height).rounded(10).border(1).border_color(t.border).bg(t.background).overflow_hidden();
    if (!r) return frame;
    const where = [r.space, r.branch, shortPath(r.cwd, r.machine ? null : home())].filter(Boolean).join("  ·  ");
    const head = v_flex().flex_none().px(12).py(9).gap(3).border_b(1).border_color(t.border).bg(t.surface)
      .child(
        h_flex().gap(8).items_center()
          .child(this.icon(t, r, 18))
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_semibold().text_color(t.foreground).child(r.title))
          .when(Boolean(r.machine), (el) => el.child(div().flex_none().text_size(11).text_color(t.accent).child(r.machine)))
          .when(Boolean(r.status), (el) => el.child(div().flex_none().text_size(11).text_color(t[r.status] ?? t.dim).child(WORDS[r.status]))),
      )
      .when(Boolean(where), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(where)));
    const note = (text) => v_flex().flex_1().items_center().justify_center().text_size(12).text_color(t.dim).child(text);
    if (r.kind === "space") {
      const tabs = build(this.model()).filter((x) => x.kind === "tab" && x.spaceId === r.spaceId);
      return frame.child(head).child(
        v_flex().flex_1().min_h(0).p(8).gap(2).overflow_hidden().children(
          tabs.map((x) => h_flex().h(26).px(6).gap(8).items_center().text_size(12)
            .child(this.icon(t, x, 16))
            .child(div().flex_1().min_w(0).truncate().text_color(x.current ? t.foreground : t.muted).child(x.title))
            .when(Boolean(this.status(t, x)), (el) => el.child(this.status(t, x)))),
        ),
      );
    }
    const p = this.preview.key === r.key ? this.preview : { lines: [], loading: true };
    if (!p.lines.length) return frame.child(head).child(note(p.failed ? "Couldn't read this terminal." : p.loading ? "" : "Nothing on screen."));
    // The newest lines, as many as fit: a terminal's bottom is where things happen.
    const fit = Math.max(1, Math.floor((height - 62) / PREVIEW_LINE));
    return frame.child(head).child(
      v_flex().flex_1().min_h(0).px(12).py(8).justify_end().overflow_hidden()
        .font_family(settings().font_family ?? "JetBrains Mono")
        .text_size(11)
        .text_color(t.muted)
        .children(p.lines.slice(-fit).map((l) => div().h(PREVIEW_LINE).flex_none().whitespace_nowrap().overflow_hidden().child(l.replace(/ /g, "\u00a0") || "\u00a0"))),
    );
  }

  hints(t) {
    const key = (k, what) => h_flex().flex_none().gap(5).items_center()
      .child(div().px(5).h(17).rounded(4).border(1).border_color(t.border).text_size(10).text_color(t.muted).flex().items_center().child(k))
      .child(div().text_color(t.dim).child(what));
    return h_flex().flex_none().gap(14).items_center().text_size(11)
      .child(key("↑↓", "move"))
      .child(key("↵", "go"))
      .child(key("tab", "next list"))
      .child(key("ctrl-d", "close"))
      .child(key("esc", "leave"));
  }

  render(cx) {
    const t = theme();
    const now = Date.now();
    const all = build(this.model());
    const listed = inView(all, this.view, Boolean(this.query.trim()));
    const found = order(search(listed, this.query), this.recent());
    this.shown = found;

    // Keep the selection on the same row as the list changes under it.
    const kept = this.picked ? found.findIndex((f) => f.row.key === this.picked) : -1;
    if (kept >= 0) this.at = kept;
    else if (this.at === null) this.at = this.query.trim() ? 0 : firstPick(found);
    this.at = Math.max(0, Math.min(this.at, found.length - 1));
    this.picked = found[this.at]?.row.key ?? null;
    const sel = found[this.at]?.row ?? null;
    this.followPreview(cx);

    // Only the rows in view are drawn; the list scrolls just enough to keep the selection in it.
    const height = Math.min(LIST, this.listHeight);
    const maxScroll = Math.max(0, found.length * ROW - height);
    if (this.at * ROW < this.scroll) this.scroll = this.at * ROW;
    if ((this.at + 1) * ROW > this.scroll + height) this.scroll = (this.at + 1) * ROW - height;
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const first = Math.floor(this.scroll / ROW);
    const last = Math.min(found.length, Math.ceil((this.scroll + height) / ROW));
    const wide = !this.width || this.width >= PREVIEW_MIN;

    const empty = this.query.trim() ? `Nothing matches "${this.query.trim()}"${this.view === "all" ? "" : " in this list. Tab switches lists"}.` : "Nothing here.";

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
        if (k === "escape") return this.close();
        if (k === "down" || (m.control && (k === "n" || k === "j"))) this.select(this.at + 1);
        else if (k === "up" || (m.control && (k === "p" || k === "k"))) this.select(this.at - 1);
        else if (k === "pagedown") this.select(Math.min(found.length - 1, this.at + Math.floor(height / ROW)));
        else if (k === "pageup") this.select(Math.max(0, this.at - Math.floor(height / ROW)));
        else if (k === "tab") {
          const i = VIEWS.findIndex((v) => v.id === this.view);
          this.setView(VIEWS[(i + (m.shift ? VIEWS.length - 1 : 1)) % VIEWS.length].id);
        } else if (k === "d" && m.control) this.shut(sel);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex().h(38).flex_none().px(11).gap(9).items_center().rounded(10).border(1).border_color(t.accent).bg(t.background)
          .child(svg("mods/bar/search.svg").size(15).flex_none().text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(13.5).text_color(t.foreground))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(found.length === listed.length ? `${found.length}` : `${found.length} of ${listed.length}`)),
      )
      .child(this.chips(t, counts(all)))
      .child(
        h_flex().flex_none().gap(12).items_start()
          .child(
            div()
              .id("bar-list")
              .relative()
              .when(wide, (el) => el.w(0).flex_1())
              .when(!wide, (el) => el.w_full())
              .h(LIST)
              .min_h(0)
              .overflow_hidden()
              .on_size_change((size, cx) => {
                this.listHeight = size.height / (settings().zoom ?? 1);
                cx.notify();
              })
              .on_scroll_wheel((e, cx) => {
                this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
                // The selection follows the wheel, so the next frame doesn't scroll back to it.
                const top = Math.ceil(this.scroll / ROW);
                const bottom = Math.floor((this.scroll + height) / ROW) - 1;
                if (found.length) this.select(Math.max(top, Math.min(this.at, bottom)));
                cx.notify();
              })
              .when(!found.length, (el) => el.child(v_flex().size_full().items_center().justify_center().text_size(12.5).text_color(t.dim).child(empty)))
              .children(found.slice(first, last).map((f, i) => this.row(t, f, first + i, now))),
          )
          .when(wide, (el) => el.child(this.previewPane(t, sel, LIST))),
      )
      .child(this.hints(t));
  }
}
