import { readFileSync, statSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import assert from 'node:assert/strict';
import { releaseVersion } from './release-version.mjs';

export function signedArtifact(name) {
  assert.ok(statSync(`release-assets/${name}`).size > 100000, `Invalid update: ${name}`);
  const pubkey = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).plugins.updater
    .pubkey;
  const key = Buffer.from(
    Buffer.from(pubkey, 'base64').toString().trim().split(/\r?\n/)[1],
    'base64',
  );
  assert.equal(key.length, 42);
  const signature = readFileSync(`release-assets/${name}.sig`, 'utf8').trim();
  const packet = Buffer.from(
    Buffer.from(signature, 'base64').toString().trim().split(/\r?\n/)[1],
    'base64',
  );
  assert.equal(packet.length, 74);
  assert.ok(
    packet.subarray(2, 10).equals(key.subarray(2, 10)),
    'Signing key does not match the app',
  );
  const algorithm = packet.subarray(0, 2).toString();
  assert.ok(['Ed', 'ED'].includes(algorithm));
  const data = readFileSync(`release-assets/${name}`);
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]),
    format: 'der',
    type: 'spki',
  });
  assert.ok(
    verify(
      null,
      algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data,
      publicKey,
      packet.subarray(10),
    ),
    `Invalid update signature: ${name}`,
  );
  console.log(`Verified update signature: ${name}`);
  return {
    url: `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/v${releaseVersion}/${name}`,
    signature,
  };
}

export function macPlatforms() {
  const entry = signedArtifact(`Clearlist_${releaseVersion}_universal.app.tar.gz`);
  assert.ok(statSync(`release-assets/Clearlist_${releaseVersion}_universal.dmg`).size > 100000);
  return { 'darwin-aarch64': entry, 'darwin-x86_64': entry };
}

export function checksum(name) {
  return `${createHash('sha256')
    .update(readFileSync(`release-assets/${name}`))
    .digest('hex')}  ${name}`;
}
