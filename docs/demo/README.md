# The README's film and picture

[demo.mp4](../media/demo.mp4), [demo.gif](../media/demo.gif) and [preview.png](../../preview.png)
show the real mod in the real Herdr app, pressed with real keys, on the showcase stage: one
made-up Herdr world (`~/workspace/herdr/herdr-showcase`) that every mod's README pictures share.
Sam, an engineer at Acme, has agents in every state on a laptop and on a Mac Studio called
`studio`, pull requests, servers and two notifications. Nothing in the film comes from a real
project, machine or person.

**Real:** the Herdr app, herdr-core, this repository's mod as its working tree has it, the
other mods of the window, the author's layout and settings, the Mac's own readings in the
stats, and the key presses.

**Made up:** the agents (a stand-in that draws Claude Code and Codex screens and reports their
states), the projects, `studio` (a second herdr-core on the same Mac), the pull requests, the
servers and scheduled jobs. The kit's README says where each comes from.

The stage is built without the VPN switch (`SHOWCASE_VPN=0`), as every public README's is.

## Film it again

```sh
sh docs/demo/showcase-shots.sh
```

It needs the kit at `~/workspace/herdr/herdr-showcase` (or `SHOWCASE_KIT`), the Herdr app,
herdr-core, ffmpeg and the Accessibility permission for the program you run it from (System
Settings > Privacy & Security > Accessibility), on a Mac.

- **[showcase.sh](showcase.sh)** is the hook the kit's `scene.sh` runs after the default scene:
  nothing open, shop's first tab (Claude Code, "Speed up the checkout page") in front.
- **[film.sh](film.sh)** presses the keys and films. Before it takes the window it does what the
  kit's `shoot.sh` does: it takes the lock every stage shares, waits until the keyboard and
  mouse have been still for a minute (`SHOWCASE_IDLE`), brings the stage's window forward with
  the pointer out of it, and gives the front back as soon as the last key is pressed (about
  25 s). The app draws every frame itself (`herdr-app shot`, two cameras, about 40 frames a
  second), so only its own window is in the film. The keys are posted to the stage's app alone.
  Then it writes the MP4 (3200 px, the window at 2x, 60 frames a second) and the GIF (1200 px,
  24 frames a second, a 128-colour palette).
  It checks that the stage's app is alive after taking the lock and again before taking the
  front, and gives up (freeing the lock) when the app goes away, gives no frame for 3 s, or the
  film runs over a minute. `film.sh <stage> --dry` presses the keys with the window behind,
  without filming.
- **The still** is the last frame before the first key moves the selection: the bar open on
  the agent that needs you, its question and its screen on the right. The window around the
  bar's panel is at 0.45 brightness, as the kit's `shoot.sh --dim` does. The panel's rectangle
  is computed from its size (980 x 571 at the window's zoom, 40 from the top), so the
  picture's height doesn't matter.
- **[showcase-shots.sh](showcase-shots.sh)** builds the stage, runs film.sh and takes the stage
  down. Given a stage folder, it films that stage and leaves it up.

The film can't be a burst of the kit's `shoot.sh`: a burst can't press keys between its frames.

By hand, to try a change on a stage you keep:

```sh
w=$(SHOWCASE_VPN=0 SHOWCASE_HOOK=$PWD/docs/demo/showcase.sh sh ~/workspace/herdr/herdr-showcase/stage.sh)
KEEP_FRAMES=1 sh docs/demo/film.sh "$w"        # the frames stay in $w/film
sh ~/workspace/herdr/herdr-showcase/stage.sh --down "$w"
```

Two things to know:

- **The "Finished" notification leaves during the film.** Herdr's notification clocks run only
  while the window is in front, and a done one leaves 8 s after that, as it would for a person.
  The "Needs permission" one stays.
- **Going to an agent counts as a visit**, and the bar sorts what you visited lately higher. A
  second take on the same stage opens on a different order; build a new stage for each take.
