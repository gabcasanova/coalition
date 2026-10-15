import * as THREE from 'three';
import { TOTAL_SEATS } from '../../core/rules';
import type { PartyDef, Player } from '../../core/types';
import { L } from '../../i18n';
import { easeInOut } from '../animation';
import { polar } from '../layout';
import type { Stage } from '../Stage';
import { drawLedPlaque, plaqueCanvas } from '../textures/led';
import { drawPortrait, portraitCanvas } from '../textures/portrait';
import { RESEAT_SECONDS } from './Chamber';

/** Radius at which the portrait stands (the far end of the red carpet) and the LED boards beside it. */
const PORTRAIT_R = 18.6;
const BOARD_R = 18.8;

interface LedBoard {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  group: THREE.Group;
}

/**
 * The back of the chamber: the Prime Minister's portrait at the far end of the red carpet, with the LED
 * scoreboards right beside it (government on the government side, opposition on the opposition side).
 * All three follow the aisle when the benches reshuffle.
 */
export class BackWall {
  private readonly portraitGroup = new THREE.Group();
  /** The framed canvas; it spins when the portrait changes. */
  private readonly spinner = new THREE.Group();
  private readonly portrait = portraitCanvas();
  private readonly lamp: THREE.PointLight;
  private readonly government: LedBoard;
  private readonly opposition: LedBoard;
  /** Chamber angle the trio stands at. */
  private angle = Math.PI / 2;
  /** Which leader the portrait shows ('' before the first draw). */
  private portraitKey = '';

