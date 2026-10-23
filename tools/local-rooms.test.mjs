import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { localRoomEntries, localRoomsPlugin } from './local-rooms.mjs';

test('local scan manifests are validated and never included in production', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-rooms-'));
  try {
    assert.deepEqual(localRoomEntries(root, 'serve'), []);
    const scans = join(root, 'data/scans'); mkdirSync(scans, { recursive: true });
    const manifest = join(scans, 'rooms.json');
    const write = entries => writeFileSync(manifest, JSON.stringify(entries));
    writeFileSync(join(scans, 'room with spaces.usdz'), 'fixture');
    const entry = { id: 'local-example', label: 'Private example', file: 'room with spaces.usdz' };
    write([entry]);
    assert.match(localRoomEntries(root, 'serve')[0].url, /room%20with%20spaces\.usdz$/);
    assert.equal(localRoomsPlugin(root, 'build').load('\0virtual:local-rooms'), 'export default [];');
    write([entry, entry]); assert.throws(() => localRoomEntries(root, 'serve'), /unique/);
    write([{ ...entry, id: 'office-v4' }]); assert.throws(() => localRoomEntries(root, 'serve'), /unique/);
    writeFileSync(join(root, 'outside.usdz'), 'private outside file');
    write([{ ...entry, file: '../../outside.usdz' }]);
    assert.throws(() => localRoomEntries(root, 'serve'), /inside data\/scans/);
    symlinkSync(join(root, 'outside.usdz'), join(scans, 'linked.usdz'));
    write([{ ...entry, file: 'linked.usdz' }]);
    assert.throws(() => localRoomEntries(root, 'serve'), /inside data\/scans/);
    write([{ ...entry, file: 'missing.usdz' }]);
    assert.throws(() => localRoomEntries(root, 'serve'), /missing.usdz exists in data\/scans/);
    writeFileSync(manifest, 'invalid json');
    assert.deepEqual(localRoomEntries(root, 'build'), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
