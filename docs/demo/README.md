# The README's film and picture

[demo.mp4](../media/demo.mp4), [demo.gif](../media/demo.gif) and [preview.png](../../preview.png)
show the real mod in the real Herdr app, on a stage that is synthetic from end to end. Nothing
in them comes from a real project, machine or person.

**Real:** the Herdr app, herdr-core, this repository's mod, and the key presses.

**Synthetic:**

- **The agents.** [bin/agent](bin/agent) is a script, started under the names `claude` and
  `codex`. It reports the status it is given with OSC 7501, as those agents do, draws a few
  lines and waits. It never calls a model.
- **The projects.** `~/code/shop`, `~/code/api`, `~/code/docs` and studio's `code/search` are
  empty git repositories.
- **The machines.** This computer and studio are two herdr-core cores on one Mac, each with a
  home of its own in one folder under `/tmp`. That is why studio's folders read `/private/tmp/…`.
- **The app.** A second Herdr app whose home is that folder, with the welcome already seen and
  usage reports off.

Nothing of yours is read or written, and your own spaces and agents don't show.

## Film it again

```sh
sh docs/demo/record.sh
```

It needs the Herdr app, herdr-core, python3 and ffmpeg, on a Mac.

- **[stage.sh](stage.sh)** starts the two cores and the second app, and prints the stage's
  folder. `stage.sh --down <folder>` stops everything and deletes it.
- **[scene.sh](scene.sh)** starts the cast: agents in every status, a sub-agent and two shells.
- **[film.sh](film.sh)** presses the keys and films. The app draws every frame itself
  (`herdr-app shot`), about 60 a second, so only its own window is in the film and no screen
  recording permission is involved.
- **[record.sh](record.sh)** runs the three and takes the stage down.

Three things to know before you run it:

- **The keys need the Accessibility permission** for the program you run the script from
  (System Settings > Privacy & Security > Accessibility). They are posted to the stage's app
  alone, so they never reach the window you are typing in.
- **The second app's window comes to the front once,** when it opens.
- **Starting the Herdr app installs an app update that was waiting,** as any start does.
