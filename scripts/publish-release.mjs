import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { version } from './release-version.mjs';

const repo = process.env.GITHUB_REPOSITORY;
assert.ok(repo);
const tag = `v${version}`;
const dir = 'release-assets';
const files = readdirSync(dir);
const platforms = {};
const pubkey = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).plugins.updater.pubkey;
const decodedKey = Buffer.from(pubkey, 'base64').toString('utf8').trim().split(/\r?\n/);
const key = Buffer.from(decodedKey[1], 'base64');
assert.equal(key.length, 42);
const publicKey = createPublicKey({
  key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]),
  format: 'der',
  type: 'spki',
});

for (const [arch, platform] of [
  ['x64', 'windows-x86_64'],
  ['arm64', 'windows-aarch64'],
]) {
  const name = `Clearlist_${version}_${arch}-setup.exe`;
  assert.ok(
    files.includes(name) && files.includes(`${name}.sig`),
    `Missing signed ${arch} installer`,
  );
  assert.ok(statSync(`${dir}/${name}`).size > 100000, `Invalid ${arch} installer`);
  const data = readFileSync(`${dir}/${name}`);
  const signature = readFileSync(`${dir}/${name}.sig`, 'utf8').trim();
  const lines = Buffer.from(signature, 'base64').toString('utf8').trim().split(/\r?\n/);
  const packet = Buffer.from(lines[1], 'base64');
  assert.equal(packet.length, 74);
  assert.ok(
    packet.subarray(2, 10).equals(key.subarray(2, 10)),
    'Signing key does not match the app',
  );
  const algorithm = packet.subarray(0, 2).toString();
  assert.ok(['Ed', 'ED'].includes(algorithm));
  const message = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  assert.ok(
    verify(null, message, publicKey, packet.subarray(10)),
    `Invalid ${arch} update signature`,
  );
  platforms[platform] = {
    url: `https://github.com/${repo}/releases/download/${tag}/${name}`,
    signature,
  };
}
const notes = readFileSync('docs/RELEASE_NOTES.md', 'utf8');
writeFileSync(
  `${dir}/latest.json`,
  JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2) + '\n',
);
writeFileSync(
  `${dir}/SHA256SUMS.txt`,
  files
    .filter((name) => name.endsWith('.exe'))
    .sort()
    .map(
      (name) =>
        `${createHash('sha256')
          .update(readFileSync(`${dir}/${name}`))
          .digest('hex')}  ${name}`,
    )
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
