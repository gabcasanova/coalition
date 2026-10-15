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

/**
 * The overall-standings podium beside the parliament: one step per party, highest in the centre. Step height
 * follows the number of elections won, so parties with the same number of wins stand at the same height.
 */
export class Podium {
  private readonly statues = new THREE.Group();
  /** What is currently shown, to skip rebuilding when nothing changed. */
  private shownKey = '';

  constructor(stage: Stage) {
    const podium = new THREE.Group();
    podium.position.copy(PODIUM_POS);
    const title = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: titleTexture(L('OVERALL STANDINGS', 'PLACAR GERAL'), L('elections won', 'eleições vencidas')),
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
  update(rows: { party: PartyDef; wins: number }[]): void {
    const key = rows.map((r) => `${r.party.short}:${r.wins}`).join('|');
    if (key === this.shownKey) return;
    this.shownKey = key;
    for (const child of [...this.statues.children]) this.statues.remove(child);

    const n = rows.length;
    const spacing = 1.5;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing);
    const places = [...xs].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b); // centre first, then outwards
    const levels = [...new Set(rows.map((r) => r.wins))].sort((a, b) => b - a);
    const levelCount = levels.length;

    rows.forEach((row, i) => {
      const level = levels.indexOf(row.wins);
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
        `${row.wins} WIN${row.wins === 1 ? '' : 'S'}`,
        `${row.wins} ${row.wins === 1 ? 'VITÓRIA' : 'VITÓRIAS'}`,
      );
      const statue = makePawn(row.party, caption);
      statue.scale.setScalar(level === 0 && levelCount > 1 ? 1.1 : 0.95);
      statue.position.set(x, height + 0.06, 0);
      this.statues.add(statue);
    });
  }
}
