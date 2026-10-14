import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { BackSide, Color, DoubleSide, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, type BufferGeometry, type InstancedMesh, type Texture } from 'three';
import { useStore } from 'zustand';
import { BOARD_COLORS, PAIR_COLORS, WORLD_COLORS } from '../app/theme';
import { arrowheadGeometry, arrowheadOutlineGeometry, exitGeometry, padGeometry, puffGeometry, targetGeometry, vortexGeometry } from '../assets/models';
import { useSlotMesh } from '../assets/slotMesh';
import { capGeometry, symbolGeometry } from '../assets/symbols';
import type { Director } from '../director/director';
import { PARTS, tileToWorld } from './layout';
import { STILL_END, clamp01, easeOutBack, endReaction, type EndMotion } from './motion';
import { SYMBOLS, pairStyles, type SymbolName } from './pairs';
import { REVEAL_MS, shownPaths, type Peeks } from './paths';
import { endIconTexture, swirlTexture, type EndIcon } from './textures';
import { PUFFS, dashPoints, puffPoints, type Dash, type Puff } from './tracks';

/** A cap that keeps a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;
/** Room in each symbol's instanced mesh: both ends of every jump, should one symbol take them all. */
const MAX_MARKS = 4 * MAX_JUMPS;
const GOLD = new Color(WORLD_COLORS.crown);
const CREAM = new Color(PAIR_COLORS.cap);
/** Room for the trails: every puff of every rocket, and a long slide's arrowheads on every slide. */
const MAX_PUFFS = PUFFS * MAX_JUMPS;
const MAX_ARROWS = 24 * MAX_JUMPS;
/** How much bigger a puff's dark outline is than the puff. */
const PUFF_OUTLINE = 1.22;
/** How fast a slide's arrowheads drift along it, in gaps a second. */
const DRIFT = 0.8;

interface EndRefs {
  vortices: RefObject<InstancedMesh | null>;
  exits: RefObject<InstancedMesh | null>;
  pads: RefObject<InstancedMesh | null>;
  targets: RefObject<InstancedMesh | null>;
}

