import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Personal scans are development-only: never read or embed them in a public build. */
export function localRoomEntries(repository, command) {
  if (command !== 'serve') return [];
  const directory = resolve(repository, 'data/scans');
  const manifest = resolve(directory, 'rooms.json');
  if (!existsSync(manifest)) return [];
  const root = realpathSync(directory);
  const entries = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Local rooms.json must contain an array.');
  const ids = new Set();
  return entries.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^local-[a-z0-9-]+$/.test(entry.id)
      || ids.has(entry.id) || typeof entry.label !== 'string' || !entry.label.trim()
      || typeof entry.file !== 'string' || !entry.file.toLowerCase().endsWith('.usdz')) {
      throw new Error('Each local room needs a unique local- id, a label, and a USDZ file.');
    }
    const file = realpathSync(resolve(root, entry.file));
    const path = relative(root, file);
    if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
      throw new Error('Local room files must stay inside data/scans.');
    }
    ids.add(entry.id);
    return { id: entry.id, label: entry.label, url: `/@fs/${file.split(sep).map(encodeURIComponent).join('/')}` };
  });
}

export function localRoomsPlugin(repository, command) {
  const id = 'virtual:local-rooms';
  return {
    name: 'local-room-scans',
    resolveId(source) { if (source === id) return `\0${id}`; },
    load(source) {
      if (source === `\0${id}`) return `export default ${JSON.stringify(localRoomEntries(repository, command))};`;
    },
  };
}
