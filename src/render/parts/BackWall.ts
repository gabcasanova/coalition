import * as THREE from 'three';
import { isIndependent, oppositionLeader } from '../../core/rules';
import type { PartyDef, Player } from '../../core/types';
import { sound } from '../../audio';
import { L } from '../../i18n';
import { easeInOut } from '../animation';
import { polar } from '../layout';
import type { Stage } from '../Stage';
import { drawLedPlaque, plaqueCanvas } from '../textures/led';
import { drawPortrait, portraitCanvas } from '../textures/portrait';
import { RESEAT_SECONDS, type ChamberLayout } from './Chamber';

/** Radius at which the portraits stand (the far end of the red carpet) and the LED boards behind the benches. */
const PORTRAIT_R = 18.6;
const BOARD_R = 18.8;
/** Half the width of a full-size portrait's frame, and the gap left either side of the carpet's line. */
const FRAME_HALF = 2.45;
const PAIR_GAP = 0.3;
/** The Leader of Congress's portrait is drawn smaller than the President's. */
const LEADER_SIZE = 0.85;
/** Chamber angle from the carpet's line to the centre of each portrait. */
const LEADER_OFFSET = (PAIR_GAP + FRAME_HALF * LEADER_SIZE) / PORTRAIT_R;
const PRESIDENT_OFFSET = (PAIR_GAP + FRAME_HALF) / PORTRAIT_R;
/** Chamber angle from a portrait of `size` to a board right beside it (half the frame + half a board + a gap). */
const beside = (size: number) => (FRAME_HALF * size + 4.2 + 0.4) / BOARD_R;
/** Chamber angle between two boards side by side. */
const BOARD_STEP = (8.4 + 0.5) / BOARD_R;
/** Closest a board's centre may come to either end of the hemicycle. */
const ARC_MARGIN = 0.3;

/** Chamber angle of each thing on the back wall. */
interface Spots {
  leader: number;
  president: number;
  government: number;
  opposition: number;
  independents: number;
}

interface LedBoard {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  group: THREE.Group;
}

/**
 * A framed portrait on two posts: the Leader of Congress or the President. The framed canvas spins when the
 * portrait changes hands.
 */
class Portrait {
  readonly group = new THREE.Group();
  private readonly spinner = new THREE.Group();
  private readonly canvas = portraitCanvas();
  private readonly lamp: THREE.PointLight;
  /** Who the portrait shows ('' before the first draw). */
  private key = '';