  constructor(private readonly stage: Stage) {
    this.government = this.buildLedBoard();
    this.opposition = this.buildLedBoard();

    const W = 4.4;
    const H = W * 1.5;
    const bottom = 1.5;
    this.spinner.position.y = bottom + H / 2;
    this.portraitGroup.add(this.spinner);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, H + 0.5, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.85, roughness: 0.3 }),
    );
    frame.castShadow = true;
    this.spinner.add(frame);
    const painting = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: this.portrait.texture, toneMapped: false }),
    );
    painting.position.z = 0.15;
    this.spinner.add(painting);
    for (const x of [-W / 3, W / 3]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, bottom, 10),
        new THREE.MeshStandardMaterial({ color: 0x1c212b, metalness: 0.7, roughness: 0.35 }),
      );
      post.position.set(x, bottom / 2, -0.05);
      this.portraitGroup.add(post);
    }
    this.lamp = new THREE.PointLight(0xffe2a8, 10, 8, 2);
    this.lamp.position.set(0, bottom + H + 0.6, 1.4);
    this.portraitGroup.add(this.lamp);
    stage.scene.add(this.portraitGroup);

    this.place(Math.PI / 2);
    this.showPortrait(null);
  }

  /** An LED board on two posts (positioned by `place`). */
  private buildLedBoard(): LedBoard {
    const W = 8;
    const H = 3.75;
    const bottom = 1.9;
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c212b, metalness: 0.7, roughness: 0.35 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, H + 0.4, 0.3), metal);
    frame.position.y = bottom + H / 2;
    frame.castShadow = true;
    group.add(frame);
    for (const x of [-W / 3, W / 3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, bottom, 10), metal);
      leg.position.set(x, bottom / 2, 0);
      group.add(leg);
    }
    const { canvas, texture } = plaqueCanvas();
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    screen.position.set(0, bottom + H / 2, 0.16);
    group.add(screen);
    // Soft glow spilling onto the benches.
    const glow = new THREE.PointLight(0x88aaff, 8, 9, 2);
    glow.position.set(0, bottom + H / 2, 1.2);
    group.add(glow);
    this.stage.scene.add(group);
    return { canvas, texture, group };
  }

  /** The portrait's angle for an aisle angle: on the carpet's line, but far enough in that both boards stay behind the benches. */
  private spotFor(aisleAngle: number): number {
    return THREE.MathUtils.clamp(aisleAngle, 0.72, Math.PI - 0.72);
  }

  /** Stands the trio at chamber angle `a`, facing down the aisle. */
  private place(a: number): void {
    this.angle = a;
    const stand = (object: THREE.Object3D, r: number, phi: number) => {
      object.position.copy(polar(r, phi));
      object.lookAt(0, 0, 0);
    };
    stand(this.portraitGroup, PORTRAIT_R, a);
    // Half the portrait frame + half a board + a small gap, as an angle.
    const beside = (2.45 + 4.2 + 0.4) / BOARD_R;
    stand(this.government.group, BOARD_R, a - beside);
    stand(this.opposition.group, BOARD_R, a + beside);
  }

  /** Redraws the boards and slides the trio to follow the aisle (over the same time the MPs take to re-seat). */
  update(players: Player[], aisleAngle: number, hasAisle: boolean): void {
    const government = players.filter((p) => p.inGov);
    const opposition = players.filter((p) => !p.inGov);
    const governmentSeats = government.reduce((acc, p) => acc + p.seats, 0);
    const rows = (list: Player[]) =>
      [...list]
        .sort((a, b) => b.seats - a.seats)
        .map((p) => ({ label: p.party.name, seats: p.seats, color: p.party.color }));
    const pm = players.find((p) => p.isPM);
    const leader = [...opposition].sort((a, b) => b.seats - a.seats)[0];
    drawLedPlaque(
      this.government.canvas,
      L('GOVERNMENT', 'GOVERNO'),
      pm ? `PM: ${pm.party.name}` : L('Forming…', 'Em formação…'),
      governmentSeats,
      '#57e389',
      rows(government),
    );
    drawLedPlaque(
      this.opposition.canvas,
      L('OPPOSITION', 'OPOSIÇÃO'),
      leader && government.length
        ? `${L('Leader', 'Líder')}: ${leader.party.name}`
        : L('All parties', 'Todos os partidos'),
      TOTAL_SEATS - governmentSeats,
      '#ff6b6b',
      rows(opposition),
    );
    this.government.texture.needsUpdate = true;
    this.opposition.texture.needsUpdate = true;
    // Without a government the portrait goes blank at once; a new PM's portrait is revealed once they sit down.
    if (!pm) this.showPortrait(null);

    const from = this.angle;
    const to = hasAisle ? this.spotFor(aisleAngle) : Math.PI / 2;
    void this.stage.tween(RESEAT_SECONDS, (k) => {
      this.place(from + (to - from) * easeInOut(k));
    });
  }

  /** Paints the portrait of `party` (null = no government yet). */
  showPortrait(party: PartyDef | null): void {
    const key = party ? `${party.name}|${party.color}|${party.icon}` : '-';
    if (key === this.portraitKey) return;
    this.portraitKey = key;
    drawPortrait(
      this.portrait.canvas,
      party,
      L('PRIME MINISTER', 'PRIMEIRO-MINISTRO'),
      party ? party.name : L('Forming a government…', 'Governo em formação…'),
    );
    this.portrait.texture.needsUpdate = true;
  }

  /** The new Prime Minister's portrait: the camera turns to it, it spins edge-on, flashes gold and comes back round. */
  async reveal(party: PartyDef): Promise<void> {
    const { stage } = this;
    if (stage.director.cinematic) {
      stage.director.frame({ pos: polar(8.5, this.angle, 6.2), target: polar(PORTRAIT_R, this.angle, 4.6), rate: 2.4 });
      await stage.wait(0.9);
    }
    await stage.tween(0.45, (k) => {
      this.spinner.rotation.y = (k * k * Math.PI) / 2;
      this.spinner.scale.setScalar(1 + k * 0.06);
    });
    this.showPortrait(party); // swapped while edge-on
    await stage.tween(0.75, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      this.spinner.rotation.y = -Math.PI / 2 + (e * Math.PI) / 2; // back round from edge-on to facing the chamber
      this.spinner.scale.setScalar(1.06 - 0.06 * e);
      this.lamp.intensity = 10 + Math.sin(k * Math.PI) * 60;
    });
    this.spinner.rotation.y = 0;
    this.spinner.scale.setScalar(1);
    this.lamp.intensity = 10;
    await stage.wait(0.8);
  }
}
