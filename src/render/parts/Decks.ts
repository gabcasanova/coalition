import * as THREE from 'three';
import type { CardFace, DeckKind } from '../../core/types';
import { L } from '../../i18n';
import { easeInOut, easeOutCubic } from '../animation';
import type { Stage } from '../Stage';
import { deckTexture } from '../textures/board';
import { cardFaceTexture } from '../textures/cards';

/** The card decks on the table, left to right as seen from the camera side. */
const DECKS: { kind: DeckKind; title: string; icon: string; color: number; height: number }[] = [
  { kind: 'law', title: L('LAW', 'LEIS'), icon: '🏛️', color: 0x5b43c4, height: 0.9 },
  { kind: 'media', title: L('MEDIA', 'MÍDIA'), icon: '📺', color: 0x1a7fd0, height: 0.5 },
  { kind: 'strategy', title: L('STRATEGY', 'ESTRATÉGIA'), icon: '🃏', color: 0x8a6d2b, height: 0.8 },
  { kind: 'lobby', title: L('LOBBY', 'LOBBY'), icon: '💼', color: 0x239a55, height: 0.6 },
  { kind: 'crisis', title: L('CRISIS', 'CRISE'), icon: '⚠️', color: 0xc0302b, height: 0.7 },
  { kind: 'global', title: L('GLOBAL CRISIS', 'CRISE GLOBAL'), icon: '🌍', color: 0xd35400, height: 0.65 },
];

/** Card size on the table. */
const CARD_W = 2.4;
const CARD_H = 3.36;

interface Deck {
  /** Top of the stack, where cards are drawn from. */
  top: THREE.Vector3;
  /** Horizontal direction from the deck toward the centre of the table. */
  inward: THREE.Vector3;
  color: number;
  back: THREE.CanvasTexture;
}

/** The six decks, and the animations of cards being drawn and dealt. */
export class Decks {
  private readonly decks = new Map<DeckKind, Deck>();

