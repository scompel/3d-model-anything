import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildImportedRoom } from '../packages/room-runtime/imported-room.ts';

test('room imports preserve scale, place the floor at zero and provide a usable camera', () => {
  const model = new THREE.Group();
  model.position.set(9, -4, 6);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4, .16, 4), new THREE.MeshStandardMaterial());
  floor.name = 'Floor_grp'; floor.position.y = -.08; model.add(floor);
  const architecture = new THREE.Group(); architecture.name = 'Arch_grp'; model.add(architecture);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, .16), new THREE.MeshStandardMaterial());
  wall.name = 'Wall_0_grp'; wall.position.set(0, 1.2, 2); architecture.add(wall);
  const vertices = Array.from(wall.geometry.attributes.position.array);
  const room = buildImportedRoom(model);
  const bounds = new THREE.Box3().setFromObject(floor);
  assert.ok(Math.abs(bounds.max.y) < 1e-6);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x - 4) < 1e-6);
  assert.deepEqual(Array.from(wall.geometry.attributes.position.array), vertices);
  assert.ok(room.walkable(...[room.camera.walk[0], room.camera.walk[2]]));
  assert.equal(room.walkable(10, 10), false);
  assert.equal(room.referenceAvailable, false);
  assert.equal(room.playgroundAvailable, false);
  assert.equal(room.walls.length, 1);
  assert.ok(room.walls[0].def.n.z < 0, 'exterior wall cutaway points into the room');
});

test('empty or non-RoomPlan imports fail clearly', () => {
  assert.throws(() => buildImportedRoom(new THREE.Group()), /no finite/);
  const model = new THREE.Group(); model.add(new THREE.Mesh(new THREE.BoxGeometry()));
  assert.throws(() => buildImportedRoom(model), /with a floor/);
  const floor = new THREE.Group(); floor.name = 'Floor_grp';
  floor.add(new THREE.Mesh(new THREE.BoxGeometry())); model.add(floor);
  assert.throws(() => buildImportedRoom(model), /No floor meshes/);
});
