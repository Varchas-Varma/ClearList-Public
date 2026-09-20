# Clearlist 0.1.2

A small, local Windows desktop to-do app: lists, tasks, nested subtasks visible in the main list, plain notes, and pasted images. No accounts, cloud services, calendars, reminders, telemetry or automatic updater. The layout follows familiar list-management conventions with original styling and icons.

## Quick start

Download **Clearlist-0.1.2-windows-installer** from the latest successful **Actions → Windows installer** run in this repository, extract the ZIP, close Clearlist, and run `Clearlist_0.1.2_x64-setup.exe`. Install over 0.1.0 or 0.1.1 to retain your existing lists, notes, and images. Old steps become subtasks automatically on first launch.

Version 0.1.2 adds a Settings panel, reassignable shortcuts, three full colour wheels with hex input, and a collapsible sidebar. It keeps the visible, nested subtasks from 0.1.1; drag tasks onto tasks to nest them or into gaps to reorder/promote them. The keyboard follows the same model. Task inputs disable saved-entry suggestions. The installer remains unsigned. Builds run the required frontend/native compilation plus focused upgrade and hierarchy checks; Rust dependencies are cached.

Install the Windows prerequisites below, extract the project, then open the **clearlist** folder in VS Code. Run commands from the folder containing `package.json` and `Cargo.toml`:

```powershell
npm install
npm run tauri dev
```

Build an optimized executable and an NSIS installer for the current Windows account:

```powershell
npm run tauri build
```

The first build downloads Rust crates and packaging tools; later builds reuse them. No global Tauri CLI, Corepack, database server, Docker, or administrator rights are needed for ordinary use.

## Windows and VS Code setup

Use native Windows PowerShell and the Rust **MSVC** toolchain. A WSL build targets Linux.

