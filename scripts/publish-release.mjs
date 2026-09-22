import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { version } from './release-version.mjs';
import { signedArtifact, macPlatforms, checksum } from './update-artifacts.mjs';

const repo = process.env.GITHUB_REPOSITORY;
assert.ok(repo);
const tag = `v${version}`;
const dir = 'release-assets';
const files = readdirSync(dir);
const platforms = {
  'windows-x86_64': signedArtifact(`Clearlist_${version}_x64-setup.exe`),
  'windows-aarch64': signedArtifact(`Clearlist_${version}_arm64-setup.exe`),
  ...macPlatforms(),
};
const notes = readFileSync('docs/RELEASE_NOTES.md', 'utf8');
writeFileSync(
  `${dir}/latest.json`,
  JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2) + '\n',
);
writeFileSync(
  `${dir}/SHA256SUMS.txt`,
  files
    .filter((name) => /\.(exe|dmg|tar\.gz)$/.test(name))
    .sort()
    .map(checksum)
    .join('\n') + '\n',
);

function gh(...args) {
  return execFileSync('gh', [...args, '--repo', repo], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}
const existing = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'isDraft'], {
  encoding: 'utf8',
});
if (existing.status === 0) {
  assert.equal(
    JSON.parse(existing.stdout).isDraft,
    true,
    'This version is already published. Bump the version for another release.',
  );
} else {
  gh(
    'release',
    'create',
    tag,
    '--draft',
    '--target',
    process.env.GITHUB_SHA,
    '--title',
    `Clearlist ${version}`,
    '--notes-file',
    'docs/RELEASE_NOTES.md',
  );
}
gh('release', 'upload', tag, ...readdirSync(dir).map((name) => `${dir}/${name}`), '--clobber');
gh('release', 'edit', tag, '--draft=false', '--latest');
console.log(`Published https://github.com/${repo}/releases/tag/${tag}`);
