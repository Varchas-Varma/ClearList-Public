# Clearlist release instructions

Update the README with every release. Keep its version, installer name/link, feature behavior, settings, keyboard shortcuts, and upgrade instructions current. Record actual validation outcomes without claiming unperformed checks.

Keep package.json, package-lock.json, both Cargo package versions, Cargo.lock, src-tauri/tauri.conf.json, and versioned workflow artifact names synchronized for each release. Preserve the existing application identifier and saved data on upgrades.

Use project attribution (`Clearlist contributors <noreply@clearlist.invalid>`) for automated commits. Keep personal contact details and conversation references out of tracked files and commit metadata.

`package.json.releaseVersion` is the public release label used for tags, asset names, and app display. Native/package versions stay valid three-part SemVer and must increase for updater comparisons. Release 0.1.4.1 uses internal version 0.1.5. Keep the public label and internal version distinct when a four-part release label is requested.
