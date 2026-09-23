## Clearlist 0.1.4.1

- Fixes shortcut recording after clicks that do not transfer keyboard focus, including macOS WKWebView.
- Adds explicit Cancel recording, Escape/Tab cancellation, and cancellation when the app loses focus.
- Accepts Command shortcut reassignment on Mac and displays Cmd/Option labels.
- Uses Mac defaults: Cmd+N/F/Shift+N/D/Enter, Cmd+click and Cmd+Up/Down selection, Cmd+R rename, Cmd+Delete removal, Cmd+Shift+Enter subtask creation, Option+Up/Down first/last task, and Cmd+, for Settings.
- Migrates unchanged legacy defaults on Mac while preserving custom shortcuts, cleared actions, and bindings that would conflict. Reset hotkeys applies all platform defaults.
- Preserves standard copy/paste/undo shortcuts, task data, themes, and the updater signing identity. Windows defaults remain unchanged.

Install through Settings → Updates on 0.1.3 or later. Windows downloads include x64 and ARM64 installers. The universal macOS DMG supports Apple Silicon and Intel Macs on macOS 13.3 or later. Drag Clearlist to Applications; the ad-hoc signed app is not Apple-notarized, so an initial manual installation may require System Settings → Privacy & Security → Open Anyway.

Public release: 0.1.4.1. Native/updater SemVer: 0.1.5. The previous app may label this update 0.1.5; the installed app displays 0.1.4.1.
