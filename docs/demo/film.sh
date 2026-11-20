#!/bin/sh
# Films the bar on a showcase stage (~/workspace/herdr/herdr-showcase), pressing real keys:
# it drops over the cockpit, the selection moves down with the preview following, ⌘. opens a
# sub-agent's actions, "on:studio" and "is:working" turn into pills, "flaky" leaves one agent
# and Enter goes there.
#
#   sh docs/demo/film.sh <stage folder>          film, then write the media
#   sh docs/demo/film.sh <stage folder> --dry    press the keys with the window behind, no film
#
# Writes docs/media/demo.mp4 (full size), docs/media/demo.gif (1200 px, for the README) and
# preview.png (a still: the bar open on the agent that needs you, the window dimmed around it).
#
# A burst of shoot.sh can't press keys between its frames, so this does what shoot.sh does
# around its pictures, the same way: the lock every stage shares (/tmp/herdr-showcase.lock),
# the wait until nobody has touched the keyboard or mouse for SHOWCASE_IDLE seconds, the
# stage's app in front with the pointer out of its window, and the front and the pointer given
# back at once (about 25 s in front). The app draws every frame itself (`herdr-app shot`), so
# only its own window is in the film. The keys are posted to the stage's app alone
# (CGEventPostToPid), which needs the Accessibility permission for the program running this.
set -eu
here=$(cd "$(dirname "$0")" && pwd -P)
repo=$(cd "$here/../.." && pwd -P)
w=$(cd "${1:?usage: film.sh <stage folder> [--dry]}" && pwd -P)
dry=0; [ "${2:-}" = --dry ] && dry=1
[ -f "$w/env.sh" ] && [ -f "$w/app.pid" ] || { echo "film: not a running stage: $w" >&2; exit 2; }
ffmpeg=$(command -v ffmpeg 2>/dev/null || echo /opt/homebrew/bin/ffmpeg)
[ -x "$ffmpeg" ] || { echo "film: needs ffmpeg" >&2; exit 2; }
_idle=${SHOWCASE_IDLE-}
# shellcheck disable=SC1091
. "$w/env.sh"
kit=$SC_KIT
# shellcheck disable=SC1091
. "$kit/kit.env"
idle=${_idle:-${SHOWCASE_IDLE:-60}}
app_pid=$(cat "$w/app.pid")
alive() { /bin/ps -wwEo command= -p "$app_pid" 2>/dev/null | grep -q "SC_STAGE=$w "; }
alive || { echo "film: the stage's app isn't running" >&2; exit 2; }

# The film opens on the default scene: shop's first tab, nothing over it.
herdr-app do overlay.close >/dev/null 2>&1 || :
herdr-app do space.select --index 1 >/dev/null
herdr-app do tab.select --index 1 >/dev/null
frames="$w/film"
rm -rf "$frames"; mkdir -p "$frames"

osa() { /usr/bin/osascript -l JavaScript -e "ObjC.import('AppKit'); $1" 2>/dev/null || :; }
lock=/tmp/herdr-showcase.lock
held=0 before= pointer=
back() {
  [ -z "$before" ] || osa "\$.NSRunningApplication.runningApplicationWithProcessIdentifier($before).activateWithOptions(2)" >/dev/null
  [ -z "$pointer" ] || /usr/bin/python3 "$kit/lib/pointer.py" put "$pointer" || :
  before= pointer=
}
release() {
  [ $held = 1 ] && [ "$(cat "$lock/pid" 2>/dev/null)" = $$ ] && rm -rf "$lock"
  held=0
}
trap 'back; release' EXIT
trap 'exit 130' INT TERM HUP

