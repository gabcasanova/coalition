import * as THREE from 'three';
import { image } from '../../assets';
import { THEME } from '../../assets/theme';
import { RING_R, TILE_DEPTH } from '../layout';

/** A repeating texture from a replacement image, if one was provided. */
function tiled(img: HTMLImageElement | undefined, repeat: number): THREE.Texture | null {
  if (!img) return null;
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/** The round wooden table with its green felt, the gold ring the squares sit on, and the lights. */
export function buildTable(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1a1a24, 1.0));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(18, 42, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = shadowCam.bottom = -32;
  shadowCam.right = shadowCam.top = 32;
  shadowCam.near = 1;
  shadowCam.far = 110;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  // A warm lamp over the centre of the table.
  const warm = new THREE.PointLight(0xffc870, 60, 30, 1.6);
  warm.position.set(0, 8, 0);
  scene.add(warm);

  // With replacement art the texture shows in its own colours; otherwise a plain colour.
  const surface = (color: number, map: THREE.Texture | null, roughness: number) =>
    new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, map, roughness });

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(31, 32, 1.2, 96),
    surface(THEME.tableWood, tiled(image('table.wood'), 4), 0.7),
  );
  table.position.y = -0.6;
  table.receiveShadow = true;
  scene.add(table);

  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(29.5, 29.5, 0.1, 96),
    surface(THEME.tableFelt, tiled(image('table.felt'), 6), 1),
  );
  felt.receiveShadow = true;
  scene.add(felt);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(RING_R - TILE_DEPTH / 2 - 0.4, RING_R + TILE_DEPTH / 2 + 0.4, 128),
    new THREE.MeshStandardMaterial({ color: THEME.ring, roughness: 0.4, metalness: 0.6 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.receiveShadow = true;
  scene.add(ring);
}
