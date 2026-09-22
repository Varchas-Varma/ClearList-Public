import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { version } from './release-version.mjs';
import { macPlatforms, checksum } from './update-artifacts.mjs';

const repo = process.env.GITHUB_REPOSITORY;
assert.ok(repo);
const tag = `v${version}`;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const release = JSON.parse(gh('api', `repos/${repo}/releases/tags/${tag}`));
assert.equal(release.draft, false, 'Publish the Windows release before adding macOS');
assert.equal(JSON.parse(gh('api', `repos/${repo}/releases/latest`)).id, release.id,
  'Only the current release can receive supplemental macOS downloads');
const platforms = macPlatforms();
mkdirSync('existing-release', { recursive: true });
gh('release', 'download', tag, '--repo', repo, '--pattern', 'latest.json', '--pattern', 'SHA256SUMS.txt', '--dir', 'existing-release');
const feed = JSON.parse(readFileSync('existing-release/latest.json', 'utf8'));
assert.equal(feed.version, version);
assert.ok(feed.platforms['windows-x86_64'] && feed.platforms['windows-aarch64']);
feed.platforms = { ...feed.platforms, ...platforms };
const notes = readFileSync('docs/RELEASE_NOTES.md', 'utf8');
feed.notes = notes;

// Publish binaries before the feed references them. Never replace existing installers.
const files = readdirSync('release-assets');
for (const name of files) {
  const existing = release.assets.find((asset) => asset.name === name);
  if (existing) {
    assert.equal(existing.digest, `sha256:${checksum(name).split(' ')[0]}`,
      `Published asset differs: ${name}. Bump the version to replace it.`);
  } else {
    gh('release', 'upload', tag, `release-assets/${name}`, '--repo', repo);
  }
}
const oldChecksums = readFileSync('existing-release/SHA256SUMS.txt', 'utf8').trim().split(/\r?\n/)
  .filter((line) => !files.some((name) => line.endsWith(`  ${name}`)));
writeFileSync('release-assets/SHA256SUMS.txt', [...oldChecksums,
  ...files.filter((name) => !name.endsWith('.sig')).sort().map(checksum)].join('\n') + '\n');
writeFileSync('release-assets/latest.json', JSON.stringify(feed, null, 2) + '\n');
gh('release', 'upload', tag, 'release-assets/SHA256SUMS.txt', 'release-assets/latest.json', '--repo', repo, '--clobber');
gh('release', 'edit', tag, '--repo', repo, '--notes-file', 'docs/RELEASE_NOTES.md');
console.log(`Published macOS downloads: https://github.com/${repo}/releases/tag/${tag}`);
