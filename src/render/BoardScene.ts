import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOARD, isAnchor, SQUARE_META } from '../core/board';
import { benchOrder, BOARD_SIZE, TOTAL_SEATS } from '../core/rules';
import { L } from '../core/i18n';
import { settings } from '../core/settings';
import type { CardFace, DeckKind, Player } from '../core/types';
import { cardFaceTexture, deckTexture, drawPortrait, nameplateTexture, headlineTexture, drawLedPlaque, portraitCanvas, floatTexture, labelTexture, plaqueCanvas, tileTexture, titleTexture, wheelTexture } from './textures';

const RING_R = 22;
const TILE_DEPTH = 4;
const TILE_W = ((2 * Math.PI * RING_R) / BOARD_SIZE) * 0.94;
const WHEEL_R = 6;
const MAX_DT = 1 / 30;

// Parliament benches: 7 tiered rows, and the aisle between the government and opposition blocks (radians).
const ROW_RADII = Array.from({ length: 7 }, (_, i) => 8.3 + i * 1.3);
const ROW_HEIGHTS = ROW_RADII.map((_, i) => 0.25 + i * 0.26);
const AISLE_GAP = 0.32;
/** Angle left free at each end of the hemicycle for the Prime Minister's and the Opposition Leader's daises. */
const END_GAP = 0.24;
/** Leader figures are big peg people. */
const LEADER_SCALE = 2.2;
/** Where the "race to win" podium stands: beside the opposition benches, facing the camera side. */
const PODIUM_POS = new THREE.Vector3(-12.8, 0, 2.7);

/** A little peg person (Game of Life style): rounded body plus a ball head. Origin sits 0.3 above the bench. */
function pegGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.12, 0.17, 0.42, 14);
  body.translate(0, 0.21, 0);
  const head = new THREE.SphereGeometry(0.15, 16, 12);
  head.translate(0, 0.58, 0);
  const peg = mergeGeometries([body, head])!;
  peg.translate(0, -0.3, 0);
  return peg;
}

/** The card decks on the table, left to right as seen from the camera side. */
const DECKS: { kind: DeckKind; title: string; icon: string; color: number; height: number }[] = [
  { kind: 'law', title: L('LAW', 'LEIS'), icon: '🏛️', color: 0x5b43c4, height: 0.9 },
  { kind: 'media', title: L('MEDIA', 'MÍDIA'), icon: '📺', color: 0x1a7fd0, height: 0.5 },
  { kind: 'strategy', title: L('STRATEGY', 'ESTRATÉGIA'), icon: '🃏', color: 0x8a6d2b, height: 0.8 },
  { kind: 'lobby', title: L('LOBBY', 'LOBBY'), icon: '💼', color: 0x239a55, height: 0.6 },
  { kind: 'crisis', title: L('CRISIS', 'CRISE'), icon: '⚠️', color: 0xc0302b, height: 0.7 },
  { kind: 'global', title: L('GLOBAL CRISIS', 'CRISE GLOBAL'), icon: '🌍', color: 0xd35400, height: 0.65 },
];

/**
 * Squares climb like a spiral staircase: square 1 (just after the election) is the lowest,
 * and the Parliamentary Election (square 0) crowns the year at the top.
 */
export const tileHeight = (i: number) => 0.35 + ((i - 1 + BOARD_SIZE) % BOARD_SIZE) * 0.075 + (isAnchor(BOARD[i]) ? 0.2 : 0);

interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  done: () => void;
}

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** How quickly the camera glides toward this pose (higher = snappier). */
  rate: number;
}

