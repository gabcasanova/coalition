import * as THREE from 'three';

/** Tread length along the run, and tread thickness. */
const DS = 0.3;
const STEP_H = 0.08;
/** Flat landings at the top and the bottom of the run. */
const TOP_LAND = 0.4;
const BOTTOM_LAND = 0.35;
/** Pieces the curved body is built from. */
const SEGMENTS = 56;

export interface EscalatorSpec {
  /** Radius of the centre line (the escalator follows the track's arc). */
  radius: number;
  /** Board angles (radians, clockwise from the far side) of the top and bottom ends. */
  from: number;
  to: number;
  /** Walking heights at the top and the bottom. */
  top: number;
  bottom: number;
  /** Width across the run. */
  width: number;
  /** Body colours at the top and the bottom (the two squares it joins). */
  topColor: number;
  bottomColor: number;
}

/**
 * A narrow escalator built into the track like a board piece, following its curve: a solid body shaded from one square's
 * colour to the next, gold treads that glide down continuously, and thin gold handrails.
 */
export class Escalator {
  readonly group = new THREE.Group();
  /** Length of the run along the arc. */
  readonly length: number;
  private readonly steps: THREE.Mesh[] = [];
  private offset = 0;
  /** Tread speed along the run, in units per second: still until a pawn rides it. */
  speed = 0;

  constructor(private readonly spec: EscalatorSpec) {
    this.length = spec.radius * (spec.to - spec.from);
    const { width } = spec;
    const slope = (spec.top - spec.bottom) / (this.length - TOP_LAND - BOTTOM_LAND);
    const riser = DS * slope;

    // Body: a curved block like the tiles, its top following the walking line, shaded top → bottom colour.
    const top = new THREE.Color(spec.topColor);
    const bottom = new THREE.Color(spec.bottomColor);
    for (let i = 0; i < SEGMENTS; i++) {
      const s0 = (i / SEGMENTS) * this.length;
      const s1 = ((i + 1) / SEGMENTS) * this.length;
      // Under the moving treads it stays clearly below their undersides, so it never peeks between them or
      // flickers against them; under the landings (no treads showing) it rises to meet the plates.
      const underLanding = s1 <= TOP_LAND - DS || s0 >= this.length - BOTTOM_LAND + DS;
      const h = Math.min(this.heightAt(s0), this.heightAt(s1)) - (underLanding ? 0.06 : STEP_H + riser + 0.06);
      const k = (s0 + s1) / 2 / this.length;
      const color = top.clone().lerp(bottom, k).multiplyScalar(0.55);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0 + 0.01, h, width), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      this.place(seg, (s0 + s1) / 2, 0, 0.06 + h / 2);
      seg.castShadow = seg.receiveShadow = true;
      this.group.add(seg);
    }

    // Gold landing plates at both ends (the treads slide under them).
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.75, roughness: 0.3 });
    for (const [s0, s1, y] of [
      [0, TOP_LAND - 0.02, spec.top],
      [this.length - BOTTOM_LAND + 0.02, this.length, spec.bottom],
    ]) {
      // Top sits clearly above the treads passing underneath (a hair's gap would flicker).
      const plate = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, 0.1, width + 0.04), gold);
      this.place(plate, (s0 + s1) / 2, 0, y - 0.01);
      plate.receiveShadow = true;
      this.group.add(plate);
    }

    // Thin gold handrails on posts along both sides.
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.85, roughness: 0.25 });
    for (const side of [-1, 1]) {
      const lateral = side * (width / 2 - 0.03);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const s = (i / 40) * this.length;
        pts.push(this.at(s, lateral, this.heightAt(s) + 0.5));
      }
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.035, 6, false), rodMat);
      rail.castShadow = true;
      this.group.add(rail);
      for (let s = 0.05; s <= this.length; s += 0.75) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 6), rodMat);
        post.position.copy(this.at(s, lateral, this.heightAt(s) + 0.25));
        this.group.add(post);
      }
    }

    // Treads: gold tops with a darker nose, enough to fill the run.
    const tread = new THREE.MeshStandardMaterial({ color: 0xe0bd5c, metalness: 0.55, roughness: 0.35 });
    const riserMat = new THREE.MeshStandardMaterial({ color: 0x5a4418, roughness: 0.6 });
    const geo = new THREE.BoxGeometry(DS * 0.99, STEP_H + riser, width - 0.12);
    geo.translate(0, -(STEP_H + riser) / 2, 0); // origin at the top of the tread
    const mats = [riserMat, riserMat, tread, riserMat, riserMat, riserMat];
    const count = Math.ceil(this.length / DS);
    for (let i = 0; i < count; i++) {
      const step = new THREE.Mesh(geo, mats);
      step.castShadow = true;
      this.steps.push(step);
      this.group.add(step);
    }
    this.layoutSteps();
  }

  /** Walking height at distance `s` along the run: flat landings, a straight incline between them. */
  heightAt(s: number): number {
    const k = THREE.MathUtils.clamp((s - TOP_LAND) / (this.length - TOP_LAND - BOTTOM_LAND), 0, 1);
    return this.spec.top + (this.spec.bottom - this.spec.top) * k;
  }

  /** World point at distance `s` along the run, `lateral` across it (+ = outward) and height `y`. */
  private at(s: number, lateral: number, y: number): THREE.Vector3 {
    const a = this.spec.from + s / this.spec.radius;
    const r = this.spec.radius + lateral;
    return new THREE.Vector3(r * Math.sin(a), y, -r * Math.cos(a));
  }

  /** Positions a piece on the run, its local x along the run and its local z across it. */
  private place(m: THREE.Object3D, s: number, lateral: number, y: number): void {
    const a = this.spec.from + s / this.spec.radius;
    m.position.copy(this.at(s, lateral, y));
    m.rotation.set(0, -a, 0);
  }

  /** Where a rider stands at distance `s`, `lateral` across the treads (a tread is flat, so at the height of its upper edge). */
  pointAt(s: number, lateral = 0): THREE.Vector3 {
    return this.at(s, lateral, this.heightAt(s - DS / 2));
  }

  /** Where riders step on and off. */
  get boardS(): number {
    return TOP_LAND * 0.45;
  }
  get alightS(): number {
    return this.length - BOTTOM_LAND * 0.45;
  }

  private layoutSteps(): void {
    const span = this.steps.length * DS;
    this.steps.forEach((step, i) => {
      const s = (((i * DS + this.offset) % span) + span) % span;
      // Treads only show while they overlap the slope; they wrap around hidden under the landing plates.
      step.visible = s > TOP_LAND - DS / 2 && s < this.length - BOTTOM_LAND + DS / 2;
      this.place(step, s, 0, this.heightAt(s - DS / 2));
    });
  }

  update(dt: number): void {
    if (!this.speed) return;
    this.offset += this.speed * dt;
    this.layoutSteps();
  }
}
