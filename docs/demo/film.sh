#!/bin/sh
# Films the bar on a stage that scene.sh has filled: opens it with its key, moves through
# the list, searches, switches lists and goes to an agent, pressing real keys.
#
#   sh docs/demo/film.sh <stage folder>
#
# Writes docs/media/demo.mp4 (60 frames a second), docs/media/demo.gif (30, smaller, for the
# README) and preview.png (a still). The app draws every frame itself (`herdr-app shot`), so nothing but its own
# window is in the film and no screen recording permission is involved. The keys are posted
# to the stage's app alone, wherever its window is; that needs the Accessibility permission
# for the program running this script (System Settings > Privacy & Security).
set -eu
kit=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$kit/../.." && pwd)
w=${1:?usage: film.sh <stage folder>}
ffmpeg=$(command -v ffmpeg 2>/dev/null || echo /opt/homebrew/bin/ffmpeg)
[ -x "$ffmpeg" ] || { echo "needs ffmpeg" >&2; exit 2; }
# shellcheck disable=SC1091
. "$w/env.sh"
mkdir -p "$repo_root/docs/media"
# The film opens in the first tab of the shop, with nothing over it.
herdr-app do overlay.close >/dev/null 2>&1 || :
herdr-app do space.select --index 3 >/dev/null
herdr-app do tab.select --index 1 >/dev/null
sleep 1
rm -rf "$w/frames"
mkdir -p "$w/frames"

python3 - "$w" "$ffmpeg" "$repo_root/docs/media" <<'PY'
import ctypes, ctypes.util, json, subprocess, sys, threading, time

stage, ffmpeg, media = sys.argv[1:4]
frames = f"{stage}/frames"
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
    sys.exit("the program running this needs the Accessibility permission to press keys")

# Virtual key codes of a US keyboard.
CODES = dict(zip("asdfhgzxcv", range(10)), b=11, q=12, w=13, e=14, r=15, y=16, t=17, o=31, u=32, i=34, p=35, l=37,
             j=38, k=40, n=45, m=46, enter=36, tab=48, delete=51, escape=53, down=125, up=126)
FLAGS = {"shift": 1 << 17, "ctrl": 1 << 18, "cmd": 1 << 20}


def key(name, *modifiers, rest=0.12):
    flags = sum(FLAGS[m] for m in modifiers)
    for down in (True, False):
        event = cg.CGEventCreateKeyboardEvent(None, CODES[name], down)
        cg.CGEventSetFlags(event, flags)
        cg.CGEventPostToPid(pid, event)
        cf.CFRelease(event)
        time.sleep(0.012)
    time.sleep(rest)


def type_(text, rest=0.085):
    for c in text:
        key(c, rest=rest)


def erase(n):
    for _ in range(n):
        key("delete", rest=0.04)


# The camera: threads that ask the app for its latest frame as fast as it gives them.
filming = True
shots = []


def camera(k):
    i = 0
    while filming:
        path = f"{frames}/{k}-{i:05d}.png"
        at = time.monotonic()
        if subprocess.run(["herdr-app", "shot", path], capture_output=True).returncode == 0:
            shots.append((at, path))
        i += 1
        # A breath between frames: asked without one, the app is too busy to take keys.
        time.sleep(0.006)


# Two cameras with that breath take about 60 frames a second.
crew = [threading.Thread(target=camera, args=(k,)) for k in range(2)]
for c in crew:
    c.start()

time.sleep(1.8)
key("k", "cmd", rest=1.6)  # the bar drops, on the agent that needs you
status = json.loads(subprocess.run(["herdr-app", "status"], capture_output=True, text=True).stdout)
if "bar" not in status["overlays"]:
    filming = False
    sys.exit("the bar didn't open: the key never reached the app")
opened_at = time.monotonic()
for _ in range(4):  # down the list: the preview follows
    key("down", rest=0.8)
time.sleep(0.5)
type_("studio")  # another machine's agents
time.sleep(1.4)
erase(6)
time.sleep(0.3)
key("tab", rest=0.9)  # Needs you
key("tab", rest=0.9)  # Working
key("tab", rest=0.9)  # Done
key("tab", "shift", rest=0.25)
key("tab", "shift", rest=0.25)
key("tab", "shift", rest=0.6)  # All again
type_("login")  # by what the agent is doing
time.sleep(1.3)
key("enter", rest=2.5)  # there

filming = False
for c in crew:
    c.join()

# Each frame lasts until the next one was taken; ffmpeg evens that out to a steady rate.
# The first frames can still be of what the window showed before: left out.
shots.sort()
shots = [s for s in shots if s[0] - shots[0][0] > 0.6]
with open(f"{stage}/frames.txt", "w") as f:
    for (at, path), (then, _) in zip(shots, shots[1:]):
        f.write(f"file '{path}'\nduration {then - at:.4f}\n")
    f.write(f"file '{shots[-1][1]}'\n")
took = shots[-1][0] - shots[0][0]
print(f"{len(shots)} frames in {took:.1f}s: {len(shots) / took:.0f} a second")

# The still: the bar open on its first row, a moment before the first key moves it.
opened = next(path for at, path in shots if at > opened_at - 0.5)
subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", opened, "-vf", "scale=1920:-2:flags=lanczos",
                f"{media}/../../preview.png"], check=True)

source = ["-f", "concat", "-safe", "0", "-i", f"{stage}/frames.txt"]
quiet = [ffmpeg, "-loglevel", "error", "-y"]
subprocess.run(quiet + source + ["-vf", "fps=60,scale=1920:-2:flags=lanczos", "-c:v", "libx264", "-preset", "slow",
                                 "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{media}/demo.mp4"], check=True)
subprocess.run(quiet + source + ["-vf", "fps=30,scale=1200:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];"
                                 "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", f"{media}/demo.gif"], check=True)
PY
rm -rf "$w/frames" "$w/frames.txt"
ls -l "$repo_root/docs/media"
