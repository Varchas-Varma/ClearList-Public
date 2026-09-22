## Clearlist 0.1.4

- Uses one background-relative hover highlight throughout the app, including sidebar lists.
- Adds Ctrl+click, hover selection controls, and Ctrl+Up/Down/Home/End range selection. The selection modifier is reassignable.
- Applies keyboard moves, drag moves, deletion, completion, uncompletion, subtask creation, renaming, duplication, and importance changes to selected groups.
- Adds a scrollable details summary with the first line of every selected task/subtask note and all attached images in order.
- Adds separate, confirmed purge buttons for completed and incomplete tasks in the current list. Opposite-status descendants are preserved.
- Exposes completed-section collapse/expand and the new selection and purge hotkeys in Settings. New action hotkeys are unassigned; the selection modifier defaults to Ctrl.
- Saves group moves and destructive changes atomically. Existing task data, preferences, and update signing identity are preserved.

From 0.1.3, use Settings → Updates or accept the update notice. Older installations need one manual installation over the existing app. Choose x64 for Intel/AMD Windows, or ARM64 for Windows on ARM, including an ARM Windows virtual machine. Updates verify signatures before installation. Windows Authenticode signing is not configured, so an initial installer may show an unknown-publisher warning.