  constructor(private readonly stage: Stage) {
    // In an arc between the wheel and the track, on the camera side.
    const side = new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.9 });
    DECKS.forEach((d, i) => {
      const phi = THREE.MathUtils.degToRad(-147.5 + i * 23);
      const r = 13.2;
      const pos = new THREE.Vector3(r * Math.cos(phi), 0, -r * Math.sin(phi));
      const back = deckTexture(d.kind, d.title, d.icon, d.color);
      const top = new THREE.MeshStandardMaterial({ map: back, roughness: 0.5 });
      const h = d.height;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, 3.64), [side, side, top, side, side, side]);
      deck.position.set(pos.x, h / 2 + 0.06, pos.z);
      deck.lookAt(pos.x * 2, h / 2 + 0.06, pos.z * 2); // card art reads from the camera side
      deck.castShadow = true;
      deck.receiveShadow = true;
      stage.scene.add(deck);
      this.decks.set(d.kind, {
        top: new THREE.Vector3(pos.x, h + 0.08, pos.z),
        inward: pos.clone().negate().normalize(),
        color: d.color,
        back,
      });
    });
  }

  /** Close shot of a deck from the camera side of the table. */
  private focus(deck: Deck): void {
    const out = deck.inward.clone().negate();
    this.stage.director.frame({
      pos: deck.top
        .clone()
        .addScaledVector(out, 11)
        .add(new THREE.Vector3(0, 10, 0)),
      target: deck.top.clone().addScaledVector(deck.inward, 2),
      rate: 2.6,
    });
  }

  /**
   * A card lifts off its deck. If `face` is given it flies up to the camera and turns to show what was drawn
   * (so the event isn't just "random"); then it drops into the hand of the player standing at `receiver`.
   */
  async draw(kind: DeckKind, receiver: THREE.Object3D | undefined, face?: CardFace): Promise<void> {
    const deck = this.decks.get(kind);
    if (!deck) return;
    const { stage } = this;
    if (stage.director.cinematic) {
      this.focus(deck);
      await stage.wait(0.7);
    }

    const faceTexture = face ? cardFaceTexture(face, deck.color) : null;
    const materials = [faceTexture ?? deck.back, deck.back].map(
      (map) => new THREE.MeshBasicMaterial({ map, toneMapped: false, transparent: true, depthTest: false }),
    );
    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const front = new THREE.Mesh(geometry, materials[0]);
    const back = new THREE.Mesh(geometry, materials[1]);
    back.rotation.y = Math.PI;
    const card = new THREE.Group();
    card.add(front, back);
    card.renderOrder = front.renderOrder = back.renderOrder = 20; // always drawn on top

    // Start lying face-down on the deck, its top edge pointing to the centre of the table.
    const z = new THREE.Vector3(0, -1, 0);
    const y = deck.inward.clone();
    const x = new THREE.Vector3().crossVectors(y, z);
    const lyingDown = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    card.position.copy(deck.top);
    card.quaternion.copy(lyingDown);
    stage.scene.add(card);

    await stage.tween(0.4, (k) => {
      card.position.y = deck.top.y + easeOutCubic(k) * 1.5;
    });

    if (face) {
      // Show the card to the camera for a moment.
      const lifted = card.position.clone();
      const dir = new THREE.Vector3();
      const inFrontOfCamera = () => {
        stage.camera.getWorldDirection(dir);
        return stage.camera.position.clone().addScaledVector(dir, 6.5);
      };
      await stage.tween(0.8, (k) => {
        const e = easeInOut(k);
        card.position.lerpVectors(lifted, inFrontOfCamera(), e);
        card.quaternion.slerpQuaternions(lyingDown, stage.camera.quaternion, e);
      });
      await stage.tween(1.8, () => {
        card.position.copy(inFrontOfCamera());
        card.quaternion.copy(stage.camera.quaternion);
      });
    }

    // Into the player's hand: shrink and fade over their pawn.
    const from = card.position.clone();
    const startScale = card.scale.x;
    await stage.tween(0.55, (k) => {
      const e = easeInOut(k);
      const to = receiver ? receiver.position.clone().add(new THREE.Vector3(0, 2, 0)) : from;
      card.position.lerpVectors(from, to, e);
      card.scale.setScalar(startScale * (1 - e * 0.85));
      for (const m of materials) m.opacity = 1 - Math.max(0, (e - 0.6) / 0.4);
    });
    stage.scene.remove(card);
    geometry.dispose();
    for (const m of materials) m.dispose();
    faceTexture?.dispose();
  }

  /** Opening deal: `perPlayer` face-down cards fly round-robin from a deck to every receiver. */
  async deal(kind: DeckKind, receivers: THREE.Object3D[], perPlayer: number): Promise<void> {
    const deck = this.decks.get(kind);
    if (!deck) return;
    const { stage } = this;
    if (stage.director.cinematic) {
      stage.director.frame({ pos: new THREE.Vector3(0, 30, 34), target: new THREE.Vector3(0, 0, 6), rate: 2 });
      await stage.wait(0.8);
    }
    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const material = new THREE.MeshBasicMaterial({ map: deck.back, toneMapped: false, side: THREE.DoubleSide });
    const flights: Promise<void>[] = [];
    let n = 0;
    for (let round = 0; round < perPlayer; round++) {
      for (const receiver of receivers) {
        const delay = n++ * 0.11;
        flights.push(
          stage.wait(delay).then(async () => {
            const card = new THREE.Mesh(geometry, material);
            card.rotation.x = -Math.PI / 2;
            card.position.copy(deck.top);
            stage.scene.add(card);
            const from = deck.top.clone();
            const to = receiver.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            const spin = (Math.random() - 0.5) * 2;
            await stage.tween(0.7, (k) => {
              const e = easeInOut(k);
              card.position.lerpVectors(from, to, e);
              card.position.y += Math.sin(k * Math.PI) * 5;
              card.rotation.z = spin * k * Math.PI;
              card.scale.setScalar(1 - e * 0.7);
            });
            stage.scene.remove(card);
          }),
        );
      }
    }
    await Promise.all(flights);
    geometry.dispose();
    material.dispose();
    stage.director.overview();
  }
}
