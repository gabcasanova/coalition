import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { THEME } from '../assets/theme';
import { oppositionLeader } from '../core/rules';
import { settings } from '../core/settings';
import type { CardFace, DeckKind, PartyDef, Player } from '../core/types';
import { L } from '../i18n';
import { Tweens } from './animation';
import { CameraDirector, type PawnShot } from './CameraDirector';
import { BackWall } from './parts/BackWall';
import { Chamber } from './parts/Chamber';
import { Decks } from './parts/Decks';
import { Leaders } from './parts/Leaders';
import { Pawns } from './parts/Pawns';
import { Podium } from './parts/Podium';
import { buildTable } from './parts/Table';
import { Track } from './parts/Track';
import { Wheel } from './parts/Wheel';
import type { Stage } from './Stage';
import { headlineTexture } from './textures/cards';

/** Longest frame step, so a stall (e.g. a background tab) doesn't make animations jump. */
const MAX_DT = 1 / 30;

/**
 * The 3D table. This class owns the renderer, the camera and the frame loop, builds the parts of the table
 * (src/render/parts) and is the single entry point the rest of the game uses to show what happens.
 */
export class BoardScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Called when the pointer moves over a board square (index) or off the board (null). */
  onHover?: (index: number | null, x: number, y: number) => void;

  private readonly timer = new THREE.Timer();
  private readonly tweens = new Tweens();
  private readonly director: CameraDirector;
  private readonly track: Track;
  private readonly wheel: Wheel;
  private readonly decks: Decks;
  private readonly pawns: Pawns;
  private readonly chamber: Chamber;
  private readonly leaders: Leaders;
  private readonly backWall: BackWall;
  private readonly podium: Podium;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /** Where the pointer went down, to tell a click on the wheel from a camera drag. */
  private pointerDownAt: { x: number; y: number } | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(THEME.background);
    this.scene.fog = new THREE.Fog(THEME.background, 80, 170);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    const overview = CameraDirector.overviewPose();
    this.camera.position.copy(overview.pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(overview.target);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 100;
    this.controls.autoRotateSpeed = 0.6;
    this.director = new CameraDirector(this.camera, this.controls);

    const stage: Stage = {
      scene: this.scene,
      camera: this.camera,
      director: this.director,
      tween: (seconds, fn) => this.tweens.add(seconds, fn),
      wait: (seconds) => this.tweens.wait(seconds),
    };
    buildTable(this.scene);
    this.track = new Track(stage);
    this.wheel = new Wheel(stage);
    this.decks = new Decks(stage);
    this.chamber = new Chamber(stage);
    this.leaders = new Leaders(stage, this.chamber);
    this.backWall = new BackWall(stage);
    this.podium = new Podium(stage);
    this.scene.updateMatrixWorld(true);
    this.pawns = new Pawns(stage, this.track);

    window.addEventListener('resize', this.onResize);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', (e) => (this.pointerDownAt = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => this.onHover?.(null, 0, 0));
  }

  start(): void {
    this.timer.connect(document);
    this.renderer.setAnimationLoop(this.tick);
  }

  /** When on, the camera director frames the action (wheel, moving pawn, parliament). */
  get cinematic(): boolean {
    return this.director.cinematic;
  }
  set cinematic(on: boolean) {
    this.director.cinematic = on;
  }

  // ───────────────────────────── camera ─────────────────────────────

  focusParliament(): void {
    this.director.parliament();
  }

  focusPawn(id: number, kind: PawnShot): void {
    this.pawns.focus(id, kind);
  }

  // ───────────────────────────── track, wheel and cards ─────────────────────────────

  /** Puts the players' pawns on the board and hands the camera to the director. */
  setPlayers(players: Player[]): void {
    this.pawns.place(players);
    this.controls.autoRotate = false;
    this.director.cinematic = true;
  }

  setActive(id: number): void {
    this.pawns.setActive(id);
  }

  /** Waits for the player to click the roulette wheel. */
  armWheel(): Promise<void> {
    return this.wheel.arm();
  }

  disarmWheel(): void {
    this.wheel.disarm();
    this.renderer.domElement.style.cursor = '';
  }

  spin(result: number): Promise<void> {
    return this.wheel.spin(result);
  }

  movePawn(id: number, from: number, steps: number): Promise<void> {
    return this.pawns.move(id, from, steps);
  }

  flashTile(index: number): void {
    this.track.flash(index);
  }

  floatText(id: number, text: string, color: number): void {
    this.pawns.floatText(id, text, color);
  }

  /** A card is drawn from a deck into a player's hand; `face` shows it to everyone first. */
  drawCard(kind: DeckKind, playerId: number, face?: CardFace): Promise<void> {
    return this.decks.draw(kind, this.pawns.get(playerId), face);
  }

  /** Opening deal: `perPlayer` cards fly from a deck to each player. */
  dealCards(kind: DeckKind, playerIds: number[], perPlayer: number): Promise<void> {
    const receivers = playerIds.map((id) => this.pawns.get(id)).filter((p): p is THREE.Group => !!p);
    return this.decks.deal(kind, receivers, perPlayer);
  }

  // ───────────────────────────── parliament ─────────────────────────────

  /** Re-seats parliament and updates everything that depends on it (scoreboards, portrait, leaders). */
  updateSeats(players: Player[]): void {
    const { aisleAngle, hasAisle } = this.chamber.update(players);
    this.backWall.update(players, aisleAngle, hasAisle);
    this.leaders.update(players);
  }

  updatePodium(rows: { party: PartyDef; wins: number }[]): void {
    this.podium.update(rows);
  }

  /**
   * After a vote: the winners' MPs and pawns jump for joy, the losers shake their heads, a big headline floats
   * over the chamber and the camera sweeps around it.
   */
  async reactVote(happyIds: number[], sadIds: number[], text: string, color: number): Promise<void> {
    const happy = new Set(happyIds);
    const sad = new Set(sadIds);
    const startTime = this.director.time;
    const target = new THREE.Vector3(0, 1.2, -10);
    this.director.frame(() => {
      const a = -0.65 + Math.min(1.3, (this.director.time - startTime) * 0.42);
      return { pos: new THREE.Vector3(Math.sin(a) * 16, 19, -10 + Math.cos(a) * 16), target, rate: 2.4 };
    });
    const headline = this.showHeadline(text, color, new THREE.Vector3(0, 7.5, -9));
    await this.tweens.add(3.2, (k) => {
      const fade = 1 - Math.max(0, (k - 0.8) / 0.2);
      this.chamber.react(k, fade, happy, sad);
      this.pawns.react(k, fade, happy, sad);
      headline.frame(k, fade);
    });
    this.chamber.resetPoses();
    this.pawns.resetPoses();
    headline.remove();
  }

  /** `n` MPs walk across the floor from one party's benches to another's. */
  async floorCross(fromId: number, toId: number, n: number, toColor: number): Promise<void> {
    if (this.director.cinematic) {
      this.director.parliament();
      await this.tweens.wait(0.7);
    }
    await this.chamber.floorCross(fromId, toId, n, toColor);
  }

  /** The new Prime Minister walks to their chair, then their official portrait is revealed. */
  async pmTakesSeat(id: number, players: Player[]): Promise<void> {
    const pm = players.find((q) => q.id === id);
    if (!pm) return;
    await this.leaders.walk('pm', pm, true);
    await this.tweens.wait(0.4);
    await this.backWall.reveal(pm.party);
  }

  /** The opposition rises in a wave under a headline, then its leader walks to their chair. */
  async oppositionForms(leaderId: number, memberIds: number[], players: Player[]): Promise<void> {
    const leader = players.find((q) => q.id === leaderId);
    if (!leader) return;
    if (this.director.cinematic) {
      this.director.frame({ pos: new THREE.Vector3(-1, 13, 10), target: new THREE.Vector3(-9.5, 1.2, -5), rate: 2.2 });
      await this.tweens.wait(0.8);
    }
    const headline = this.showHeadline(
      L('OPPOSITION FORMED', 'OPOSIÇÃO FORMADA'),
      THEME.bad,
      new THREE.Vector3(-9, 6.5, -6),
    );
    const wave = this.chamber.oppositionWave(memberIds, 2.6);
    await this.tweens.add(2.6, (k) => headline.frame(k, 1 - Math.max(0, (k - 0.85) / 0.15)));
    await wave;
    headline.remove();
    await this.leaders.walk('opp', leader, true);
    await this.tweens.wait(0.5);
  }

  /** Puts both leaders straight in their chairs and shows the PM's portrait (no animation): behind the title screen. */
  seatLeaders(players: Player[]): void {
    const pm = players.find((q) => q.isPM);
    const leader = oppositionLeader(players);
    if (pm) {
      this.leaders.place('pm', pm);
      this.backWall.showPortrait(pm.party);
    }
    if (leader) this.leaders.place('opp', leader);
  }

  /** A big glowing headline over the chamber, bobbing and fading with `frame(k, fade)`. */
  private showHeadline(text: string, color: number, at: THREE.Vector3) {
    const texture = headlineTexture(text, color);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sign = new THREE.Sprite(material);
    sign.scale.set(9, 1.9, 1);
    sign.position.copy(at);
    sign.renderOrder = 15;
    this.scene.add(sign);
    return {
      frame: (k: number, fade: number) => {
        sign.position.y = at.y + Math.sin(k * Math.PI) * 0.55;
        material.opacity = Math.min(1, k * 5) * fade;
      },
      remove: () => {
        this.scene.remove(sign);
        texture.dispose();
        material.dispose();
      },
    };
  }

  /** End of game: a slow orbit around the whole table. */
  celebrate(): void {
    this.director.cinematic = false;
    this.pawns.hideMarker();
    this.controls.autoRotate = true;
  }

  // ───────────────────────────── frame loop and input ─────────────────────────────

  private tick = (time: number) => {
    this.timer.update(time);
    const dt = THREE.MathUtils.clamp(this.timer.getDelta(), 0, MAX_DT);
    this.tweens.update(dt, settings.speed);
    this.director.update(dt, settings.speed);
    const t = this.director.time;
    this.pawns.update(t);
    this.wheel.update(t);
    this.track.update(dt, t);
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  /** Aims the raycaster at the pointer position of `e`. */
  private aim(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private onPointerMove = (e: PointerEvent) => {
    this.aim(e);
    const hit = this.raycaster.intersectObjects(this.track.tileMeshes, false)[0];
    this.onHover?.(hit ? (hit.object.userData.index as number) : null, e.clientX, e.clientY);
    if (this.wheel.armed) this.renderer.domElement.style.cursor = this.wheel.isHitBy(this.raycaster) ? 'pointer' : '';
  };

  /** A click (not a drag) on the armed wheel spins it. */
  private onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDownAt;
    this.pointerDownAt = null;
    if (!this.wheel.armed || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    this.aim(e);
    if (!this.wheel.isHitBy(this.raycaster)) return;
    this.renderer.domElement.style.cursor = '';
    this.wheel.click();
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
