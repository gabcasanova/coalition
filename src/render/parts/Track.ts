import * as THREE from 'three';
import { BOARD } from '../../core/board';
import { BOARD_SIZE } from '../../core/rules';
import { SQUARE_META } from '../../data/squares';
import { RING_R, squareAngle, TILE_DEPTH, TILE_W, tileHeight, trackPoint } from '../layout';
import type { Stage } from '../Stage';
import { tileTexture } from '../textures/board';
import { buildBallotHouse } from './BallotHouse';
import { buildStopSign } from './StopSign';
import { Escalator } from './Escalator';

/** Height of the golden beacon above the Election square (above its stop sign). */
const BEACON_Y = 5.4;

/**
 * The ring of 50 squares, the golden beacon over the Election square and the escalator that carries pawns from
 * the Election square (the summit) down to the Cabinet square when a new year starts.
 */
export class Track {
  readonly escalator: Escalator;
  /** The box of each square (for hover detection). */
  readonly tileMeshes: THREE.Mesh[] = [];
  /** A point on top of each square; pawns stand around it. */
  private readonly anchors: THREE.Object3D[] = [];
  private readonly topMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly beacon: THREE.Mesh;

  constructor(private readonly stage: Stage) {
    for (let i = 0; i < BOARD_SIZE; i++) this.buildSquare(i);

    this.beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0xb88a10,
        emissiveIntensity: 0.8,
        metalness: 0.7,
        roughness: 0.2,
      }),
    );
    this.beacon.position.set(0, tileHeight(0) + BEACON_Y, -RING_R - 0.2);
    stage.scene.add(this.beacon);

    // The escalator fills the gap in the ring between square 0 and square 1.
    const halfSquare = TILE_W / 2 / RING_R; // half a square's width, as an angle
    this.escalator = new Escalator({
      radius: RING_R,
      from: squareAngle(0) + halfSquare,
      to: squareAngle(1) - halfSquare,
      top: tileHeight(0) + 0.06,
      bottom: tileHeight(1) + 0.06,
      width: TILE_DEPTH,
      topColor: SQUARE_META.election.color,
      bottomColor: SQUARE_META.formation.color,
    });
    stage.scene.add(this.escalator.group);
  }

  private buildSquare(i: number): void {
    const type = BOARD[i];
    const pos = trackPoint(RING_R, squareAngle(i));
    const group = new THREE.Group();
    group.position.copy(pos);
    group.lookAt(pos.clone().multiplyScalar(2)); // local +z points outward
    this.stage.scene.add(group);

    const h = tileHeight(i);
    const color = new THREE.Color(SQUARE_META[type].color);
    const side = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.45), roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({
      map: tileTexture(i, type),
      roughness: 0.55,
      emissive: 0xffffff,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_W, h, TILE_DEPTH), [side, side, top, side, side, side]);
    mesh.position.y = h / 2 + 0.06;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.index = i;
    group.add(mesh);

    const anchor = new THREE.Object3D();
    anchor.position.y = h + 0.06;
    group.add(anchor);
    // The Presidential Election square has a landmark: a house shaped like a ballot box.
    if (type === 'presidential') group.add(buildBallotHouse(h, SQUARE_META[type].color, TILE_DEPTH, TILE_W));
    // Both election squares get a big stop sign in the middle (its post stands between the pawns' two columns).
    if (type === 'election' || type === 'presidential') group.add(buildStopSign(h + 0.06, 0, 0, 1.7));

    this.anchors.push(anchor);
    this.topMaterials.push(top);
    this.tileMeshes.push(mesh);
  }

  /** Where player `id` stands on square `index`: each player has its own spot (2 columns × 3 rows). */
  spot(index: number, id: number): THREE.Vector3 {
    const col = id % 2;
    const row = Math.floor(id / 2);
    const local = new THREE.Vector3(col ? 0.55 : -0.55, 0, -1.15 + row * 1.15);
    return this.anchors[index].localToWorld(local);
  }

  /** Makes a square glow briefly. */
  flash(index: number): void {
    const mat = this.topMaterials[index];
    void this.stage.tween(1.1, (k) => {
      mat.emissiveIntensity = Math.sin(k * Math.PI) * 0.45;
    });
  }

  /** Per-frame animation: the beacon spins and bobs, the escalator steps move. */
  update(dt: number, time: number): void {
    this.beacon.rotation.y += dt * 0.8;
    this.beacon.position.y = tileHeight(0) + BEACON_Y + Math.sin(time * 1.5) * 0.25;
    this.escalator.update(dt);
  }
}
