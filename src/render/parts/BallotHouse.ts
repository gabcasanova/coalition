import * as THREE from 'three';

/**
 * The landmark on the Presidential Election square: a house shaped like a ballot box. A blue box with a lid and
 * a slot on top (a ballot half posted through it, like a chimney), a door, lit windows and a gold star on the
 * front. Built in the square's frame (+z points out of the ring, toward the pawns and the camera), on an annex
 * level with the square's top, just inside the ring so it never hides the pawns.
 *
 * `top`: height of the square's top; `color`: the square's colour.
 */
export function buildBallotHouse(top: number, color: number, depth: number, width: number): THREE.Group {
  const house = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    house.add(mesh);
    return mesh;
  };
  const base = new THREE.Color(color);
  const plinthMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.45), roughness: 0.6 });
  const body = new THREE.MeshStandardMaterial({ color: base, roughness: 0.45, metalness: 0.1 });
  const lid = new THREE.MeshStandardMaterial({ color: 0xeef2f8, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 0.85, roughness: 0.3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94a, emissiveIntensity: 0.8 });

  // The annex the house stands on, level with the square.
  const annexDepth = 2.3;
  const z = -depth / 2 - annexDepth / 2; // just inside the ring
  add(new THREE.BoxGeometry(width, top, annexDepth), plinthMat, 0, top / 2 + 0.06, z);
  const floor = top + 0.06;

  // The box itself, with a white lid overhanging it and the ballot slot on top.
  const W = 2.0;
  const H = 1.7;
  const D = 1.7;
  add(new THREE.BoxGeometry(W, H, D), body, 0, floor + H / 2, z);
  add(new THREE.BoxGeometry(W + 0.2, 0.2, D + 0.2), lid, 0, floor + H + 0.1, z);
  add(new THREE.BoxGeometry(1.0, 0.03, 0.16), dark, 0, floor + H + 0.215, z);
  // A ballot half posted through the slot, folded, with a tick on it.
  const ballot = add(new THREE.BoxGeometry(0.72, 0.62, 0.03), paper, 0, floor + H + 0.5, z);
  ballot.rotation.z = 0.12;
  for (const [x, y, len, angle] of [
    [-0.08, -0.03, 0.16, -0.8],
    [0.07, 0.04, 0.3, 0.9],
  ]) {
    const stroke = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.035), dark);
    stroke.position.set(x, y, 0);
    stroke.rotation.z = angle;
    ballot.add(stroke);
  }

  // The front (facing the pawns): a door with a gold knob, two lit windows and a gold star above the door.
  const front = z + D / 2 + 0.01;
  add(new THREE.BoxGeometry(0.46, 0.82, 0.06), dark, 0, floor + 0.41, front);
  add(new THREE.SphereGeometry(0.04, 8, 6), gold, 0.14, floor + 0.42, front + 0.04);
  for (const x of [-0.62, 0.62]) {
    add(new THREE.BoxGeometry(0.42, 0.36, 0.05), glow, x, floor + 0.95, front);
    add(new THREE.BoxGeometry(0.46, 0.04, 0.07), lid, x, floor + 0.95, front + 0.01); // window bars
    add(new THREE.BoxGeometry(0.04, 0.4, 0.07), lid, x, floor + 0.95, front + 0.01);
  }
  const star = add(starGeometry(0.22, 0.09, 0.05), gold, 0, floor + 1.32, front);
  star.rotation.z = Math.PI / 2;
  return house;
}

/** A flat five-pointed star, extruded `depth` thick. */
function starGeometry(outer: number, inner: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}