/** The ends as 3D models (High): rockets, flags, whirlpools and splats, loaded only when shown. */
function ModelEnds({ clearcoat, refs }: { clearcoat: boolean; refs: EndRefs }) {
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vortex = useSlotMesh(
    'slide.vortex',
    () => ({ geometry: vortexGeometry(), material: new MeshBasicMaterial(swirl ? { map: swirl, transparent: true } : { color: BOARD_COLORS.slide }) }),
    { clearcoat },
  );
  const exit = useSlotMesh('slide.exit', () => ({ geometry: exitGeometry(), material: new MeshBasicMaterial() }), { clearcoat });
  const pad = useSlotMesh('pad', () => ({ geometry: padGeometry(), material: new MeshStandardMaterial({ roughness: 0.5 }) }), { clearcoat });
  const target = useSlotMesh('pad.target', () => ({ geometry: targetGeometry(), material: new MeshBasicMaterial() }), { clearcoat });
  return (
    <>
      <instancedMesh ref={refs.vortices} name="vortices" args={[vortex.geometry, vortex.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.exits} name="exits" args={[exit.geometry, exit.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.pads} name="pads" args={[pad.geometry, pad.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.targets} name="targets" args={[target.geometry, target.material, MAX_JUMPS]} />
    </>
  );
}

/** One kind of flat end: a square image lying on the tile, which instance colours paint. */
function useFlatEnd(kind: EndIcon, size: number) {
  return useMemo(() => {
    const texture = endIconTexture(kind, WORLD_COLORS.cloud, PAIR_COLORS.shade);
    return {
      geometry: new PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(0, PARTS.flat.y, 0),
      material: new MeshBasicMaterial(texture ? { map: texture, transparent: true, alphaTest: 0.4 } : {}),
    };
  }, [kind, size]);
}

/** The ends as flat images (Low, round 5): no 3D models are loaded. */
function FlatEnds({ refs }: { refs: EndRefs }) {
  const swirl = useFlatEnd('swirl', PARTS.flat.swirl.size);
  const splat = useFlatEnd('splat', PARTS.flat.splat.size);
  const rocket = useFlatEnd('rocket', PARTS.flat.rocket.size);
  const flag = useFlatEnd('flag', PARTS.flat.flag.size);
  useEffect(
    () => () => {
      for (const end of [swirl, splat, rocket, flag]) {
        end.geometry.dispose();
        (end.material.map as Texture | null)?.dispose();
        end.material.dispose();
      }
    },
    [swirl, splat, rocket, flag],
  );
  return (
    <>
      <instancedMesh ref={refs.vortices} name="flat-swirls" args={[swirl.geometry, swirl.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.exits} name="flat-splats" args={[splat.geometry, splat.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.pads} name="flat-rockets" args={[rocket.geometry, rocket.material, MAX_JUMPS]} />
      <instancedMesh ref={refs.targets} name="flat-flags" args={[flag.geometry, flag.material, MAX_JUMPS]} />
    </>
  );
}

/** A shown path's progress: when it began to grow in, and when it began to shrink away. */
interface Reveal {
  shownAt: number;
  hiddenAt: number | null;
}

/** How much of a path shows, 0 to 1. */
function revealed(r: Reveal, now: number): number {
  return r.hiddenAt === null ? clamp01((now - r.shownAt) / REVEAL_MS) : 1 - clamp01((now - r.hiddenAt) / REVEAL_MS);
}

/**
 * Slides and launch pads (spec #2 §6.1, spec #5 §4.2, A13): the vortices, exits, pads and targets always;
 * each path (a rocket's smoke puffs, a slide's arrowheads; round 5) only while a piece stands on its start,
 * rides it, or a player tapped one of its ends. Parts a board edit adds or removes pop in or out.
 */
interface JumpsProps {
  director: Director;
  clearcoat: boolean;
  peeks: Peeks;
  /** The ends as 3D models (High), or flat images on the tiles (Low; round 5). */
  modelEnds?: boolean;
  /** Keeps the rockets and flags from reacting. */
  reducedMotion?: boolean;
}

export function Jumps({ director, clearcoat, peeks, modelEnds = true, reducedMotion = false }: JumpsProps) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const styles = useMemo(() => pairStyles(jumps), [jumps]);
  // Shown paths and how far each has grown in or shrunk away.
  const revealsRef = useRef(new Map<string, Reveal>());
  // The trails: chunky flat-shaded puffs and arrowheads, each in its pair colour.
  const puff = useMemo(() => puffGeometry(), []);
  const arrowhead = useMemo(() => arrowheadGeometry(), []);
  const trailMaterial = useMemo(() => new MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), []);
  // Their dark outlines, so a trail stands out on the busy board: a puff's is a bigger ball seen from
  // inside (an inverted hull), an arrowhead's a wider chevron just under it.
  const arrowOutline = useMemo(() => arrowheadOutlineGeometry(), []);
  const puffOutlineMaterial = useMemo(() => new MeshBasicMaterial({ color: WORLD_COLORS.ink, side: BackSide }), []);
  const arrowOutlineMaterial = useMemo(() => new MeshBasicMaterial({ color: WORLD_COLORS.ink }), []);
  const puffsRef = useRef<InstancedMesh>(null);
  const arrowsRef = useRef<InstancedMesh>(null);
  const puffOutlinesRef = useRef<InstancedMesh>(null);
  const arrowOutlinesRef = useRef<InstancedMesh>(null);
  // A path's trail points, built once per path.
  const trailsRef = useRef(new Map<string, { puffs: Puff[] } | { dashes: (phase: number) => Dash[] }>());
  // The pair symbols (spec #5 A13): one instanced mesh per symbol, unlit decals, and the whirlpools' still caps.
  const symbols = useMemo(() => Object.fromEntries(SYMBOLS.map((name) => [name, symbolGeometry(name)])) as Record<SymbolName, BufferGeometry>, []);
  const symbolMaterial = useMemo(() => new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), []);
  const cap = useMemo(() => capGeometry(PARTS.cap.radius, PARTS.cap.top), []);
  const capMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), []);
  useEffect(
    () => () => {
      for (const g of Object.values(symbols)) g.dispose();
      symbolMaterial.dispose();
      cap.dispose();
      capMaterial.dispose();
      puff.dispose();
      arrowhead.dispose();
      trailMaterial.dispose();
      arrowOutline.dispose();
      puffOutlineMaterial.dispose();
      arrowOutlineMaterial.dispose();
    },
    [symbols, symbolMaterial, cap, capMaterial, puff, arrowhead, trailMaterial, arrowOutline, puffOutlineMaterial, arrowOutlineMaterial],
  );
  const symbolsRef = useRef<Partial<Record<SymbolName, InstancedMesh | null>>>({});
  const capsRef = useRef<InstancedMesh>(null);
  const colour = useMemo(() => new Color(), []);
  const vorticesRef = useRef<InstancedMesh>(null);
  const exitsRef = useRef<InstancedMesh>(null);
  const padsRef = useRef<InstancedMesh>(null);
  const targetsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const base = useMemo(() => new Matrix4(), []);

  useFrame(({ clock }) => {
    const { beat, presentation } = director.store.getState();
    const now = Date.now();
    const want = shownPaths({ jumps, positions: presentation?.positions ?? {}, moving: beat?.events ?? [], peeks, now });
    for (const id of want) {
      const r = revealsRef.current.get(id);
      if (!r) revealsRef.current.set(id, { shownAt: now, hiddenAt: null });
      else if (r.hiddenAt !== null) revealsRef.current.set(id, { shownAt: now - revealed(r, now) * REVEAL_MS, hiddenAt: null });
    }
    for (const [id, r] of revealsRef.current) {
      if (!want.has(id) && r.hiddenAt === null) r.hiddenAt = now - (1 - revealed(r, now)) * REVEAL_MS;
      if (r.hiddenAt !== null && now - r.hiddenAt >= REVEAL_MS) revealsRef.current.delete(id);
    }
    const t = beat ? clamp01((Date.now() - beat.startedAt) / beat.durationMs) : 1;
    const pop = (id: string) => {
      if (beat?.kind !== 'boardEdit' || !presentation) return 1;
      const before = presentation.jumps.some((j) => j.id === id);
      const after = beat.after.jumps.some((j) => j.id === id);
      if (before && !after) return 1 - t;
      return !before && after ? Math.max(0, easeOutBack(t)) : 1;
    };
    // How each ladder's rocket and flag react to a launch (round 5).
    const reactions = new Map(ladders.map((j) => [j.id, endReaction(beat, j, now, reducedMotion)]));
    const react = (j: Jump) => reactions.get(j.id) ?? { rocket: STILL_END, flag: STILL_END };
    /**
     * Where an end stands: on its tile's top, turned only about Y (spec #5 A13), popping in or out with a
     * board edit, and moving as it reacts. A rocket rocks about its base; a flag swings about its pole.
     * A flat icon only pops.
     */
    const endMatrix = (j: Jump, tile: number, turn: number, motion: EndMotion = STILL_END, pole = 0, corner = false) => {
      const m = modelEnds ? motion : { ...STILL_END, pop: motion.pop };
      const [tx, , tz] = tileToWorld(tile);
      const [x, z] = corner ? [tx + PARTS.corner.x, tz + PARTS.corner.z] : [tx, tz];
      const swing = pole ? m.sway : 0;
      place.position.set(x + pole - pole * Math.cos(swing), 0, z + pole * Math.sin(swing));
      place.rotation.set(0, turn + swing, pole ? 0 : m.sway);
      const s = pop(j.id) * m.pop;
      place.scale.set(s, s * m.squash, s);
      place.updateMatrix();
      return place.matrix;
    };
    // Every part takes its pair's colour (spec #5 A13).
    const stamp = (mesh: InstancedMesh | null, list: Jump[], matrix: (j: Jump) => Matrix4) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        mesh.setMatrixAt(i, matrix(j));
        mesh.setColorAt(i, colour.set(styles.get(j.id)?.colour ?? WORLD_COLORS.cloud));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    // Rockets and flags stand in their tile's corner (2026-10-14); a rocket's porthole faces the camera.
    const rocketAt = (j: Jump) => endMatrix(j, j.from, 0, react(j).rocket, 0, true);
    const flagAt = (j: Jump) => endMatrix(j, j.to, 0, react(j).flag, PARTS.flag.pole, true);
    stamp(vorticesRef.current, snakes, (j) => endMatrix(j, j.from, clock.elapsedTime * 2.5));
    stamp(exitsRef.current, snakes, (j) => endMatrix(j, j.to, 0));
    stamp(padsRef.current, ladders, rocketAt);
    stamp(targetsRef.current, ladders, flagAt);
    // The symbols lie flat and upright to the camera; a landing's glowing gold breathes.
    const marks = new Map<SymbolName, number>();
    const breathe = 0.78 + 0.22 * Math.sin(clock.elapsedTime * 3);
    /**
     * A symbol at an offset from its tile's centre, standing upright facing the camera (+Z) or lying flat.
     * On a rocket or a flag it rides on `on`, that end's own matrix, so it moves as the end reacts.
     */
    const mark = (j: Jump, tile: number, y: number, size: number, tint: Color, at?: { x: number; z: number }, upright = at !== undefined, on?: Matrix4) => {
      const style = styles.get(j.id);
      const mesh = style ? symbolsRef.current[style.symbol] : null;
      if (!style || !mesh) return;
      const i = marks.get(style.symbol) ?? 0;
      if (i >= MAX_MARKS) return;
      marks.set(style.symbol, i + 1);
      const [x, , z] = on ? [0, 0, 0] : tileToWorld(tile);
      const s = on ? size : size * pop(j.id);
      place.position.set(x + (at?.x ?? 0), y, z + (at?.z ?? 0));
      place.rotation.set(upright ? Math.PI / 2 : 0, 0, 0);
      place.scale.set(s, 1, s);
      place.updateMatrix();
      mesh.setMatrixAt(i, on ? place.matrix.premultiply(on) : place.matrix);
      mesh.setColorAt(i, tint);
    };
    const { flat } = PARTS;
    // On a flat image the symbol lies on it, at its spot.
    const lie = (j: Jump, tile: number, at: { x: number; z: number; size: number }, tint: Color, on?: Matrix4) => mark(j, tile, flat.y + 0.006, at.size, tint, at, false, on);
    for (const j of ladders) {
      const pair = colour.set(styles.get(j.id)?.colour ?? WORLD_COLORS.cloud);
      if (modelEnds) {
        // On the rocket's cream porthole, in the pair's colour; in glowing gold on the flag's pennant.
        mark(j, j.from, PARTS.rocket.y, PARTS.symbol.pad, pair, { x: 0, z: PARTS.rocket.z }, true, base.copy(rocketAt(j)));
        mark(j, j.to, PARTS.flag.y, PARTS.symbol.landing, colour.copy(GOLD).multiplyScalar(breathe), PARTS.flag, true, base.copy(flagAt(j)));
      } else {
        lie(j, j.from, flat.rocket.symbol, pair, base.copy(rocketAt(j)));
        lie(j, j.to, flat.flag.symbol, colour.copy(GOLD).multiplyScalar(breathe), base.copy(flagAt(j)));
      }
    }
    for (const j of snakes) {
      // On the whirlpool's cream cap in the pair's colour; on the splat, which is the pair's colour, in cream.
      mark(j, j.from, PARTS.cap.top + 0.002, PARTS.symbol.eye, colour.set(styles.get(j.id)?.colour ?? WORLD_COLORS.cloud));
      if (modelEnds) mark(j, j.to, PARTS.splat.top + 0.004, PARTS.symbol.exit, CREAM);
      else lie(j, j.to, flat.splat.symbol, CREAM);
    }
    for (const name of SYMBOLS) {
      const mesh = symbolsRef.current[name];
      if (!mesh) continue;
      mesh.count = marks.get(name) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const caps = capsRef.current;
    if (caps) {
      snakes.forEach((j, i) => {
        const [x, , z] = tileToWorld(j.from);
        place.position.set(x, 0, z);
        place.rotation.set(0, 0, 0);
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        caps.setMatrixAt(i, place.matrix);
      });
      caps.count = snakes.length;
      caps.instanceMatrix.needsUpdate = true;
    }
    // The trails: a shown path's puffs or arrowheads pop in one after another as it grows, and out as it shrinks.
    const byId = new Map(jumps.map((j) => [j.id, j]));
    let puffs = 0;
    let arrows = 0;
    for (const [id, r] of revealsRef.current) {
      const jump = byId.get(id);
      if (!jump) continue;
      const shown = revealed(r, now);
      let trail = trailsRef.current.get(id);
      if (!trail) {
        trail = jump.to > jump.from ? { puffs: puffPoints(jump) } : { dashes: (phase: number) => dashPoints(jump, phase) };
        trailsRef.current.set(id, trail);
      }
      const tint = colour.set(styles.get(id)?.colour ?? WORLD_COLORS.cloud);
      if ('puffs' in trail) {
        const count = shown > 0 || r.hiddenAt === null ? Math.max(1, Math.ceil(shown * trail.puffs.length)) : 0;
        trail.puffs.slice(0, count).forEach(({ position: [x, y, z], size }, k) => {
          if (puffs >= MAX_PUFFS) return;
          // Each bobs a little, out of step with its neighbours.
          place.position.set(x, y + 0.05 * Math.sin(clock.elapsedTime * 2 + k), z);
          place.rotation.set(k, k * 0.7, 0);
          place.scale.setScalar(size);
          place.updateMatrix();
          puffsRef.current?.setMatrixAt(puffs, place.matrix);
          puffsRef.current?.setColorAt(puffs, tint);
          place.scale.setScalar(size * PUFF_OUTLINE);
          place.updateMatrix();
          puffOutlinesRef.current?.setMatrixAt(puffs, place.matrix);
          puffs++;
        });
      } else {
        const dashes = trail.dashes((clock.elapsedTime * DRIFT) % 1);
        const count = shown > 0 || r.hiddenAt === null ? Math.max(1, Math.ceil(shown * dashes.length)) : 0;
        dashes.slice(0, count).forEach(({ position: [x, y, z], heading }) => {
          if (arrows >= MAX_ARROWS) return;
          place.position.set(x, y, z);
          place.rotation.set(0, heading, 0);
          place.scale.setScalar(1);
          place.updateMatrix();
          arrowsRef.current?.setMatrixAt(arrows, place.matrix);
          arrowsRef.current?.setColorAt(arrows, tint);
          arrowOutlinesRef.current?.setMatrixAt(arrows, place.matrix);
          arrows++;
        });
      }
    }
    for (const id of trailsRef.current.keys()) if (!revealsRef.current.has(id)) trailsRef.current.delete(id);
    const trails = [
      [puffsRef.current, puffs],
      [puffOutlinesRef.current, puffs],
      [arrowsRef.current, arrows],
      [arrowOutlinesRef.current, arrows],
    ] as const;
    for (const [mesh, count] of trails) {
      if (!mesh) continue;
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={puffsRef} name="trail-puffs" args={[puff, trailMaterial, MAX_PUFFS]} />
      <instancedMesh ref={arrowsRef} name="slide-arrows" args={[arrowhead, trailMaterial, MAX_ARROWS]} />
      <instancedMesh ref={puffOutlinesRef} name="trail-puff-outlines" args={[puff, puffOutlineMaterial, MAX_PUFFS]} />
      <instancedMesh ref={arrowOutlinesRef} name="slide-arrow-outlines" args={[arrowOutline, arrowOutlineMaterial, MAX_ARROWS]} />
      {SYMBOLS.map((name) => (
        <instancedMesh
          key={name}
          ref={(mesh) => {
            symbolsRef.current[name] = mesh;
          }}
          name={`symbols-${name}`}
          args={[symbols[name], symbolMaterial, MAX_MARKS]}
        />
      ))}
      <instancedMesh ref={capsRef} name="caps" args={[cap, capMaterial, MAX_JUMPS]} />
      {modelEnds ? (
        <ModelEnds clearcoat={clearcoat} refs={{ vortices: vorticesRef, exits: exitsRef, pads: padsRef, targets: targetsRef }} />
      ) : (
        <FlatEnds refs={{ vortices: vorticesRef, exits: exitsRef, pads: padsRef, targets: targetsRef }} />
      )}
    </group>
  );
}