if [ $dry = 0 ]; then
  # The lock, as shoot.sh takes it.
  said=0
  until mkdir "$lock" 2>/dev/null; do
    holder=$(cat "$lock/pid" 2>/dev/null || :)
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$lock"; continue; fi
    if [ -z "$holder" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then rm -rf "$lock"; continue; fi
    [ $said = 1 ] || { echo "film: waiting for another stage's picture (pid ${holder:-?})" >&2; said=1; }
    sleep 0.5
  done
  echo $$ > "$lock/pid"
  held=1
  alive || { echo "film: the stage's app isn't running any more" >&2; exit 2; }
  # Nobody at the keyboard.
  idle_s() { s=$(/usr/sbin/ioreg -c IOHIDSystem | awk '/HIDIdleTime/ { print int($NF / 1000000000); exit }'); echo "${s:-0}"; }
  if [ "$idle" -gt 0 ]; then
    said=0
    while [ "$(idle_s)" -lt "$idle" ]; do
      [ $said = 1 ] || { echo "film: waiting until the keyboard and mouse have been still for ${idle}s" >&2; said=1; }
      sleep 1
    done
  fi
  # The front, for the length of the film.
  alive || { echo "film: the stage's app isn't running any more" >&2; exit 2; }
  before=$(osa '$.NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier')
  [ "$before" = "$app_pid" ] && before=
  pointer=$(/usr/bin/python3 "$kit/lib/pointer.py" clear "$app_pid" || :)
  osa "\$.NSRunningApplication.runningApplicationWithProcessIdentifier($app_pid).activateWithOptions(2)" >/dev/null
  # Its mods catch up on what they skipped while it couldn't be seen.
  if [ -f "$w/run/shown" ]; then sleep 1; else sleep 2.5; : > "$w/run/shown"; fi
fi

/usr/bin/python3 - "$w" "$frames" "$dry" <<'PY'
import ctypes, ctypes.util, json, os, subprocess, sys, threading, time

stage, frames, dry = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
pid = int(open(f"{stage}/app.pid").read())

cg = ctypes.CDLL(ctypes.util.find_library("CoreGraphics"))
cf = ctypes.CDLL(ctypes.util.find_library("CoreFoundation"))
ax = ctypes.CDLL(ctypes.util.find_library("ApplicationServices"))
cg.CGEventCreateKeyboardEvent.restype = ctypes.c_void_p
cg.CGEventCreateKeyboardEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint16, ctypes.c_bool]
cg.CGEventSetFlags.argtypes = [ctypes.c_void_p, ctypes.c_uint64]
cg.CGEventPostToPid.argtypes = [ctypes.c_int, ctypes.c_void_p]
cf.CFRelease.argtypes = [ctypes.c_void_p]
ax.AXIsProcessTrusted.restype = ctypes.c_bool
if not ax.AXIsProcessTrusted():
    sys.exit("film: the program running this needs the Accessibility permission to press keys")

# Virtual key codes of a US keyboard.
CODES = dict(zip("asdfhgzxcv", range(10)), b=11, q=12, w=13, e=14, r=15, y=16, t=17, o=31, u=32, i=34, p=35, l=37,
             j=38, k=40, n=45, m=46, enter=36, tab=48, delete=51, escape=53, down=125, up=126, left=123)
CODES.update({".": 47, ";": 41})
SHIFTED = {":": ";"}
FLAGS = {"shift": 1 << 17, "ctrl": 1 << 18, "cmd": 1 << 20}


class Gone(Exception):
    pass


def check():
    """Gives up when the app is gone or its frames stopped coming for 3 s, or after 60 s."""
    try:
        os.kill(pid, 0)
    except OSError:
        raise Gone("the stage's app isn't running any more")
    now = time.monotonic()
    if not dry and now - last_ok[0] > 3:
        raise Gone("the app gave no frame for 3 s")
    if now - started > 60:
        raise Gone("the film ran over a minute")


def key(name, *modifiers, rest=0.12):
    check()
    flags = sum(FLAGS[m] for m in modifiers)
    for down in (True, False):
        event = cg.CGEventCreateKeyboardEvent(None, CODES[name], down)
        cg.CGEventSetFlags(event, flags)
        cg.CGEventPostToPid(pid, event)
        cf.CFRelease(event)
        time.sleep(0.012)
    time.sleep(rest)


def type_(text, rest=0.09):
    for c in text:
        if c in SHIFTED:
            key(SHIFTED[c], "shift", rest=rest)
        else:
            key(c, rest=rest)


def status():
    for _ in range(5):
        try:
            out = subprocess.run(["herdr-app", "status"], capture_output=True, text=True, timeout=3).stdout
            return json.loads(out)
        except (ValueError, subprocess.TimeoutExpired):
            check()
            time.sleep(0.2)
    return {}


def overlays():
    return status().get("overlays", [])


# The camera: threads that ask the app for its latest frame as fast as it gives them.
filming = not dry
shots = []
marks = {}
started = time.monotonic()
last_ok = [started]


def camera(k):
    i = 0
    while filming:
        path = f"{frames}/{k}-{i:05d}.png"
        at = time.monotonic()
        try:
            ok = subprocess.run(["herdr-app", "shot", path], capture_output=True, timeout=3).returncode == 0
        except subprocess.TimeoutExpired:
            ok = False
        if ok:
            shots.append((at, path))
            last_ok[0] = time.monotonic()
        i += 1
        # A breath between frames: asked without one, the app is too busy to take keys.
        time.sleep(0.006)


crew = [threading.Thread(target=camera, args=(k,), daemon=True) for k in range(2)] if not dry else []
for c in crew:
    c.start()

t0 = time.monotonic()
marks["zoom"] = status().get("zoom", 0.9)


