import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { rename, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
const system = platform();
const base =
  system === 'win32'
    ? process.env.LOCALAPPDATA
    : system === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
if (!base) throw new Error('The application data directory could not be located.');
const directory = join(base, 'com.clearlist.desktop', 'development');
try {
  await access(directory);
} catch {
  console.log('No development data exists.');
  process.exit(0);
}
console.log(`Close the development app first. This resets only: ${directory}`);
const reader = createInterface({ input: process.stdin, output: process.stdout });
const answer = await reader.question('Type RESET to move that folder to a backup: ');
reader.close();
if (answer !== 'RESET') {
  console.log('Cancelled.');
  process.exit(0);
}
const backup = `${directory}-backup-${Date.now()}`;
await rename(directory, backup);
console.log(`Development data moved to ${backup}. The next launch starts fresh.`);