  constructor(
    stage: Stage,
    /** 1 = full size. */
    private readonly size: number,
    frameColor: number,
    /** The office's title and the caption when nobody holds it. */
    private readonly title: () => string,
    private readonly vacant: () => { title: string; caption: string },
  ) {
    const W = 4.4;
    const H = W * 1.5;
    const bottom = 1.5;
    this.spinner.position.y = bottom + H / 2;
    this.group.add(this.spinner);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, H + 0.5, 0.28),
      new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.85, roughness: 0.3 }),
    );
    frame.castShadow = true;
    this.spinner.add(frame);
    const painting = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: this.canvas.texture, toneMapped: false }),
    );
    painting.position.z = 0.15;
    this.spinner.add(painting);
    for (const x of [-W / 3, W / 3]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, bottom, 10),
        new THREE.MeshStandardMaterial({ color: 0x1c212b, metalness: 0.7, roughness: 0.35 }),
      );
      post.position.set(x, bottom / 2, -0.05);
      this.group.add(post);
    }
    this.lamp = new THREE.PointLight(0xffe2a8, 10, 8, 2);
    this.lamp.position.set(0, bottom + H + 0.6, 1.4);
    this.group.add(this.lamp);
    this.group.scale.setScalar(size);
    stage.scene.add(this.group);
  }

  /** Paints the portrait of `party` (null = nobody holds the office). */
  show(party: PartyDef | null): void {
    const key = party ? `${party.name}|${party.color}|${party.icon}` : '-';
    if (key === this.key) return;
    this.key = key;
    const vacant = this.vacant();
    drawPortrait(this.canvas.canvas, party, party ? this.title() : vacant.title, party ? party.name : vacant.caption);
    this.canvas.texture.needsUpdate = true;
  }

  /** A new holder: the camera turns to the portrait, it spins edge-on, flashes gold and comes back round. */
  async reveal(stage: Stage, angle: number, party: PartyDef): Promise<void> {
    if (stage.director.cinematic) {
      const middle = 4.8 * this.size; // height of the painting's centre
      stage.director.frame({
        pos: polar(8.5, angle, middle + 1.6),
        target: polar(PORTRAIT_R, angle, middle),
        rate: 2.4,
      });
      await stage.wait(0.9);
    }
    sound.play('portrait');
    await stage.tween(0.45, (k) => {
      this.spinner.rotation.y = (k * k * Math.PI) / 2;
      this.spinner.scale.setScalar(1 + k * 0.06);
    });
    this.show(party); // swapped while edge-on
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

/**
 * The back of the chamber: at the far end of the red carpet, the Leader of Congress's portrait with the President's
 * on its right; the government's LED scoreboard beside them, the opposition's scoreboard behind the opposition
 * benches and, when there are any, the independents' scoreboard behind their crossbench. They all slide along
 * when the benches reshuffle.
 */
export class BackWall {
  private readonly leaderPortrait: Portrait;
  private readonly presidentPortrait: Portrait;
  private readonly government: LedBoard;
  private readonly opposition: LedBoard;
  private readonly independents: LedBoard;
  private spots: Spots = BackWall.spotsAround(Math.PI / 2);
  /** How far the independents' board has risen out of the floor (0 = hidden). */
  private independentsRise = 0;

  constructor(private readonly stage: Stage) {
    this.government = this.buildLedBoard();
    this.opposition = this.buildLedBoard();
    this.independents = this.buildLedBoard();
    this.leaderPortrait = new Portrait(
      stage,
      LEADER_SIZE,
      0xc9a23a,
      () => L('LEADER OF CONGRESS', 'LÍDER DO CONGRESSO'),
      () => ({
        title: L('LEADER OF CONGRESS', 'LÍDER DO CONGRESSO'),
        caption: L('Forming a government…', 'Governo em formação…'),
      }),
    );
    this.presidentPortrait = new Portrait(
      stage,
      1,
      0xb9c4d6,
      () => L('PRESIDENT', 'PRESIDENTE'),
      () => ({
        title: L('PROVISIONAL PRESIDENT', 'PRESIDENTE PROVISÓRIO'),
        caption: L('Until the presidential election', 'Até a eleição presidencial'),
      }),
    );
    this.place(this.spots, 0);
    this.leaderPortrait.show(null);
    this.presidentPortrait.show(null);
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

  /** Both portraits either side of chamber angle `a`, with the boards right beside them. */
  private static spotsAround(a: number): Spots {
    const leader = a + LEADER_OFFSET;
    const president = a - PRESIDENT_OFFSET;
    return {
      leader,
      president,
      government: president - beside(1),
      opposition: leader + beside(LEADER_SIZE),
      independents: leader + beside(LEADER_SIZE) + BOARD_STEP,
    };
  }

  /**
   * Where everything stands for a chamber layout. The two portraits stand either side of the red carpet's line
   * (the Leader of Congress on the left, the President on the right) with the government's board beside the
   * President; the opposition's and independents' boards go behind the middle of their benches, pushed apart
   * where they would overlap, and the whole row slides back inside the hemicycle if it runs off an end.
   */
  private static spotsFor(layout: ChamberLayout, withIndependents: boolean): Spots {
    if (!layout.hasAisle) return BackWall.spotsAround(Math.PI / 2);
    const near = BackWall.spotsAround(layout.aisleAngle);
    const independents = Math.max(layout.centres.independents ?? near.leader, near.opposition);
    const opposition = Math.max(
      layout.centres.opposition ?? layout.centres.independents ?? near.leader,
      withIndependents ? independents + BOARD_STEP : near.opposition,
    );
    const leftmost = withIndependents ? Math.max(opposition, independents) : opposition;
    const shift =
      leftmost > Math.PI - ARC_MARGIN
        ? Math.PI - ARC_MARGIN - leftmost
        : near.government < ARC_MARGIN
          ? ARC_MARGIN - near.government
          : 0;
    return {
      leader: near.leader + shift,
      president: near.president + shift,
      government: near.government + shift,
      opposition: opposition + shift,
      independents: independents + shift,
    };
  }

  /** Stands everything at its chamber angle, facing the middle; the independents' board risen by `rise` (0–1). */
  private place(spots: Spots, rise: number): void {
    this.spots = spots;
    this.independentsRise = rise;
    const stand = (object: THREE.Object3D, r: number, phi: number) => {
      object.position.copy(polar(r, phi));
      object.lookAt(0, 0, 0);
    };
    stand(this.leaderPortrait.group, PORTRAIT_R, spots.leader);
    stand(this.presidentPortrait.group, PORTRAIT_R, spots.president);
    stand(this.government.group, BOARD_R, spots.government);
    stand(this.opposition.group, BOARD_R, spots.opposition);
    stand(this.independents.group, BOARD_R, spots.independents);
    this.independents.group.visible = rise > 0.001;
    this.independents.group.scale.set(1, Math.max(rise, 0.001), 1);
  }

  /** Redraws the boards and slides them after their benches (over the same time the MPs take to re-seat). */
  update(players: Player[], layout: ChamberLayout): void {
    const government = players.filter((p) => p.inGov);
    const opposition = players.filter((p) => p.inOpp);
    const independents = players.filter((p) => isIndependent(p) && p.seats > 0);
    const governmentSeats = government.reduce((acc, p) => acc + p.seats, 0);
    const oppositionSeats = opposition.reduce((acc, p) => acc + p.seats, 0);
    const rows = (list: Player[]) =>
      [...list]
        .sort((a, b) => b.seats - a.seats)
        .map((p) => ({ label: p.party.name, seats: p.seats, color: p.party.color }));
    const pm = players.find((p) => p.isPM);
    const leader = oppositionLeader(players);
    // The independents get their own board once the government and the opposition have formed.
    const withIndependents = !!pm && !!leader && independents.length > 0;
    drawLedPlaque(
      this.government.canvas,
      L('GOVERNMENT', 'GOVERNO'),
      pm ? `${L('Leader of Congress', 'Líder do Congresso')}: ${pm.party.name}` : L('Forming…', 'Em formação…'),
      governmentSeats,
      '#57e389',
      rows(government),
    );
    drawLedPlaque(
      this.opposition.canvas,
      L('OPPOSITION', 'OPOSIÇÃO'),
      leader ? `${L('Leader', 'Líder')}: ${leader.party.name}` : L('Forming…', 'Em formação…'),
      oppositionSeats,
      '#ff6b6b',
      rows(opposition),
    );
    if (withIndependents) {
      drawLedPlaque(
        this.independents.canvas,
        L('INDEPENDENTS', 'INDEPENDENTES'),
        L('Crossbench', 'Bancada independente'),
        independents.reduce((acc, p) => acc + p.seats, 0),
        '#c9d1de',
        rows(independents),
      );
      this.independents.texture.needsUpdate = true;
    }
    this.government.texture.needsUpdate = true;
    this.opposition.texture.needsUpdate = true;
    // Without a government the portrait goes blank at once; a new leader's portrait is revealed once they sit down.
    if (!pm) this.leaderPortrait.show(null);
    if (!players.some((p) => p.isPresident)) this.presidentPortrait.show(null);

    const from = { ...this.spots };
    const to = BackWall.spotsFor(layout, withIndependents);
    // A board that is only now appearing rises in place instead of sliding in from where it was hidden.
    if (withIndependents && this.independentsRise < 0.001) from.independents = to.independents;
    const riseFrom = this.independentsRise;
    const riseTo = withIndependents ? 1 : 0;
    void this.stage.tween(RESEAT_SECONDS, (k) => {
      const e = easeInOut(k);
      const lerp = (key: keyof Spots) => from[key] + (to[key] - from[key]) * e;
      this.place(
        {
          leader: lerp('leader'),
          president: lerp('president'),
          government: lerp('government'),
          opposition: lerp('opposition'),
          independents: lerp('independents'),
        },
        riseFrom + (riseTo - riseFrom) * e,
      );
    });
  }

  /** Paints the Leader of Congress's portrait at once (null = no government yet). */
  showPortrait(party: PartyDef | null): void {
    this.leaderPortrait.show(party);
  }

  /** Paints the President's portrait at once (null = the Provisional President). */
  showPresident(party: PartyDef | null): void {
    this.presidentPortrait.show(party);
  }

  /** The new Leader of Congress's portrait is revealed. */
  reveal(party: PartyDef): Promise<void> {
    return this.leaderPortrait.reveal(this.stage, this.spots.leader, party);
  }

  /** The new President's portrait is revealed. */
  revealPresident(party: PartyDef): Promise<void> {
    return this.presidentPortrait.reveal(this.stage, this.spots.president, party);
  }
}