export type PawnShot = 'medium' | 'follow' | 'close';

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** The 3D board: track of 50 squares, roulette wheel, party pawns and the parliament hemicycle. */
export class BoardScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  onHover?: (index: number | null, x: number, y: number) => void;
  /** When on, a camera director frames the action (wheel, moving pawn, parliament). */
  cinematic = false;

  private readonly timer = new THREE.Timer();
  private tweens: Tween[] = [];
  private tileAnchors: THREE.Object3D[] = [];
  private tileTops: THREE.MeshStandardMaterial[] = [];
  private tileMeshes: THREE.Mesh[] = [];
  private readonly wheel = new THREE.Group();
  private readonly podium = new THREE.Group();
  private readonly podiumStatues = new THREE.Group();
  /** Which player sits in each seat, and whether that seat is on the government benches. */
  private seatOwner: number[] = [];
  private seatGov: boolean[] = [];
  private podiumKey = '';
  /** Pending "click the wheel" request from a human spin prompt. */
  private wheelArmed: (() => void) | null = null;
  private wheelGlow!: THREE.Mesh;
  private downAt: { x: number; y: number } | null = null;
  private pawns = new Map<number, THREE.Group>();
  private floats = new Map<number, number>();
  private seatMesh!: THREE.InstancedMesh;
  private seatPos: THREE.Vector3[] = [];
  private seatColors: THREE.Color[] = [];
  private readonly aisle = new THREE.Group();
  private aisleAngle = Math.PI / 2;
  private seatGen = 0;
  /** The Prime Minister and the Leader of the Opposition, standing at their daises. */
  private readonly leaders: Record<'pm' | 'opp', { id: number; fig: THREE.Group } | null> = { pm: null, opp: null };
  private leaderGen = { pm: 0, opp: 0 };
  private readonly benches = new THREE.Group();
  private readonly decks = new Map<DeckKind, { top: THREE.Vector3; inward: THREE.Vector3; color: number; back: THREE.CanvasTexture }>();
  private readonly tierMat = new THREE.MeshStandardMaterial({ color: 0x2b3446, roughness: 0.8 });
  private plaques!: Record<'gov' | 'opp', { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }>;
  private portrait!: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  private portraitKey = '';
  private readonly marker: THREE.Mesh;
  private activeId = -1;
  private elapsed = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private shot: () => Pose = () => this.overviewPose();
  private userDragging = false;
  private userHoldUntil = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0e16);
    this.scene.fog = new THREE.Fog(0x0a0e16, 80, 170);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    const o = this.overviewPose();
    this.camera.position.copy(o.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(o.target);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 100;
    this.controls.autoRotateSpeed = 0.6;
    // Manual camera control temporarily overrides the director.
    this.controls.addEventListener('start', () => (this.userDragging = true));
    this.controls.addEventListener('end', () => {
      this.userDragging = false;
      this.userHoldUntil = this.elapsed + 4;
    });

    this.buildLights();
    this.buildTable();
    this.buildTrack();
    this.buildWheel();
    this.buildHemicycle();
    this.buildDecks();
    this.buildPodium();
    this.buildPortrait();

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.07, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9 }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.scene.updateMatrixWorld(true);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', (e) => (this.downAt = { x: e.clientX, y: e.clientY }));
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointerleave', () => this.onHover?.(null, 0, 0));
  }

  start(): void {
    this.timer.connect(document);
    this.renderer.setAnimationLoop(this.tick);
  }

  // ───────────────────────────── construction ─────────────────────────────

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1a1a24, 1.0));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(18, 42, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = s.bottom = -32;
    s.right = s.top = 32;
    s.near = 1;
    s.far = 110;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    const warm = new THREE.PointLight(0xffc870, 60, 30, 1.6);
    warm.position.set(0, 8, 0);
    this.scene.add(warm);
  }

  private buildTable(): void {
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(31, 32, 1.2, 96),
      new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.7 }),
    );
    table.position.y = -0.6;
    table.receiveShadow = true;
    this.scene.add(table);

    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(29.5, 29.5, 0.1, 96),
      new THREE.MeshStandardMaterial({ color: 0x15301f, roughness: 1 }),
    );
    felt.receiveShadow = true;
    this.scene.add(felt);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RING_R - TILE_DEPTH / 2 - 0.4, RING_R + TILE_DEPTH / 2 + 0.4, 128),
      new THREE.MeshStandardMaterial({ color: 0x8a6d2b, roughness: 0.4, metalness: 0.6 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.receiveShadow = true;
    this.scene.add(ring);
  }

  /** Square i sits at angle i·(2π/50), clockwise from the far side (behind parliament). */
  private buildTrack(): void {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const type = BOARD[i];
      const a = (i / BOARD_SIZE) * Math.PI * 2;
      const pos = new THREE.Vector3(RING_R * Math.sin(a), 0, -RING_R * Math.cos(a));
      const group = new THREE.Group();
      group.position.copy(pos);
      group.lookAt(pos.clone().multiplyScalar(2)); // local +z points outward
      this.scene.add(group);

      const h = tileHeight(i);
      const color = new THREE.Color(SQUARE_META[type].color);
      const side = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.45), roughness: 0.6 });
      const top = new THREE.MeshStandardMaterial({ map: tileTexture(i, type), roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_W, h, TILE_DEPTH), [side, side, top, side, side, side]);
      mesh.position.y = h / 2 + 0.06;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.index = i;
      group.add(mesh);

      const anchorPt = new THREE.Object3D();
      anchorPt.position.y = h + 0.06;
      group.add(anchorPt);

      this.tileAnchors.push(anchorPt);
      this.tileTops.push(top);
      this.tileMeshes.push(mesh);
    }

    // A golden beacon above the Election square, the summit of every year.
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xb88a10, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.2 }),
    );
    beacon.position.set(0, tileHeight(0) + 3.2, -RING_R - 0.2);
    beacon.userData.spin = true;
    beacon.name = 'beacon';
    this.scene.add(beacon);
  }

  private buildWheel(): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R + 0.5, WHEEL_R + 0.8, 0.8, 64),
      new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.5 }),
    );
    base.position.y = 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(WHEEL_R + 0.35, 0.18, 12, 96),
      new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 0.9, roughness: 0.25 }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.95;
    this.scene.add(rim);

    const face = new THREE.Mesh(
      new THREE.CircleGeometry(WHEEL_R, 96),
      new THREE.MeshStandardMaterial({ map: wheelTexture(), roughness: 0.35, metalness: 0.1 }),
    );
    face.rotation.x = -Math.PI / 2;
    face.receiveShadow = true;
    this.wheel.add(face);

    const hubMat = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 0.9, roughness: 0.25 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.8, 32), hubMat);
    hub.position.y = 0.4;
    hub.castShadow = true;
    this.wheel.add(hub);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), hubMat);
    knob.position.y = 1.0;
    this.wheel.add(knob);

    this.wheel.position.y = 0.82;
    this.scene.add(this.wheel);

    // Pointer on the camera side of the wheel.
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xfff1b0, metalness: 0.6, roughness: 0.3, emissive: 0x6b5410 }),
    );
    pointer.geometry.rotateX(-Math.PI / 2);
    pointer.position.set(0, 1.25, WHEEL_R + 0.25);
    pointer.castShadow = true;
    this.scene.add(pointer);

    // Pulsing ring shown while the wheel is waiting to be clicked.
    this.wheelGlow = new THREE.Mesh(
      new THREE.TorusGeometry(WHEEL_R + 0.75, 0.16, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, toneMapped: false }),
    );
    this.wheelGlow.rotation.x = -Math.PI / 2;
    this.wheelGlow.position.y = 1.0;
    this.wheelGlow.visible = false;
    this.scene.add(this.wheelGlow);
  }

  private buildHemicycle(): void {
    this.scene.add(this.benches);

    // The aisle between the two blocks: a red carpet with glowing gold edges.
    const carpet = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.05, 1.5), new THREE.MeshStandardMaterial({ color: 0x7a1424, roughness: 0.9 }));
    carpet.position.set(12.5, 0.08, 0);
    carpet.receiveShadow = true;
    this.aisle.add(carpet);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: 1.2 });
    for (const z of [-0.8, 0.8]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.08, 0.08), edgeMat);
      edge.position.set(12.5, 0.12, z);
      this.aisle.add(edge);
    }
    this.aisle.visible = false;
    this.scene.add(this.aisle);

    // LED scoreboards behind the benches: opposition on the left, government on the right.
    this.plaques = {
      opp: this.buildPlaque((Math.PI * 128) / 180),
      gov: this.buildPlaque((Math.PI * 52) / 180),
    };
    this.buildLeaderStation('pm');
    this.buildLeaderStation('opp');

    this.seatMesh = new THREE.InstancedMesh(
      pegGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.15 }),
      TOTAL_SEATS,
    );
    this.seatMesh.castShadow = true;
    const gray = new THREE.Color(0x5a6273);
    this.seatPos = this.layoutChamber(TOTAL_SEATS);
    const m = new THREE.Matrix4();
    this.seatPos.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      this.seatMesh.setMatrixAt(i, m);
      this.seatMesh.setColorAt(i, gray);
      this.seatColors.push(gray.clone());
    });
    this.scene.add(this.seatMesh);

    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: titleTexture(L('PARLIAMENT', 'PARLAMENTO'), L('150 seats · 76 for a majority', '150 cadeiras · 76 para a maioria')), transparent: true, depthWrite: false }),
    );
    title.rotation.x = -Math.PI / 2;
    title.position.set(0, 0.08, -7.1);
    title.scale.setScalar(0.5);
    this.scene.add(title);
  }

  /**
   * Seat positions for a chamber physically split into two blocks: opposition on the left,
   * government on the right, with an aisle between them. Each block's width follows its seat
   * count. Rebuilds the bench tiers to match and returns positions ordered left to right.
   */
  private layoutChamber(oppSeats: number): THREE.Vector3[] {
    const govSeats = TOTAL_SEATS - oppSeats;
    const gap = oppSeats > 0 && govSeats > 0 ? AISLE_GAP : 0;
    // The benches span [END_GAP, π − END_GAP]; the free ends hold the leaders' daises. Government block: [END_GAP, split].
    const split = END_GAP + (govSeats / TOTAL_SEATS) * (Math.PI - 2 * END_GAP - gap);
    this.aisleAngle = split + gap / 2;
    const blocks = [
      { n: oppSeats, from: Math.PI - END_GAP, to: split + gap },
      { n: govSeats, from: split, to: END_GAP },
    ];

    for (const child of [...this.benches.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.benches.remove(child);
    }

    const out: THREE.Vector3[] = [];
    for (const b of blocks) {
      if (b.n <= 0) continue;
      const span = b.from - b.to;
      const total = ROW_RADII.reduce((acc, r) => acc + r, 0);
      const counts = ROW_RADII.map((r) => Math.floor((b.n * r) / total));
      let rem = b.n - counts.reduce((acc, x) => acc + x, 0);
      for (let i = counts.length - 1; rem > 0; i = (i - 1 + counts.length) % counts.length, rem--) counts[i]++;

      const seats: { pos: THREE.Vector3; phi: number; row: number }[] = [];
      ROW_RADII.forEach((r, row) => {
        const n = counts[row];
        for (let j = 0; j < n; j++) {
          const phi = b.from - ((j + 0.5) / n) * span;
          seats.push({ pos: new THREE.Vector3(r * Math.cos(phi), ROW_HEIGHTS[row] + 0.3, -r * Math.sin(phi)), phi, row });
        }
        const shape = new THREE.Shape();
        shape.absarc(0, 0, r + 0.65, b.to, b.from, false);
        shape.absarc(0, 0, r - 0.65, b.from, b.to, true);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: ROW_HEIGHTS[row], bevelEnabled: false, curveSegments: 32 });
        geo.rotateX(-Math.PI / 2);
        const tier = new THREE.Mesh(geo, this.tierMat);
        tier.receiveShadow = true;
        tier.castShadow = true;
        this.benches.add(tier);
      });
      seats.sort((x, y) => y.phi - x.phi || x.row - y.row);
      out.push(...seats.map((x) => x.pos));
    }
    return out;
  }

  /** An LED board on two posts, standing behind the back row at angle `phi` and facing the chamber. */
  private buildPlaque(phi: number): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
    const r = 18.8;
    const W = 8;
    const H = 3.75;
    const bottom = 1.9;
    const group = new THREE.Group();
    group.position.set(r * Math.cos(phi), 0, -r * Math.sin(phi));
    group.lookAt(0, 0, 0);
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
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    screen.position.set(0, bottom + H / 2, 0.16);
    group.add(screen);
    // Soft glow spilling onto the benches.
    const glow = new THREE.PointLight(0x88aaff, 8, 9, 2);
    glow.position.set(0, bottom + H / 2, 1.2);
    group.add(glow);
    this.scene.add(group);
    return { canvas, texture };
  }

  /** One labelled deck per card type, in an arc between the wheel and the track (camera side). */
  private buildDecks(): void {
    const side = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.9 });
    DECKS.forEach((d, i) => {
      const phi = THREE.MathUtils.degToRad(-147.5 + i * 23);
      const r = 13.2;
      const pos = new THREE.Vector3(r * Math.cos(phi), 0, -r * Math.sin(phi));
      const back = deckTexture(d.title, d.icon, d.color);
      const top = new THREE.MeshStandardMaterial({ map: back, roughness: 0.5 });
      const h = d.height;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, 3.64), [side, side, top, side, side, side]);
      deck.position.set(pos.x, h / 2 + 0.06, pos.z);
      deck.lookAt(pos.x * 2, h / 2 + 0.06, pos.z * 2); // card art reads from the camera side
      deck.castShadow = true;
      deck.receiveShadow = true;
      this.scene.add(deck);
      this.decks.set(d.kind, { top: new THREE.Vector3(pos.x, h + 0.08, pos.z), inward: pos.clone().negate().normalize(), color: d.color, back });
    });
  }

  // ───────────────────────────── camera director ─────────────────────────────

  private overviewPose(): Pose {
    return { pos: new THREE.Vector3(0, 46, 46), target: new THREE.Vector3(0, 0, 1), rate: 1.6 };
  }

  focusOverview(): void {
    this.shot = () => this.overviewPose();
  }

  focusWheel(): void {
    const pose: Pose = { pos: new THREE.Vector3(0, 21, 25), target: new THREE.Vector3(0, 0.6, 1.5), rate: 2.6 };
    this.shot = () => pose;
  }

  /** Close shot of a deck from the camera side of the table. */
  focusDeck(kind: DeckKind): void {
    const d = this.decks.get(kind);
    if (!d) return;
    const out = d.inward.clone().negate();
    const pose: Pose = {
      pos: d.top.clone().addScaledVector(out, 11).add(new THREE.Vector3(0, 10, 0)),
      target: d.top.clone().addScaledVector(d.inward, 2),
      rate: 2.6,
    };
    this.shot = () => pose;
  }

  focusParliament(): void {
    const pose: Pose = { pos: new THREE.Vector3(0, 24, 17), target: new THREE.Vector3(0, 2, -9), rate: 2 };
    this.shot = () => pose;
  }

  /** Frame a pawn from outside the ring, looking inward so its square is readable. */
  focusPawn(id: number, kind: PawnShot): void {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    const [back, up, rate] = kind === 'medium' ? [25, 20, 2] : kind === 'follow' ? [18, 14, 3] : [14, 11, 2.4];
    this.shot = () => {
      const p = pawn.position;
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      return {
        pos: new THREE.Vector3(p.x + out.x * back, p.y + up, p.z + out.z * back),
        target: new THREE.Vector3(p.x - out.x * 2, p.y + 0.6, p.z - out.z * 2),
        rate,
      };
    };
  }

  private direct(dt: number): void {
    if (!this.cinematic || this.userDragging || this.elapsed < this.userHoldUntil) return;
    const s = this.shot();
    // Narrow (portrait) screens see less horizontally, so pull the camera back.
    const back = THREE.MathUtils.clamp(1.3 / this.camera.aspect, 1, 1.5);
    const pos = s.pos.clone().sub(s.target).multiplyScalar(back).add(s.target);
    const k = 1 - Math.exp(-s.rate * dt * Math.min(settings.speed, 2.5));
    this.camera.position.lerp(pos, k);
    this.controls.target.lerp(s.target, k);
  }

  // ───────────────────────────── game hooks ─────────────────────────────

  setPlayers(players: Player[]): void {
    for (const p of players) {
      const pawn = this.makePawn(p);
      pawn.position.copy(this.slot(0, p.id));
      this.restY.set(p.id, pawn.position.y);
      this.pawns.set(p.id, pawn);
      this.scene.add(pawn);
    }
    this.controls.autoRotate = false;
    this.cinematic = true;
  }

  setActive(id: number): void {
    this.activeId = id;
    this.marker.visible = id >= 0;
  }

  /** Swing to the wheel and spin it so number `result` stops under the pointer. */
  /** Wait for the player to click the roulette wheel (a click, not a camera drag). */
  armWheel(): Promise<void> {
    if (this.cinematic) this.focusWheel();
    this.wheelGlow.visible = true;
    return new Promise((resolve) => (this.wheelArmed = resolve));
  }

  disarmWheel(): void {
    this.wheelArmed = null;
    this.wheelGlow.visible = false;
    this.renderer.domElement.style.cursor = '';
  }

  async spin(result: number): Promise<void> {
    if (this.cinematic) {
      this.focusWheel();
      await this.wait(0.7);
    }
    const seg = (Math.PI * 2) / 10;
    const phi = (result - 1 + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6;
    const base = phi - Math.PI / 2;
    const cur = this.wheel.rotation.y;
    const delta = (((base - cur) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const target = cur + delta + Math.PI * 2 * 4;
    await this.tween(2.4, (k) => {
      this.wheel.rotation.y = cur + (target - cur) * easeOutCubic(k);
    });
    await this.wait(0.35);
  }

  async movePawn(id: number, from: number, steps: number): Promise<void> {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    this.focusPawn(id, 'follow');
    await this.wait(0.45);
    for (let s = 1; s <= steps; s++) {
      const a = this.slot((from + s - 1) % BOARD_SIZE, id);
      const b = this.slot((from + s) % BOARD_SIZE, id);
      await this.tween(0.26, (k) => {
        const e = easeInOut(k);
        pawn.position.lerpVectors(a, b, e);
        pawn.position.y = a.y + (b.y - a.y) * e + Math.sin(k * Math.PI) * 0.9;
      });
    }
    this.restY.set(id, pawn.position.y);
    this.focusPawn(id, 'close');
  }

  /**
   * A card lifts off its deck; if `face` is given it flies up to the camera and flips to show what was
   * drawn (so the event isn't just "random"), then it drops into the player's hand at their pawn.
   */
  async drawCard(kind: DeckKind, playerId: number, face?: CardFace): Promise<void> {
    const d = this.decks.get(kind);
    if (!d) return;
    if (this.cinematic) {
      this.focusDeck(kind);
      await this.wait(0.7);
    }

    const W = 2.4;
    const H = 3.36;
    const faceTex = face ? cardFaceTexture(face, d.color) : null;
    const mats = [faceTex ?? d.back, d.back].map((map) => new THREE.MeshBasicMaterial({ map, toneMapped: false, transparent: true, depthTest: false }));
    const geo = new THREE.PlaneGeometry(W, H);
    const front = new THREE.Mesh(geo, mats[0]);
    const back = new THREE.Mesh(geo, mats[1]);
    back.rotation.y = Math.PI;
    const card = new THREE.Group();
    card.add(front, back);
    card.renderOrder = 20;
    front.renderOrder = back.renderOrder = 20;

    // Start lying face-down on the deck, its top edge pointing to the centre of the table.
    const z = new THREE.Vector3(0, -1, 0);
    const y = d.inward.clone();
    const x = new THREE.Vector3().crossVectors(y, z);
    const qStart = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    card.position.copy(d.top);
    card.quaternion.copy(qStart);
    this.scene.add(card);

    await this.tween(0.4, (k) => {
      card.position.y = d.top.y + easeOutCubic(k) * 1.5;
    });

    if (face) {
      const lifted = card.position.clone();
      const dir = new THREE.Vector3();
      const present = () => {
        this.camera.getWorldDirection(dir);
        return this.camera.position.clone().addScaledVector(dir, 6.5);
      };
      await this.tween(0.8, (k) => {
        const e = easeInOut(k);
        card.position.lerpVectors(lifted, present(), e);
        card.quaternion.slerpQuaternions(qStart, this.camera.quaternion, e);
      });
      await this.tween(1.8, () => {
        card.position.copy(present());
        card.quaternion.copy(this.camera.quaternion);
      });
    }

    // Into the player's hand.
    const pawn = this.pawns.get(playerId);
    const from = card.position.clone();
    const startScale = card.scale.x;
    await this.tween(0.55, (k) => {
      const e = easeInOut(k);
      const to = pawn ? pawn.position.clone().add(new THREE.Vector3(0, 2, 0)) : from;
      card.position.lerpVectors(from, to, e);
      card.scale.setScalar(startScale * (1 - e * 0.85));
      for (const m of mats) m.opacity = 1 - Math.max(0, (e - 0.6) / 0.4);
    });
    this.scene.remove(card);
    geo.dispose();
    for (const m of mats) m.dispose();
    faceTex?.dispose();
  }

  /** Opening deal: `perPlayer` face-down cards fly round-robin from a deck to every pawn. */
  async dealCards(kind: DeckKind, playerIds: number[], perPlayer: number): Promise<void> {
    const d = this.decks.get(kind);
    if (!d) return;
    if (this.cinematic) {
      const pose: Pose = { pos: new THREE.Vector3(0, 30, 34), target: new THREE.Vector3(0, 0, 6), rate: 2 };
      this.shot = () => pose;
      await this.wait(0.8);
    }
    const geo = new THREE.PlaneGeometry(2.4, 3.36);
    const mat = new THREE.MeshBasicMaterial({ map: d.back, toneMapped: false, side: THREE.DoubleSide });
    const flights: Promise<void>[] = [];
    let n = 0;
    for (let round = 0; round < perPlayer; round++) {
      for (const id of playerIds) {
        const pawn = this.pawns.get(id);
        if (!pawn) continue;
        const delay = n++ * 0.11;
        flights.push(
          this.wait(delay).then(async () => {
            const card = new THREE.Mesh(geo, mat);
            card.rotation.x = -Math.PI / 2;
            card.position.copy(d.top);
            this.scene.add(card);
            const from = d.top.clone();
            const to = pawn.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            const spin = (Math.random() - 0.5) * 2;
            await this.tween(0.7, (k) => {
              const e = easeInOut(k);
              card.position.lerpVectors(from, to, e);
              card.position.y += Math.sin(k * Math.PI) * 5;
              card.rotation.z = spin * k * Math.PI;
              card.scale.setScalar(1 - e * 0.7);
            });
            this.scene.remove(card);
          }),
        );
      }
    }
    await Promise.all(flights);
    geo.dispose();
    mat.dispose();
    this.focusOverview();
  }

  flashTile(index: number): void {
    const mat = this.tileTops[index];
    void this.tween(1.1, (k) => {
      mat.emissiveIntensity = Math.sin(k * Math.PI) * 0.45;
    });
  }

  /** Floating "+5" / "−3" above a pawn, rising and fading. */
  floatText(id: number, text: string, color: number): void {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    const stack = this.floats.get(id) ?? 0;
    this.floats.set(id, stack + 1);
    const tex = floatTexture(text, color);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.9, 1);
    sprite.renderOrder = 10;
    const start = pawn.position.clone().add(new THREE.Vector3(0, 2.6 + stack * 0.9, 0));
    sprite.position.copy(start);
    this.scene.add(sprite);
    void this.tween(2.2, (k) => {
      sprite.position.set(start.x, start.y + easeOutCubic(k) * 1.6, start.z);
      mat.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }).then(() => {
      this.scene.remove(sprite);
      tex.dispose();
      mat.dispose();
      this.floats.set(id, Math.max(0, (this.floats.get(id) ?? 1) - 1));
    });
  }

  /** Re-seat parliament: opposition block left, government block right; seats glide to their new benches. */
  updateSeats(players: Player[]): void {
    const order = benchOrder(players);
    const govSeats = players.filter((p) => p.inGov).reduce((acc, p) => acc + p.seats, 0);
    const targetPos = this.layoutChamber(TOTAL_SEATS - govSeats);
    this.updatePlaques(players);
    this.updateLeaders(players);

    const targets: THREE.Color[] = [];
    const gov: boolean[] = [];
    const owner: number[] = [];
    for (const p of order) {
      for (let i = 0; i < p.seats; i++) {
        targets.push(new THREE.Color(p.party.color));
        gov.push(p.inGov);
        owner.push(p.id);
      }
    }
    while (targets.length < TOTAL_SEATS) {
      targets.push(new THREE.Color(0x5a6273));
      gov.push(false);
      owner.push(-1);
    }
    this.seatOwner = owner;
    this.seatGov = gov;

    const showAisle = govSeats > 0 && govSeats < TOTAL_SEATS;
    const fromAngle = this.aisle.visible ? this.aisle.rotation.y : this.aisleAngle;
    const toAngle = this.aisleAngle;
    this.aisle.visible = showAisle;

    const gen = ++this.seatGen;
    const fromPos = this.seatPos.map((v) => v.clone());
    const fromCol = this.seatColors.map((c) => c.clone());
    const tmp = new THREE.Vector3();
    void this.tween(1.3, (k) => {
      if (gen !== this.seatGen) return; // superseded by a newer re-seating
      const e = easeInOut(k);
      for (let i = 0; i < TOTAL_SEATS; i++) {
        tmp.lerpVectors(fromPos[i], targetPos[i], e);
        this.seatPos[i].copy(tmp);
        this.setSeat(i, Math.sin(k * Math.PI) * 0.8);
        this.seatColors[i].copy(fromCol[i]).lerp(targets[i], e);
        this.seatMesh.setColorAt(i, this.seatColors[i]);
      }
      this.seatMesh.instanceMatrix.needsUpdate = true;
      this.seatMesh.instanceColor!.needsUpdate = true;
      this.aisle.rotation.y = fromAngle + (toAngle - fromAngle) * e;
    });
  }

  /** Redraws both LED boards. */
  private updatePlaques(players: Player[]): void {
    const gov = players.filter((p) => p.inGov);
    const opp = players.filter((p) => !p.inGov);
    const govSeats = gov.reduce((acc, p) => acc + p.seats, 0);
    const rows = (list: Player[]) => [...list].sort((a, b) => b.seats - a.seats).map((p) => ({ label: p.party.name, seats: p.seats, color: p.party.color }));
    const pm = players.find((p) => p.isPM);
    const leader = [...opp].sort((a, b) => b.seats - a.seats)[0];
    drawLedPlaque(this.plaques.gov.canvas, L('GOVERNMENT', 'GOVERNO'), pm ? `PM: ${pm.party.name}` : L('Forming…', 'Em formação…'), govSeats, '#57e389', rows(gov));
    drawLedPlaque(this.plaques.opp.canvas, L('OPPOSITION', 'OPOSIÇÃO'), leader && gov.length ? `${L('Leader', 'Líder')}: ${leader.party.name}` : L('All parties', 'Todos os partidos'), TOTAL_SEATS - govSeats, '#ff6b6b', rows(opp));
    this.plaques.gov.texture.needsUpdate = true;
    this.plaques.opp.texture.needsUpdate = true;
    this.updatePortrait(pm);
  }

  /** Angle of a leader's dais: the government end (right) for the PM, the opposition end (left) for its leader. */
  private daisPhi(role: 'pm' | 'opp'): number {
    return role === 'pm' ? END_GAP / 2 : Math.PI - END_GAP / 2;
  }

  /** World position on the floor of the chamber at radius `r` and angle `phi`. */
  private polar(r: number, phi: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3(r * Math.cos(phi), y, -r * Math.sin(phi));
  }

  /**
   * A leader's place at the end of the chamber: a raised dais with a high-backed chair, and a lectern with a
   * microphone facing the chamber. Built in a local frame whose +x axis points outward along the dais angle.
   */
  private buildLeaderStation(role: 'pm' | 'opp'): void {
    const g = new THREE.Group();
    g.rotation.y = this.daisPhi(role);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.55 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a83a, metalness: 0.85, roughness: 0.3 });
    const leather = new THREE.MeshStandardMaterial({ color: role === 'pm' ? 0x1f6b3a : 0x7a1f2b, roughness: 0.6 });
    const add = (m: THREE.Mesh, x: number, y: number, z = 0) => {
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    // Dais with a step and a gold edge.
    add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 1.9), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 })), 10.6, 0.18);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.6), wood), 8.1, 0.09);
    add(new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.05, 1.92), gold), 10.6, 0.37);
    // High-backed chair at the back of the dais, facing the chamber.
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.1), wood), 12.1, 0.62);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.1), leather), 12.1, 0.94);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.9, 1.2), leather), 12.6, 1.45);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 1.3), gold), 12.6, 2.45);
    for (const z of [-0.6, 0.6]) add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), gold), 12.1, 1.25, z);
    // Lectern: a tapered wooden stand with a slanted top and a name plate facing the chamber.
    const stand = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 4, 1), wood), 9.4, 0.96);
    stand.rotation.y = Math.PI / 4;
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.05), wood), 9.4, 1.6);
    top.rotation.z = 0.28;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.4),
      new THREE.MeshBasicMaterial({ map: nameplateTexture(role === 'pm' ? L('PRIME MINISTER', 'PRIMEIRO-MINISTRO') : L('LEADER OF THE OPPOSITION', 'LÍDER DA OPOSIÇÃO'), role === 'pm' ? '#57e389' : '#ff6b6b'), toneMapped: false }),
    );
    plate.position.set(8.98, 1.08, 0);
    plate.rotation.y = -Math.PI / 2;
    g.add(plate);
    // Gooseneck microphone, bending toward the speaker.
    const mic = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.35 });
    const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mic), 9.62, 1.9);
    neck.rotation.z = -0.55;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mic), 9.78, 2.15);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })), 9.5, 1.68, 0.3);
    this.scene.add(g);
  }

  /** A leader's figure: a big peg person in the party colour with the party emblem above it. */
  private makeLeader(p: Player): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pegGeometry(), new THREE.MeshStandardMaterial({ color: p.party.color, roughness: 0.4, metalness: 0.2 }));
    body.scale.setScalar(LEADER_SCALE);
    body.castShadow = true;
    g.add(body);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(p.party.short, p.party.color, p.party.icon), depthWrite: false }));
    label.scale.set(1.1, 1.03, 1);
    label.position.y = 1.75;
    g.add(label);
    return g;
  }

  /** Where a leader stands at the dais (origin of a peg sits 0.3 above the floor it stands on). */
  private daisSpot(role: 'pm' | 'opp'): THREE.Vector3 {
    return this.polar(11.3, this.daisPhi(role), 0.38 + 0.3 * LEADER_SCALE);
  }

  /** Centre of a party's benches (after any re-seating has finished). */
  private benchCentre(id: number): THREE.Vector3 | null {
    const mine = this.seatOwner.map((o, i) => (o === id ? i : -1)).filter((i) => i >= 0);
    if (!mine.length) return null;
    const c = new THREE.Vector3();
    for (const i of mine) c.add(this.seatPos[i]);
    return c.divideScalar(mine.length);
  }

  private removeLeader(role: 'pm' | 'opp'): void {
    const cur = this.leaders[role];
    if (!cur) return;
    this.leaders[role] = null;
    this.leaderGen[role]++;
    const fig = cur.fig;
    void this.tween(0.5, (k) => fig.scale.setScalar(Math.max(0.001, 1 - k))).then(() => this.scene.remove(fig));
  }

  /**
   * Walks a leader from their party's benches down to the chamber floor, around the well (clear of the wheel)
   * and up onto their dais. `camera` follows the walk when the cinematic camera is on.
   */
  private async walkLeader(role: 'pm' | 'opp', p: Player, camera: boolean): Promise<void> {
    this.removeLeader(role);
    const gen = ++this.leaderGen[role];
    await this.wait(1.4); // let the re-seating finish first
    if (gen !== this.leaderGen[role]) return;
    const fig = this.makeLeader(p);
    const lift = 0.3 * LEADER_SCALE;
    const end = this.daisSpot(role);
    const start = this.benchCentre(p.id) ?? end.clone();
    const startPhi = Math.atan2(-start.z, start.x);
    const endPhi = this.daisPhi(role);
    const pts: THREE.Vector3[] = [start.clone().setY(start.y - 0.3 + lift)];
    const WELL = 7.35;
    const steps = Math.max(1, Math.ceil(Math.abs(endPhi - startPhi) / 0.15));
    for (let s = 0; s <= steps; s++) pts.push(this.polar(WELL, startPhi + ((endPhi - startPhi) * s) / steps, lift));
    pts.push(this.polar(8.1, endPhi, 0.18 + lift), end);
    const lens = pts.slice(1).map((q, i) => q.distanceTo(pts[i]));
    const total = lens.reduce((a, b) => a + b, 0);
    const at = (d: number) => {
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i] || i === lens.length - 1) return pts[i].clone().lerp(pts[i + 1], Math.min(1, d / (lens[i] || 1)));
        d -= lens[i];
      }
      return end.clone();
    };
    fig.position.copy(pts[0]);
    fig.scale.setScalar(0.001);
    this.scene.add(fig);
    this.leaders[role] = { id: p.id, fig };
    if (camera && this.cinematic) {
      this.shot = () => {
        const f = fig.position;
        return { pos: new THREE.Vector3(f.x * 0.55, f.y + 7.5, f.z + 12), target: new THREE.Vector3(f.x, f.y + 0.8, f.z), rate: 2.4 };
      };
    }
    await this.tween(0.35, (k) => fig.scale.setScalar(Math.max(0.001, k)));
    const dur = THREE.MathUtils.clamp(total / 5.5, 2.2, 4.5);
    await this.tween(dur, (k) => {
      if (gen !== this.leaderGen[role]) return;
      const e = easeInOut(k);
      fig.position.copy(at(e * total));
      fig.position.y += Math.abs(Math.sin(k * dur * Math.PI * 3.2)) * 0.18;
      fig.rotation.z = Math.sin(k * dur * Math.PI * 3.2) * 0.08;
    });
    if (gen !== this.leaderGen[role]) return;
    fig.position.copy(end);
    fig.rotation.z = 0;
    // Arrival: a proud little hop.
    await this.tween(0.7, (k) => (fig.position.y = end.y + Math.abs(Math.sin(k * Math.PI * 2)) * 0.45));
    fig.position.copy(end);
  }

  /** The new Prime Minister walks from their benches to the PM's dais (awaited by the engine). */
  async pmTakesSeat(id: number, players: Player[], instant = false): Promise<void> {
    const p = players.find((q) => q.id === id);
    if (!p) return;
    if (instant) {
      this.removeLeader('pm');
      const fig = this.makeLeader(p);
      fig.position.copy(this.daisSpot('pm'));
      this.scene.add(fig);
      this.leaders.pm = { id, fig };
      return;
    }
    await this.walkLeader('pm', p, true);
    await this.wait(0.6);
  }

  /** Keeps the leader figures in step with the chamber: the PM leaves when they lose office; the Opposition Leader follows the largest opposition party. */
  private updateLeaders(players: Player[]): void {
    const pm = players.find((q) => q.isPM);
    if (this.leaders.pm && (!pm || pm.id !== this.leaders.pm.id)) this.removeLeader('pm');
    const opp = pm ? [...players].filter((q) => !q.inGov && q.seats > 0).sort((a, b) => b.seats - a.seats || a.id - b.id)[0] : undefined;
    if (!opp) this.removeLeader('opp');
    else if (opp.id !== this.leaders.opp?.id) void this.walkLeader('opp', opp, false);
  }

  /** The official portrait of the Prime Minister, hung behind the chamber between the two LED boards. */
  private buildPortrait(): void {
    const W = 4.4;
    const H = W * 1.5;
    const bottom = 1.5;
    const group = new THREE.Group();
    group.position.set(0, 0, -17.6);
    group.lookAt(0, 0, 0);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.85, roughness: 0.3 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, H + 0.5, 0.28), gold);
    frame.position.y = bottom + H / 2;
    frame.castShadow = true;
    group.add(frame);
    for (const x of [-W / 3, W / 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, bottom, 10), new THREE.MeshStandardMaterial({ color: 0x1c212b, metalness: 0.7, roughness: 0.35 }));
      post.position.set(x, bottom / 2, -0.05);
      group.add(post);
    }
    this.portrait = portraitCanvas();
    this.portrait.texture.colorSpace = THREE.SRGBColorSpace;
    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: this.portrait.texture, toneMapped: false }));
    canvasMesh.position.set(0, bottom + H / 2, 0.15);
    group.add(canvasMesh);
    const lamp = new THREE.PointLight(0xffe2a8, 10, 8, 2);
    lamp.position.set(0, bottom + H + 0.6, 1.4);
    group.add(lamp);
    this.scene.add(group);
    this.updatePortrait(undefined);
  }

  private updatePortrait(pm: Player | undefined): void {
    const key = pm ? `${pm.party.name}|${pm.party.color}|${pm.party.icon}` : '-';
    if (key === this.portraitKey) return;
    this.portraitKey = key;
    drawPortrait(this.portrait.canvas, pm ? pm.party : null, L('PRIME MINISTER', 'PRIMEIRO-MINISTRO'), pm ? pm.party.name : L('Forming a government…', 'Governo em formação…'));
    this.portrait.texture.needsUpdate = true;
  }

  /** Writes one seat's matrix: its bench position, government lift, plus an optional hop and sideways tilt. */
  private setSeat(i: number, hop = 0, tilt = 0): void {
    const p = this.seatPos[i];
    const gov = this.seatGov[i];
    this.seatM.makeTranslation(p.x, p.y + hop + (gov ? 0.18 : 0), p.z);
    if (tilt) this.seatM.multiply(this.seatR.makeRotationZ(tilt));
    if (gov) this.seatM.multiply(this.seatR.makeScale(1.1, 1.25, 1.1));
    this.seatMesh.setMatrixAt(i, this.seatM);
  }
  private readonly seatM = new THREE.Matrix4();
  private readonly seatR = new THREE.Matrix4();

  /**
   * After a vote: the winners' MPs and pawns jump for joy, the losers shake their heads, a big headline floats
   * over the chamber and the camera sweeps around it.
   */
  async reactVote(happyIds: number[], sadIds: number[], text: string, color: number): Promise<void> {
    const happy = new Set(happyIds);
    const sad = new Set(sadIds);
    const t0 = this.elapsed;
    const target = new THREE.Vector3(0, 1.2, -10);
    this.shot = () => {
      const a = -0.65 + Math.min(1.3, (this.elapsed - t0) * 0.42);
      return { pos: new THREE.Vector3(Math.sin(a) * 16, 19, -10 + Math.cos(a) * 16), target, rate: 2.4 };
    };
    const tex = headlineTexture(text, color);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sign = new THREE.Sprite(mat);
    sign.scale.set(9, 1.9, 1);
    sign.position.set(0, 7.5, -9);
    sign.renderOrder = 15;
    this.scene.add(sign);

    await this.tween(3.2, (k) => {
      const fade = 1 - Math.max(0, (k - 0.8) / 0.2);
      for (let i = 0; i < TOTAL_SEATS; i++) {
        const who = this.seatOwner[i];
        if (happy.has(who)) this.setSeat(i, Math.abs(Math.sin(k * Math.PI * 7 + i * 0.4)) * 0.55 * fade);
        else if (sad.has(who)) this.setSeat(i, -0.04 * fade, Math.sin(k * Math.PI * 12 + i * 0.3) * 0.32 * fade);
        else this.setSeat(i);
      }
      this.seatMesh.instanceMatrix.needsUpdate = true;
      for (const [id, pawn] of this.pawns) {
        if (happy.has(id)) pawn.position.y = this.pawnRestY(id) + Math.abs(Math.sin(k * Math.PI * 6)) * 0.7 * fade;
        pawn.rotation.z = sad.has(id) ? Math.sin(k * Math.PI * 10) * 0.3 * fade : 0;
      }
      sign.position.y = 7.5 + Math.sin(k * Math.PI) * 0.6;
      mat.opacity = Math.min(1, k * 5) * fade;
    });
    for (let i = 0; i < TOTAL_SEATS; i++) this.setSeat(i);
    this.seatMesh.instanceMatrix.needsUpdate = true;
    for (const [id, pawn] of this.pawns) {
      pawn.rotation.z = 0;
      pawn.position.y = this.pawnRestY(id);
    }
    this.scene.remove(sign);
    tex.dispose();
    mat.dispose();
  }

  /**
   * Floor crossing: `n` MPs of one party leave their benches, walk across the aisle and join another party's
   * benches, changing colour on the way. (The full re-seating follows when the engine reports the new seats.)
   */
  async floorCross(fromId: number, toId: number, n: number, toColor: number): Promise<void> {
    if (this.cinematic) {
      this.focusParliament();
      await this.wait(0.7);
    }
    const mine = this.seatOwner.map((o, i) => (o === fromId ? i : -1)).filter((i) => i >= 0);
    const theirs = this.seatOwner.map((o, i) => (o === toId ? i : -1)).filter((i) => i >= 0);
    const movers = mine.slice(-n);
    if (!movers.length) return;
    // Destination: around the middle of the receiving party's benches.
    const centre = new THREE.Vector3();
    for (const i of theirs.length ? theirs : movers) centre.add(this.seatPos[i]);
    centre.divideScalar(theirs.length || movers.length);
    const aisle = new THREE.Vector3(Math.cos(this.aisleAngle) * 12.5, 2.6, -Math.sin(this.aisleAngle) * 12.5);
    const from = movers.map((i) => this.seatPos[i].clone());
    const to = movers.map((_, j) => centre.clone().add(new THREE.Vector3(((j % 3) - 1) * 0.7, 0.4 + Math.floor(j / 3) * 0.2, Math.floor(j / 3) * 0.7)));
    const fromCol = movers.map((i) => this.seatColors[i].clone());
    const target = new THREE.Color(toColor);
    const stagger = 0.12;
    const p = new THREE.Vector3();

    await this.tween(2.8, (k) => {
      movers.forEach((i, j) => {
        const local = THREE.MathUtils.clamp(k * (1 + stagger * (movers.length - 1)) - j * stagger, 0, 1);
        const e = easeInOut(local);
        // Quadratic curve through the aisle, with a little walking bob.
        const a = from[j].clone().lerp(aisle, e);
        const b = aisle.clone().lerp(to[j], e);
        p.copy(a).lerp(b, e);
        this.seatPos[i].copy(p);
        this.setSeat(i, local > 0 && local < 1 ? Math.abs(Math.sin(local * Math.PI * 10)) * 0.25 : 0);
        this.seatColors[i].copy(fromCol[j]).lerp(target, THREE.MathUtils.clamp((local - 0.4) / 0.3, 0, 1));
        this.seatMesh.setColorAt(i, this.seatColors[i]);
      });
      this.seatMesh.instanceMatrix.needsUpdate = true;
      this.seatMesh.instanceColor!.needsUpdate = true;
    });
  }

  /** Height a pawn rests at on its current square. */
  private pawnRestY(id: number): number {
    return this.restY.get(id) ?? 0;
  }
  private readonly restY = new Map<number, number>();

  /** Podium beside the parliament with a step for every party. */
  private buildPodium(): void {
    this.podium.position.copy(PODIUM_POS);
    const title = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTexture(L('RACE TO WIN', 'CORRIDA PELA VITÓRIA'), L('most elections won', 'mais eleições vencidas')), depthWrite: false }));
    title.scale.set(5.6, 1.4, 1);
    title.position.set(0, 4.6, 0);
    this.podium.add(title);
    this.podium.add(this.podiumStatues);
    this.scene.add(this.podium);
  }

  /**
   * Rebuild the podium: one step per party, highest in the centre. Step height follows the number of elections
   * won, so parties with the same number of wins (everyone, at the start) stand at the same height.
   */
  updatePodium(rows: { party: Player['party']; wins: number }[]): void {
    const key = rows.map((r) => `${r.party.short}:${r.wins}`).join('|');
    if (key === this.podiumKey) return;
    this.podiumKey = key;
    for (const child of [...this.podiumStatues.children]) this.podiumStatues.remove(child);

    const n = rows.length;
    const spacing = 1.5;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing);
    const slots = [...xs].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b); // centre first, then outwards
    const levels = [...new Set(rows.map((r) => r.wins))].sort((a, b) => b - a);
    const nLv = levels.length;
    const medal = [0xe8c35a, 0xc9ced6, 0xc58a52];

    rows.forEach((r, idx) => {
      const level = levels.indexOf(r.wins);
      const h = nLv === 1 ? 0.8 : 0.45 + ((nLv - 1 - level) / (nLv - 1)) * 1.25;
      const color = nLv === 1 ? 0x56607a : (medal[level] ?? 0x56607a);
      const x = slots[idx];
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.6), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }));
      block.position.set(x, h / 2 + 0.06, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      this.podiumStatues.add(block);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.72), new THREE.MeshBasicMaterial({ map: labelTexture(String(level + 1), color), transparent: true }));
      num.position.set(x, Math.min(h * 0.5, 0.42) + 0.06, 0.81);
      this.podiumStatues.add(num);
      const statue = this.makePawn({ party: r.party } as Player, L(`${r.wins} WIN${r.wins === 1 ? '' : 'S'}`, `${r.wins} ${r.wins === 1 ? 'VITÓRIA' : 'VITÓRIAS'}`));
      statue.scale.setScalar(level === 0 && nLv > 1 ? 1.1 : 0.95);
      statue.position.set(x, h + 0.06, 0);
      this.podiumStatues.add(statue);
    });
  }

  /** End of game: slow orbit around the whole table. */
  celebrate(): void {
    this.cinematic = false;
    this.marker.visible = false;
    this.controls.autoRotate = true;
  }

  // ───────────────────────────── internals ─────────────────────────────

  private makePawn(p: Player, caption = p.party.short): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: p.party.color, roughness: 0.35, metalness: 0.25 });
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
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), mat);
    head.position.y = 1.1;
    head.castShadow = true;
    g.add(head);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(caption, p.party.color, p.party.icon), depthWrite: false }));
    label.scale.set(1.3, 1.22, 1);
    label.position.y = 2.05;
    g.add(label);
    return g;
  }

  /** World position for a player's pawn on a square (each player has a fixed slot). */
  private slot(index: number, id: number): THREE.Vector3 {
    const col = id % 2;
    const row = Math.floor(id / 2);
    const local = new THREE.Vector3(col ? 0.55 : -0.55, 0, -1.15 + row * 1.15);
    return this.tileAnchors[index].localToWorld(local);
  }

  private tween(seconds: number, fn: (k: number) => void): Promise<void> {
    return new Promise((done) => this.tweens.push({ t: 0, dur: seconds, fn, done }));
  }

  private wait(seconds: number): Promise<void> {
    return this.tween(seconds, () => {});
  }

  private tick = (time: number) => {
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), MAX_DT);
    this.elapsed += dt;

    if (this.tweens.length) {
      const live: Tween[] = [];
      for (const tw of this.tweens) {
        tw.t += dt * settings.speed;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(k);
        if (k >= 1) tw.done(); // resolves a promise; continuations run after this frame
        else live.push(tw);
      }
      this.tweens = live;
    }

    const pawn = this.pawns.get(this.activeId);
    if (pawn && this.marker.visible) {
      this.marker.position.set(pawn.position.x, pawn.position.y + 0.08, pawn.position.z);
      const s = 1 + Math.sin(this.elapsed * 4) * 0.12;
      this.marker.scale.set(s, s, s);
    }
    if (this.wheelGlow.visible) {
      (this.wheelGlow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(this.elapsed * 5) * 0.35;
      const s = 1 + Math.sin(this.elapsed * 5) * 0.015;
      this.wheelGlow.scale.set(s, s, s);
    }
    const beacon = this.scene.getObjectByName('beacon');
    if (beacon) {
      beacon.rotation.y += dt * 0.8;
      beacon.position.y = tileHeight(0) + 3.2 + Math.sin(this.elapsed * 1.5) * 0.25;
    }

    this.direct(dt);
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.tileMeshes, false)[0];
    this.onHover?.(hit ? (hit.object.userData.index as number) : null, e.clientX, e.clientY);
    if (this.wheelArmed) this.renderer.domElement.style.cursor = this.hitsWheel() ? 'pointer' : '';
  };

  private hitsWheel(): boolean {
    return this.raycaster.intersectObject(this.wheel, true).length > 0 || this.raycaster.intersectObject(this.wheelGlow, false).length > 0;
  }

  private onPointerUp = (e: PointerEvent) => {
    const down = this.downAt;
    this.downAt = null;
    if (!this.wheelArmed || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.hitsWheel()) return;
    const go = this.wheelArmed;
    this.disarmWheel();
    go();
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
