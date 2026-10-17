import * as THREE from 'three';
import { L } from '../../i18n';
import { FONT, makeCanvas, toTexture } from '../textures/canvas';

/** Radius of the octagon and height of its centre above the square. */
const R = 0.5;
const HEIGHT = 2.0;

let face: THREE.CanvasTexture | null = null;

/** The sign's face: a red octagon with a white border and "STOP" ("PARE" in Portuguese). Shared by every sign. */
function faceTexture(): THREE.CanvasTexture {
  if (face) return face;
  const { canvas, ctx } = makeCanvas(256, 256);
  const octagon = (r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  octagon(128);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  octagon(116);
  ctx.fillStyle = '#c8102e';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 76px ${FONT}`;
  ctx.fillText(L('STOP', 'PARE'), 128, 134);
  face = toTexture(canvas);
  return face;
}

/**
 * A stop sign on a post, for the two election squares. Built in a square's frame (+z points out of the ring,
 * toward the camera), standing on the square's top at height `top`, at local `x`, `z`, facing out, `size`
 * times its normal size.
 */
export function buildStopSign(top: number, x: number, z: number, size = 1): THREE.Group {
  const sign = new THREE.Group();
  sign.position.set(x, top, z);
  sign.scale.setScalar(size);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.7, roughness: 0.4 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, HEIGHT, 10), metal);
  post.position.y = HEIGHT / 2;
  post.castShadow = true;
  sign.add(post);

  // The plate: a thin octagonal slab (flat top and bottom), the face on the front, plain metal on the back.
  const plate = new THREE.Group();
  plate.position.set(0, HEIGHT, 0.07);
  sign.add(plate);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.04, 8), metal);
  slab.rotation.set(Math.PI / 2, Math.PI / 8, 0);
  slab.castShadow = true;
  plate.add(slab);
  const front = new THREE.Mesh(
    new THREE.CircleGeometry(R, 8, Math.PI / 8),
    new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.5 }),
  );
  front.position.z = 0.022;
  plate.add(front);
  return sign;
}