def film():
    time.sleep(1.6)  # the cockpit, with nothing over it
    key("k", "cmd", rest=0.05)  # the bar drops, on the agent that needs you
    marks["opened"] = time.monotonic()
    time.sleep(1.9)
    if "bar" not in json.dumps(overlays()):
        raise Gone("the bar didn't open: the key never reached the app")
    time.sleep(0.4)  # the preview reads the agent's screen
    marks["still"] = time.monotonic() - 0.1
    for _ in range(4):  # down the list, the preview following, to the sub-agent
        key("down", rest=0.95)
    key(".", "cmd", rest=1.9)  # what can be done to it
    key("left", rest=0.6)
    type_("on:studio")  # a filter: the other machine's agents
    time.sleep(2.0)
    key("u", "ctrl", rest=0.5)  # clear
    type_("is:working")  # another: what is working, on every machine
    time.sleep(1.9)
    key("u", "ctrl", rest=0.5)
    type_("flaky")  # by what the agent is doing
    time.sleep(1.5)
    if dry:
        print("film: dry run ended on", overlays())
        key("escape", rest=0.3)
        return
    key("enter", rest=2.6)  # there: shop's second tab
    check()


try:
    film()
except Gone as e:
    sys.exit(f"film: {e}")
finally:
    filming = False
    for c in crew:
        c.join(timeout=5)
if dry:
    sys.exit(0)


shots.sort()
took = shots[-1][0] - shots[0][0]
print(f"film: {len(shots)} frames in {took:.1f}s, {len(shots) / took:.0f} a second", file=sys.stderr)
json.dump({"shots": shots, "marks": marks, "t0": t0}, open(f"{frames}/shots.json", "w"))
PY

[ $dry = 1 ] && exit 0
back
release

# Each frame lasts until the next one was taken; ffmpeg evens that out to a steady rate. The
# still: the bar on the agent that needs you, its question and screen read, before the first key.
/usr/bin/python3 - "$frames" <<'PY'
import json, sys
frames = sys.argv[1]
d = json.load(open(f"{frames}/shots.json"))
shots = d["shots"]
# The first frames can still be of what the window showed before it came forward: left out.
shots = [s for s in shots if s[0] - shots[0][0] > 0.4]
with open(f"{frames}/list.txt", "w") as f:
    for (at, path), (then, _) in zip(shots, shots[1:]):
        f.write(f"file '{path}'\nduration {then - at:.4f}\n")
    f.write(f"file '{shots[-1][1]}'\n")
still = max((s for s in shots if s[0] <= d["marks"]["still"]), key=lambda s: s[0])[1]
open(f"{frames}/still.txt", "w").write(still)
open(f"{frames}/zoom.txt", "w").write(str(d["marks"]["zoom"]))
PY

media="$repo/docs/media"
mkdir -p "$media"
q="$ffmpeg -loglevel error -y"
src="-f concat -safe 0 -i $frames/list.txt"
# shellcheck disable=SC2086
# The still dims the window around the bar's panel, as shoot.sh --dim does (0.45). The panel is
# 980 x 571 at the window's zoom, centred, 40 from the top (mod.json), drawn at 2x; a few pixels
# of margin. It is the same whatever the picture's height.
pil=
for p in /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  [ -x "$p" ] && "$p" -c 'import PIL' 2>/dev/null && { pil=$p; break; }
done
if [ -n "$pil" ]; then
  "$pil" - "$(cat "$frames/still.txt")" "$frames/still.png" "$(cat "$frames/zoom.txt")" <<'PIL'
import sys
from PIL import Image, ImageEnhance
img = Image.open(sys.argv[1]).convert("RGB")
z = float(sys.argv[3]) * 2
bw, bh = round(980 * z) + 12, round(571 * z) + 12
x, y = img.size[0] // 2 - bw // 2, round(40 * z) - 6
dark = ImageEnhance.Brightness(img).enhance(0.45)
dark.paste(img.crop((x, y, x + bw, y + bh)), (x, y))
dark.save(sys.argv[2])
PIL
else
  echo "film: no Pillow, so the still isn't dimmed" >&2
  cp "$(cat "$frames/still.txt")" "$frames/still.png"
fi
$q -i "$frames/still.png" -vf "scale=1920:-2:flags=lanczos" "$repo/preview.png"
# shellcheck disable=SC2086
$q $src -vf "fps=60,scale=${MP4_WIDTH:-3200}:-2:flags=lanczos" -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart "$media/demo.mp4"
# shellcheck disable=SC2086
$q $src -vf "fps=${GIF_FPS:-24},scale=1200:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$media/demo.gif"
[ -n "${KEEP_FRAMES:-}" ] || rm -rf "$frames"
ls -l "$media" "$repo/preview.png"
