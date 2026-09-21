import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(JSON.parse(readFileSync('package-lock.json', 'utf8')).version, version);
assert.equal(JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version, version);
for (const file of ['src-tauri/Cargo.toml', 'crates/core/Cargo.toml'])
  assert.equal(readFileSync(file, 'utf8').match(/^version = "([^"]+)"/m)?.[1], version, file);
for (const name of ['clearlist', 'clearlist-core']) {
  const block = readFileSync('Cargo.lock', 'utf8')
    .split('[[package]]')
    .find((s) => s.includes(`name = "${name}"`));
  assert.equal(block?.match(/^version = "([^"]+)"/m)?.[1], version, name);
}
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, `v${version}`);
console.log(`Release version: ${version}`);
