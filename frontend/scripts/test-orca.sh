#!/bin/sh
# Optional focused screen-reader smoke; Linux, Orca, Firefox Playwright,
# DBus, Xvfb, openbox, xdotool and Speech Dispatcher/PulseAudio are required.
set -eu
for executable in orca dbus-run-session xvfb-run openbox pactl xdotool; do
 command -v "$executable" >/dev/null 2>&1 || { echo "Missing prerequisite: $executable" >&2; exit 1; }
done
if ! pactl info >/dev/null 2>&1; then
 command -v pulseaudio >/dev/null 2>&1 || { echo 'Start an audio session or install PulseAudio.' >&2; exit 1; }
 pulseaudio --start --exit-idle-time=120 --high-priority=no --realtime=no
fi
status=0
for scenario in search settings layout group incident asset map import; do
 if dbus-run-session -- xvfb-run -a env LC_ALL=C.UTF-8 GTK_MODULES=atk-bridge NO_AT_BRIDGE=0 MOZ_ACCESSIBILITY_FORCE_ENABLED=1 node tests/accessibility/orca.mjs "$scenario"; then :; else
  echo "INCOMPLETE OR FAILED: Orca scenario $scenario requires investigation or human review" >&2
  status=1
 fi
done
exit "$status"
