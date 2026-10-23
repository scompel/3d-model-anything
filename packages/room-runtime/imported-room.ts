import * as THREE from 'three';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import type { BuiltRoom, V3 } from './types';

/** RoomPlan USDZ imports retain their measured geometry and metric scale. */
export async function loadImportedRoom(url: string): Promise<BuiltRoom> {
  return buildImportedRoom(await new USDLoader().loadAsync(url));
}

export function buildImportedRoom(model: THREE.Group): BuiltRoom {
  model.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(model);
  if (original.isEmpty() || !Number.isFinite(original.min.length() + original.max.length())) {
    throw new Error('This USDZ has no finite room geometry.');
  }
  const floorRoot = model.getObjectByName('Floor_grp');
  if (!floorRoot) throw new Error('This import requires a RoomPlan USDZ with a floor.');
  const floorBounds = new THREE.Box3().setFromObject(floorRoot);
  const center = floorBounds.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  group.name = 'imported-room';
  group.add(model);
  // One translation only: preserve source scale, orientation and relative positions.
  group.position.set(-center.x, -floorBounds.max.y, -center.z);
  group.updateMatrixWorld(true);

  const floors: THREE.Mesh[] = [];
  const oldMaterials = new Set<THREE.Material>();
  const palette = { wall: '#e3e0d8', floor: '#b6aa91', window: '#8eafb9', door: '#c7b99e', object: '#81928d' };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key,
    new THREE.MeshStandardMaterial({ color, roughness: 0.87, metalness: 0, side: THREE.DoubleSide }),
  ]));
  model.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const category = /^Wall/i.test(node.name) ? 'wall' : /^Floor/i.test(node.name) ? 'floor'
      : /^Window/i.test(node.name) ? 'window' : /^Door/i.test(node.name) ? 'door' : 'object';
    // Keep authored textures if a future RoomPlan export supplies them.
    const previous = Array.isArray(node.material) ? node.material : [node.material];
    if (!previous.some(material => (material as THREE.MeshStandardMaterial).map)) {
      previous.forEach(material => oldMaterials.add(material));
      node.material = materials[category];
    }
    node.castShadow = category !== 'floor';
    node.receiveShadow = true;
    if (category === 'floor') floors.push(node);
    if (category === 'object') node.userData.physics = { type: 'static' };
  });
  const retainedMaterials = new Set<THREE.Material>();
  model.traverse(node => { if (node instanceof THREE.Mesh) {
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => retainedMaterials.add(m));
  } });
  for (const material of oldMaterials) if (!retainedMaterials.has(material)) material.dispose();
  for (const material of Object.values(materials)) if (!retainedMaterials.has(material)) material.dispose();

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  function walkable(x: number, z: number) {
    ray.set(new THREE.Vector3(x, bounds.max.y + 1, z), down);
    return ray.intersectObjects(floors, false).length > 0;
  }
  let stand = new THREE.Vector3(0, 1.6, 0);
  // An L-shaped room's bounding-box center may not be inside its floor.
  if (!walkable(stand.x, stand.z)) {
    const floor = floors[0];
    const positions = floor.geometry.getAttribute('position');
    const index = floor.geometry.index;
    stand.set(0, 0, 0);
    for (let i = 0; i < 3; i++) stand.add(new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(floor.matrixWorld));
    stand.multiplyScalar(1 / 3); stand.y = 1.6;
  }

  const walls: BuiltRoom['walls'] = [];
  const architecture = model.getObjectByName('Arch_grp');
  for (const wallGroup of architecture?.children ?? []) {
    let wall: THREE.Mesh | undefined;
    wallGroup.traverse(node => { if (!wall && node instanceof THREE.Mesh && /^Wall/i.test(node.name)) wall = node; });
    if (!wall) continue;
    const mesh = wall as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox!;
    const midpoint = local.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const u = new THREE.Vector3(1, 0, 0).transformDirection(mesh.matrixWorld);
    const plus = midpoint.clone().addScaledVector(normal, .3);
    const minus = midpoint.clone().addScaledVector(normal, -.3);
    const plusInside = walkable(plus.x, plus.z), minusInside = walkable(minus.x, minus.z);
    // Both sides on the floor: retain internal partitions, rather than guessing a cutaway side.
    if (plusInside && minusInside) continue;
    if (minusInside || (!plusInside && normal.dot(center.clone().set(0, midpoint.y, 0).sub(midpoint)) < 0)) normal.negate();
    const length = local.max.x - local.min.x;
    const origin = midpoint.clone().addScaledVector(u, -length / 2); origin.y = 0;
    walls.push({ group: wallGroup, def: { name: wallGroup.name, origin, u, n: normal,
      length, thickness: local.max.z - local.min.z, height: local.max.y - local.min.y,
      openings: [], panels: [],
    } });
  }
  const lights = new THREE.Group();
  lights.add(new THREE.HemisphereLight('#fffaf0', '#898b83', 2.4));
  const sun = new THREE.DirectionalLight('#fff8e9', 3);
  const span = Math.max(size.x, size.z, 3);
  sun.position.set(span * .5, span, span * .35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: .1, far: span * 4 });
  sun.shadow.normalBias = .025;
  lights.add(sun, sun.target);
  const target: V3 = [0, Math.min(size.y * .35, 1.2), 0];
  return {
    group, lights, walls, ceiling: [], wallTop: bounds.max.y,
    sourceLabel: 'Imported', playgroundAvailable: false,
    note: 'Imported room scan. Colors distinguish surfaces; they are not captured finishes. Furniture is simplified scan geometry.',
    walkable, camera: { orbit: [span * .8, span * .85, span * .8], target,
      walk: stand.toArray() as V3, walkLook: [stand.x, 1.6, stand.z - 1] },
    environment: { center: stand.toArray() as V3, intensity: .25 }, exposure: 1,
    render: { envSize: 64, ao: { radius: .3, intensity: 1 } },
    referenceAvailable: false, referenceKind: 'layout',
    loadReference: async () => { throw new Error('No separate photo or depth reference is available for this import.'); },
  };
}
