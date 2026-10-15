/**
 * The little people on the table: party pawns on the track, MPs on the benches and the two leaders at their
 * daises. Each one has a built-in placeholder and can be replaced by a glTF model (see src/assets).
 * Models stand with their feet at y = 0 and face +z.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { model } from '../assets';
import type { PartyDef } from '../core/types';
import { LEADER_SCALE } from './layout';
import { labelTexture } from './textures/labels';

/**
 * Recolours a replacement model for a party: meshes whose material is named "party" take the party colour;
 * everything else keeps the artist's materials.
 */
function tint(object: THREE.Object3D, color: number): void {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat?.name === 'party') {
      mesh.material = mat.clone();
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(color);
    }
  });
}

/** The party emblem tag that floats above a pawn or leader. */
function partyTag(party: PartyDef, caption: string, scale: number, height: number): THREE.Sprite {
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTexture(caption, party.color, party), depthWrite: false }),
  );
  tag.scale.set(scale, scale * 0.94, 1);
  tag.position.y = height;
  return tag;
}

/**
 * Geometry of one MP on the benches: a little peg person (Game of Life style). The origin sits 0.3 above the
 * bench, so seats are placed at bench height + 0.3. All 150 MPs share it (one InstancedMesh).
 */
export function mpGeometry(): THREE.BufferGeometry {
  const replacement = model('mp');
  if (replacement) {
    // Merge every mesh of the model into one geometry (instances are coloured per party, so materials are dropped).
    replacement.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    replacement.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).toNonIndexed());
    });
    const merged = parts.length ? mergeGeometries(parts.map((g) => keepPositionAndNormal(g))) : null;
    if (merged) return merged.translate(0, -0.3, 0);
  }
  const body = new THREE.CylinderGeometry(0.12, 0.17, 0.42, 14);
  body.translate(0, 0.21, 0);
  const head = new THREE.SphereGeometry(0.15, 16, 12);
  head.translate(0, 0.58, 0);
  const peg = mergeGeometries([body, head])!;
  peg.translate(0, -0.3, 0);
  return peg;
}

/** mergeGeometries needs matching attributes; MPs only need positions and normals. */
function keepPositionAndNormal(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  if (g.getAttribute('normal')) out.setAttribute('normal', g.getAttribute('normal'));
  else out.computeVertexNormals();
  return out;
}

/** A party's pawn on the track, with its emblem tag. `caption` defaults to the party's short name. */
export function makePawn(party: PartyDef, caption = party.short): THREE.Group {
  const group = new THREE.Group();
  const replacement = model('pawn');
  if (replacement) {
    tint(replacement, party.color);
    group.add(replacement);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: party.color, roughness: 0.35, metalness: 0.25 });
    // A classic board-game pawn: base, waist and collar turned on a lathe, plus a ball head.
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.42, 0),
      new THREE.Vector2(0.42, 0.1),
      new THREE.Vector2(0.3, 0.18),
      new THREE.Vector2(0.19, 0.42),
      new THREE.Vector2(0.14, 0.78),
      new THREE.Vector2(0.26, 0.84),
      new THREE.Vector2(0, 0.9),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), mat);
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), mat);
    head.position.y = 1.1;
    head.castShadow = true;
    group.add(head);
  }
  group.add(partyTag(party, caption, 1.3, 2.05));
  return group;
}

/**
 * A party leader (Prime Minister or Leader of the Opposition): a big peg person in the party colour wearing a
 * bowtie, with the party emblem above. Faces local +z. Like the MPs, its origin sits 0.3 × LEADER_SCALE above the
 * floor it stands on.
 */
export function makeLeader(party: PartyDef): THREE.Group {
  const group = new THREE.Group();
  const replacement = model('leader');
  if (replacement) {
    tint(replacement, party.color);
    replacement.position.y = -0.3 * LEADER_SCALE; // feet at y = 0 in the model → on the floor
    group.add(replacement);
  } else {
    const body = new THREE.Mesh(
      mpGeometry(),
      new THREE.MeshStandardMaterial({ color: party.color, roughness: 0.4, metalness: 0.2 }),
    );
    body.scale.setScalar(LEADER_SCALE);
    body.castShadow = true;
    group.add(body);
    group.add(bowtie());
  }
  group.add(partyTag(party, party.short, 1.1, 1.75));
  return group;
}

/** A black bowtie at the neck of a leader figure: two wings pointing into a knot. */
function bowtie(): THREE.Group {
  const silk = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.35 });
  const bow = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 3), silk);
    wing.rotation.z = (side * Math.PI) / 2; // the tip points at the knot
    wing.position.x = side * 0.085;
    wing.scale.z = 0.5;
    bow.add(wing);
  }
  bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), silk));
  bow.position.set(0, 0.26, 0.27);
  return bow;
}