1. Install [Git for Windows](https://git-scm.com/downloads/win), or run:

   ```powershell
   winget install --id Git.Git -e
   ```

2. Install **Node.js 24 LTS** from the [official Windows download page](https://nodejs.org/en/download). npm is included. The project requires Node 24; verification used Node 24.19.0 with npm 11.9.0. Corepack is unnecessary because the project uses npm.

3. Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Select **Desktop development with C++** and include the MSVC x64/x86 C++ tools plus a Windows 10 or Windows 11 SDK. Visual Studio 2022 Build Tools with MSVC v143 is a supported choice. The full Visual Studio editor is unnecessary. Installing prerequisites can request elevation; the app itself does not require it.

4. Install Rust through [rustup](https://rustup.rs/), or:

   ```powershell
   winget install --id Rustlang.Rustup -e
   ```

   Restart PowerShell and VS Code, then run:

   ```powershell
   rustup default stable-msvc
   rustup component add rustfmt clippy
   rustup show
   ```

   On an x64 PC the active toolchain should use `x86_64-pc-windows-msvc`, not a GNU target. The checked-in `rust-toolchain.toml` requests stable Rust plus rustfmt and Clippy.

5. Confirm **Microsoft Edge WebView2 Runtime** is listed in Windows Settings → Apps → Installed apps. If missing, install the **Evergreen Bootstrapper** from [Microsoft's WebView2 page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The release installer also downloads the bootstrapper if required. First installation can need internet access; normal app use is offline.

6. Install [VS Code](https://code.visualstudio.com/Download), then use File → Open Folder to open the extracted **clearlist** folder, or:

   ```powershell
   cd C:\path\to\clearlist
   code .
   ```

   Clone this repository using its **Code** menu, or extract the source ZIP. Open the project root containing `package.json` and `Cargo.toml`.

7. Accept the workspace's recommended extensions, or install them explicitly:

   ```powershell
   code --install-extension rust-lang.rust-analyzer
   code --install-extension tauri-apps.tauri-vscode
   code --install-extension dbaeumer.vscode-eslint
   code --install-extension esbenp.prettier-vscode
   ```

8. Open a new VS Code terminal and verify your tools, install dependencies, then start:

   ```powershell
   git --version
   node --version
   npm --version
   rustc --version
   cargo --version
   npm install
   npm run tauri dev
   ```

   Use `npm ci` instead of `npm install` for an exact reinstall from the lockfile. If PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run tauri dev`; changing execution policy is unnecessary.

These steps follow the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows) and [Windows packaging documentation](https://v2.tauri.app/distribute/windows-installer/).

## Development and verification commands

| Command                                                       | Purpose                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run tauri dev`                                           | Native desktop app with frontend hot reload                      |
| `npm run tauri build`                                         | Release executable and installer for the current OS              |
| `npm run build`                                               | Strict type check and production frontend assets                 |
| `npm test`                                                    | Vitest and React Testing Library tests                           |
| `npm run test:watch`                                          | Frontend tests in watch mode                                     |
| `cargo test`                                                  | SQLite, migration, ordering and file-integrity tests             |
| `cargo test --workspace`                                      | Also compile/test the desktop host; requires native dependencies |
| `npm run lint`                                                | ESLint                                                           |
| `npm run typecheck`                                           | Strict TypeScript, including test sources                        |
| `npm run format`                                              | Prettier formatting                                              |
| `npm run format:check`                                        | Check Prettier formatting                                        |
| `cargo fmt --all -- --check`                                  | Check Rust formatting                                            |
| `cargo clippy -p clearlist-core --all-targets -- -D warnings` | Lint the Rust persistence core                                   |
| `npm run check`                                               | Formatting, lint, types, frontend tests and Rust core tests      |
| `npm run reset:dev`                                           | Move development data to a backup and reset next launch          |

VS Code Terminal → Run Task exposes development, release, and test commands. Ctrl+Shift+B builds the desktop release. Frontend formatting uses Prettier; Rust formatting uses rust-analyzer. Development logs include the data-directory path and backend errors. Use the development WebView's inspect/devtools interface to debug React. No launch configuration is included because browser-attached WebView debugging requires additional machine-specific configuration.

`npm run dev` alone serves frontend assets. It does not supply SQLite or implement a browser edition; use `npm run tauri dev` for the real application.

## Windows artifacts and app updates

Because this is a Cargo workspace, artifacts are written to the root **target** directory:

- Executable: `target\release\clearlist.exe`
- x64 installer: `target\release\bundle\nsis\Clearlist_0.1.2_x64-setup.exe`

The architecture suffix changes for a different target. An explicit `--target` adds the target triple under `target`; Tauri prints exact paths at the end. `src-tauri/tauri.windows.conf.json` automatically selects NSIS and `currentUser` installation. The installer handles a missing WebView2 runtime. Builds are unsigned because no signing certificate is configured.

To update an installed copy, close Clearlist and run the new installer. Version 0.1.1 migrates the database transactionally; do not reopen the upgraded database in 0.1.0. You can back up the data directory before upgrading. Keep `com.clearlist.desktop` as the identifier to retain the same data directory. There is no automatic update service.

The app name is set in `src-tauri/tauri.conf.json`, the sidebar brand, and `index.html`. The Rust package name controls the executable basename. Changing the bundle identifier changes the data-directory location and requires updating the reset script. Keep the published identifier unchanged when releasing updates. The original icon is `src-tauri/icons/source.svg`; regenerate its platform sizes with `npm run tauri icon src-tauri/icons/source.svg`.

## Using Clearlist

- **Lists:** Create with New list. Double-click a custom list name or choose Rename. Enter or focus loss saves; Escape cancels. Duplicate names are allowed. Tasks is fixed in place and cannot be deleted.
- **Tasks:** Type and press Enter to add. Single-click selects; double-click the title or choose Rename to edit. Use the checkbox to complete and the star to mark important. The action menu supports moving, duplication, and deletion.
- **Reordering:** Drag the visible grip onto a task to make it a subtask, or into a gap to reorder or promote it. Drop targets are outlined; dragging starts only after 6 pixels of movement. Active and completed tasks are sorted independently. Drag a task onto a sidebar list to move it. Search results use explicit move commands and cannot be reordered.
- **Keyboard moves:** From task entry, Up/Down focuses a task and keeps the unfinished draft. Enter picks it up. Up/Down then visits insertion gaps and task rows. Enter on a gap places it there; Enter on a task makes it a subtask. Right on a task enters its subtasks so you can choose a position; Left returns to its parent level. Escape cancels without changing data. Menus also offer Move up, Move down, and Make top-level task.
- **Subtasks:** Shown under their parent in the main list. Each has the same title, checkbox, notes, images, grip, and actions as a top-level task. Moving a task carries its entire subtree and content. Use the chevron to collapse/expand a branch; Insert adds a subtask. A task cannot be moved into itself or its descendants.
- **Notes:** Plain multiline text, saved 450 ms after typing stops. Blur, selecting another task, and normal app shutdown flush pending changes. A failed draft remains available with a retry action even after changing selection.
- **Images:** Select a task and paste into the detail/notes area, or while no unrelated text field is being edited. PNG, JPEG and WebP are supported, up to **15 MiB (15,728,640 bytes)** and **40 million pixels** each. Rust verifies the actual format and decodes within a memory limit. Original bytes are preserved. Clipboard images exposed as files in copied HTML are supported; remote image URLs are not downloaded. A paste containing image files attaches the images and omits accompanying clipboard text/filenames. Ordinary text-only paste remains unchanged. Multiple images attach independently.
- **Preview and deletion:** Click a thumbnail for a larger in-app preview. Missing files show Image unavailable with Retry. Image, task, and list deletion require confirmation; task/list confirmation explains dependent data removal.
- **Search:** Case-insensitive matching across task titles, steps and notes in all lists, with the originating list shown. No advanced filters or query syntax.

### Settings and colours (0.1.2)

Open **Settings** using the gear at the bottom of the sidebar. It stays available when the sidebar is collapsed.

- **Main colour:** task-list background and primary surfaces.
- **Side colour:** sidebar and task-details background.
- **Complement colour:** highlights, buttons, and accents.

Each control has a complete hue/saturation wheel, keyboard-accessible hue/saturation/brightness sliders, and a hex field accepting `#RGB` or `#RRGGBB` (the `#` is optional). Press Enter or leave the field to apply a hex value. Invalid values show an error and retain the previous colour. Changes preview immediately and save automatically; text and border colours are derived for readability. **Reset colours to system theme** restores automatic light/dark colours.

Click the sidebar's collapse/expand button to switch between the full sidebar and a compact rail. The rail keeps search, New list, and Settings available. Search and new-list shortcuts automatically expand the sidebar. The collapsed state persists between launches.

### Reassigning hotkeys (0.1.2)

Open **Settings → Hotkeys**, find an action, click its current shortcut or **Unassigned**, and press the desired key combination. **Clear** removes an assignment. **Reset hotkeys** restores the defaults below. Conflicting assignments are rejected and identify the existing action; clear that action first to reuse the combination. Escape cancels recording and Tab leaves it.

All 46 app commands are listed, including navigation, task actions, search, list creation and management, settings, sidebar visibility, notes, and image actions. Actions without a previous default are **Unassigned** until configured. For example, assign `N` to **Jump to Add a task** for a single-key entry shortcut. Single-letter shortcuts do not interrupt typing. Modified app shortcuts such as Ctrl+N still work from text fields; task mutations do not run while typing. Standard text editing/paste, Tab focus movement, Windows shortcuts, and Escape in dialogs remain available. Image preview/delete targets the focused image, or the first image of the current task; normal Ctrl+V pastes images.

The task footer and task-action menus display your current bindings. Task/list actions operate on the focused task or current task/list. Protected default-list actions remain unavailable. Reassigning an existing shortcut removes its old binding; Escape remains available as a cancel key.

Preferences save locally in the app's WebView storage, separate from the task database, and survive normal restarts and in-place updates using the same app identity. A manual copy of only `clearlist.db` does not include these preferences. This release does not change the task database schema.

### Default shortcuts

| Shortcut              | Action                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| Up / Down             | Browse siblings; from task entry, keep the draft and focus the last / first task |
| Enter on a task       | Pick up the task; arrow keys then visit task rows and insertion gaps             |
| Enter while moving    | Drop at the highlighted gap, or as a subtask of the highlighted task             |
| Right / Left          | Enter subtasks / return to parent level, including while moving                  |
| Escape                | Cancel a move/edit, or close details and return to task entry                    |
| Home / End            | First / last sibling or drop position                                            |
| F2                    | Rename focused task                                                              |
| Delete                | Confirm removal of focused task and its subtree                                  |
| Space                 | Complete / uncomplete focused task                                               |
| Insert                | Add a subtask to focused task                                                    |
| Ctrl+Enter            | Open task details                                                                |
| Ctrl+D                | Duplicate focused task and its subtree                                           |
| Ctrl+N / Ctrl+Shift+N | New task / new list                                                              |
| Ctrl+F                | Search                                                                           |
| Tab / Shift+Tab       | Next / previous control                                                          |
| Enter in text entry   | Add item or save title                                                           |

### Saved ordering

A list retains a combined manual task order. Completing a task hides it from the active section while keeping its saved slot. Active reordering exchanges only active slots; uncompleting restores the task to that saved slot relative to the current order. Completed tasks have a separate reorderable completion order. Moving to another list appends to the destination's saved order and, if completed, its completed section. Duplication creates an active task with the same title, notes, importance and steps, plus independent copies of its images. Step completion is retained.

## Local data, backup, and reset

Windows release data:

```text
%LOCALAPPDATA%\com.clearlist.desktop\
  clearlist.db
  clearlist.db-wal      (may exist while running)
  clearlist.db-shm      (may exist while running)
  attachments\         (UUID filenames, original image bytes)
```

Debug builds use the separate `development` subdirectory, so development does not modify release data. Linux uses `$XDG_DATA_HOME/com.clearlist.desktop`, normally `~/.local/share/com.clearlist.desktop`; macOS uses `~/Library/Application Support/com.clearlist.desktop`. Debug builds append `development` on each OS.

**Back up:** Close the app normally, then copy the entire directory, including attachments and any SQLite sidecars:

```powershell
$clearlistData = Join-Path $env:LOCALAPPDATA 'com.clearlist.desktop'
$clearlistBackup = Join-Path $env:USERPROFILE ('Documents\Clearlist-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Copy-Item -LiteralPath $clearlistData -Destination $clearlistBackup -Recurse
```

To restore, close Clearlist, move the current directory aside, and copy the complete backup into place. Do not combine a database with attachments from a different backup.

**Reset development:** Close the development app, run `npm run reset:dev`, and type `RESET`. The script renames only development data to a timestamped backup. The next launch creates a fresh database. Source and release data are untouched.

## Architecture and data integrity

| Area                            | Responsibility                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `src/components`                | Focused React components and native HTML dialogs                                    |
| `src/domain.ts`                 | Shared strict domain types, validation and linear search                            |
| `src/state/store.ts`            | Zustand, serialized writes, optimistic updates, reconciliation after failure        |
| `src/state/notes.ts`            | Debounced drafts independent of component lifetime; retry and shutdown flush        |
| `src/dnd`                       | dnd-kit sensors, bounded drop scopes, shared reorder commands                       |
| `src/services`                  | Typed Tauri calls, binary image transfer, clipboard extraction                      |
| `src-tauri`                     | Native window, single-instance guard, privileged commands on background workers     |
| `crates/core`                   | rusqlite with bundled SQLite, transactions, image validation and scoped file access |
| `crates/core/migrations`        | Versioned schema using SQLite `user_version`                                        |
| `src/test`, `crates/core/tests` | Frontend interaction and real database/file integration tests                       |

SQLite enables foreign keys, WAL, full synchronization, and a busy timeout. Reorders validate exact membership and normalize positions transactionally. Moves and deletions also use transactions. All IDs are UUIDs. Image metadata contains relative generated filenames; original binary data is stored separately, never in SQLite as base64. The renderer cannot execute SQL or read arbitrary file paths.

Files are written and synced before attachment metadata commits. A failed insert removes the new file. Task/list/image deletions commit first, then remove only app-owned unreferenced files inside the attachment directory. Startup repeats orphan cleanup after interrupted operations. Unknown filenames and symlinks are left alone. Cleanup failures show a warning and retry on another mutation or launch. Duplication copies image files rather than sharing references.

The frontend serializes rapid drops and reapplies pending changes over confirmed snapshots. Rejected writes are reported and persisted data is restored/reloaded. Native close flushes notes and waits for writes before destroying the window; a save failure keeps the window open. Forced process termination or power loss can still lose text inside the debounce interval. The single-instance guard avoids two native app windows competing over ordering.

Light/dark mode follows the OS. The app uses native window chrome, semantic controls, visible focus, labeled buttons, dialog focus containment and dnd-kit announcements. A test-only Rust example, `test_bridge`, provides a JSON-lines adapter to the actual repository for browser smoke testing; it is not linked into or launched by the desktop application.

## Updating dependencies safely

Direct npm versions and both lockfiles are committed. TypeScript 6.0 is used because the selected typescript-eslint release does not support TypeScript 7. dnd-kit core and sortable use their compatible stable sortable API.

Back up app data and commit source before updating. Inspect candidates:

```powershell
npm outdated
cargo update --dry-run
```

Select compatible versions using `npm install package-name@version` or `npm install -D package-name@version`. Update Tauri's Rust crate, JS API and CLI within compatible major versions. Use `cargo update` for intentional Rust updates, inspect both lockfiles, run `npm run check`, `cargo fmt --all -- --check`, and `npm run tauri build`, then repeat the smoke checklist in `docs/VERIFICATION.md`. Add new numbered migrations for released schema changes; never edit an already-deployed migration. Avoid force-upgrading dependencies blindly.

## Troubleshooting and verification limits

- Missing `link.exe` or Windows SDK: install the C++ workload and SDK, restart VS Code, and confirm an MSVC Rust toolchain.
- Missing/blank native window: verify WebView2 and inspect the development terminal logs.
- Port 1420 busy: close the other Vite process. Both the host and frontend use this fixed port.
- Disk or data-directory unavailable: the startup screen offers Retry. The app never silently falls back to temporary storage.
- Missing image: restore its file from backup or delete its metadata using the app. Duplication fails visibly if it cannot copy an original image.
- Linux native build: Tauri requires WebKitGTK 4.1 and other Linux development packages. `cargo test` for the core and frontend checks do not require a desktop WebView.

See `docs/VERIFICATION.md` for actual command results and remaining native Windows checks. This project uses the MIT license; dependencies retain their own licenses.

## Release maintenance

Update this README with every release: current version and installer name, changed features, settings, shortcut defaults, upgrade instructions, and actual verification results. Keep package, Cargo, Tauri, lockfile, and workflow artifact versions synchronized.
