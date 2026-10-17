import * as THREE from 'three';
import type { PartyDef } from '../../core/types';
import { L } from '../../i18n';
import { PODIUM_POS } from '../layout';
import { makePawn } from '../models';
import type { Stage } from '../Stage';
import { titleTexture } from '../textures/board';
import { labelTexture } from '../textures/labels';

/** Gold, silver and bronze steps. */
const MEDALS = [0xe8c35a, 0xc9ced6, 0xc58a52];
/** Step colour when everyone is tied, or below third place. */
const PLAIN = 0x56607a;

/** How long a win celebration lasts, in seconds. */
export const CELEBRATION_SECONDS = 2.6;

/**
 * The overall-standings podium beside the parliament: one step per party, highest in the centre. Step height
 * follows the number of points (parliamentary elections + presidencies won), so parties with the same points
 * stand at the same height. After every win the winner's statue celebrates on its step.
 */
export class Podium {
  private readonly statues = new THREE.Group();
  /** What is currently shown, to skip rebuilding when nothing changed. */
  private shownKey = '';
  /** Each party's step and statue, for the celebrations. */
  private readonly pieces = new Map<PartyDef, { step: THREE.Mesh; statue: THREE.Object3D }>();

  constructor(private readonly stage: Stage) {
    const podium = new THREE.Group();
    podium.position.copy(PODIUM_POS);
    const title = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: titleTexture(
          L('OVERALL STANDINGS', 'PLACAR GERAL'),
          L('points: Congress + presidency + laws', 'pontos: Congresso + presidência + leis'),
        ),
        depthWrite: false,
      }),
    );
    title.scale.set(5.6, 1.4, 1);
    title.position.set(0, 4.6, 0);
    podium.add(title);
    podium.add(this.statues);
    stage.scene.add(podium);
  }

  /** Rebuilds the podium; `rows` are in ranking order (leader first). */
  update(rows: { party: PartyDef; points: number }[]): void {
    const key = rows.map((r) => `${r.party.short}:${r.points}`).join('|');
    if (key === this.shownKey) return;
    this.shownKey = key;
    for (const child of [...this.statues.children]) this.statues.remove(child);
    this.pieces.clear();

    const n = rows.length;
    const spacing = 1.5;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing);
    const places = [...xs].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b); // centre first, then outwards
    const levels = [...new Set(rows.map((r) => r.points))].sort((a, b) => b - a);
    const levelCount = levels.length;

    rows.forEach((row, i) => {
      const level = levels.indexOf(row.points);
      const height = levelCount === 1 ? 0.8 : 0.45 + ((levelCount - 1 - level) / (levelCount - 1)) * 1.25;
      const color = levelCount === 1 ? PLAIN : (MEDALS[level] ?? PLAIN);
      const x = places[i];

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, height, 1.6),
        new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }),
      );
      step.position.set(x, height / 2 + 0.06, 0);
      step.castShadow = true;
      step.receiveShadow = true;
      this.statues.add(step);

      const placeNumber = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.72),
        new THREE.MeshBasicMaterial({ map: labelTexture(String(level + 1), color), transparent: true }),
      );
      placeNumber.position.set(x, Math.min(height * 0.5, 0.42) + 0.06, 0.81);
      this.statues.add(placeNumber);

      const caption = L(
        `${row.points} POINT${row.points === 1 ? '' : 'S'}`,
        `${row.points} ${row.points === 1 ? 'PONTO' : 'PONTOS'}`,
      );
      const statue = makePawn(row.party, caption);
      statue.scale.setScalar(level === 0 && levelCount > 1 ? 1.1 : 0.95);
      statue.position.set(x, height + 0.06, 0);
      this.statues.add(statue);
      this.pieces.set(row.party, { step, statue });
    });
  }

  /** A party has scored a point: its statue leaps (spinning on the first leap), its step glows and confetti flies. */
  async celebrate(party: PartyDef): Promise<void> {
    const piece = this.pieces.get(party);
    if (!piece) return;
    const { step, statue } = piece;
    const base = statue.position.clone();
    const material = step.material as THREE.MeshStandardMaterial;
    material.emissive.set(0xffd76a);
    const confetti = this.confetti(base.clone().add(new THREE.Vector3(0, 1.3, 0)), party.color);
    await this.stage.tween(CELEBRATION_SECONDS, (k) => {
      const leap = (k * 3) % 1;
      const first = k < 1 / 3;
      statue.position.y = base.y + Math.sin(leap * Math.PI) * (first ? 1.2 : 0.6);
      statue.rotation.y = first ? leap * Math.PI * 2 : 0;
      material.emissiveIntensity = Math.sin(k * Math.PI) * 0.7;
      confetti.frame(k * CELEBRATION_SECONDS);
    });
    statue.position.copy(base);
    statue.rotation.y = 0;
    material.emissiveIntensity = 0;
    confetti.remove();
  }

  /** A burst of confetti from `origin` (in the podium's frame), in the party's colour, gold and white. */
  private confetti(origin: THREE.Vector3, color: number) {
    const count = 90;
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.1, 0.15),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      count,
    );
    const palette = [color, 0xffd76a, 0xffffff, color, 0xff6b6b, 0x57e389];
    const bits = Array.from({ length: count }, (_, i) => {
      mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
      return {
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 4),
        spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14),
      };
    });
    this.statues.add(mesh);
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    return {
      /** `t`: seconds since the burst. Pieces fly up, flutter down and settle on the floor. */
      frame: (t: number) => {
        bits.forEach((bit, i) => {
          position.copy(origin).addScaledVector(bit.velocity, t);
          position.y = Math.max(0.08, position.y - 2.4 * t * t);
          euler.set(bit.spin.x * t, bit.spin.y * t, bit.spin.z * t);
          turn.setFromEuler(euler);
          mesh.setMatrixAt(i, matrix.compose(position, turn, one));
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
      remove: () => {
        this.statues.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      },
    };
  }
}
