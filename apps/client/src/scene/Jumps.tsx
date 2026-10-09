import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, type BufferGeometry, type InstancedMesh, type Texture } from 'three';
import { useStore } from 'zustand';
import { BOARD_COLORS, PAIR_COLORS, WORLD_COLORS } from '../app/theme';
import { exitGeometry, padGeometry, targetGeometry, vortexGeometry } from '../assets/models';
import { useSlotMesh } from '../assets/slotMesh';
import { capGeometry, symbolGeometry } from '../assets/symbols';
import type { Director } from '../director/director';
import { PARTS, slideCurve, tileToWorld } from './layout';
import { clamp01, easeOutBack } from './motion';
import { SYMBOLS, pairStyles, type PairStyle, type SymbolName } from './pairs';
import { REVEAL_MS, shownPaths, type Peeks } from './paths';
import { chevronTexture, swirlTexture } from './textures';
import { CHANNEL, TRAIL, channelGeometry, padHeading, trailGeometry, trailPath } from './tracks';

/** A cap that keeps a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;
/** Room in each symbol's instanced mesh: both ends of every jump, should one symbol take them all. */
const MAX_MARKS = 4 * MAX_JUMPS;
const INK = new Color(WORLD_COLORS.ink);
const GOLD = new Color(WORLD_COLORS.crown);
const CREAM = new Color(PAIR_COLORS.cap);
const hsl = { h: 0, s: 0, l: 0 };

/** A shown path's progress: when it began to grow in, and when it began to shrink away. */
interface Reveal {
  shownAt: number;
  hiddenAt: number | null;
}

/** How much of a path shows, 0 to 1. */
function revealed(r: Reveal, now: number): number {
  return r.hiddenAt === null ? clamp01((now - r.shownAt) / REVEAL_MS) : 1 - clamp01((now - r.hiddenAt) / REVEAL_MS);
}

/** Show this much of a swept geometry along its length: whole stretches, at least the first while it shows at all. */
function reveal(geometry: BufferGeometry, t: number, stretch: number) {
  const whole = geometry.index!.count;
  geometry.setDrawRange(0, t <= 0 ? 0 : Math.max(stretch, Math.min(whole, Math.ceil((whole * t) / stretch) * stretch)));
}

interface PathProps {
  jump: Jump;
  style: PairStyle;
  progress: () => number;
  clearcoat: boolean;
  chevrons: Texture | null;
  lights: Texture | null;
}

/** One jump's path (spec #5 A13): a slide's channel (floor and walls) or a pad's trail, in its pair colour, grown along its length. */
function Path({ jump, style, progress, clearcoat, chevrons, lights }: PathProps) {
  // Every presentation update brings fresh jump objects: build again only when the path itself changes.
  const { id, from, to } = jump;
  const { colour: pair } = style;
  const slide = to < from;
  const parts = useMemo(() => {
    if (slide) {
      const { floor, walls } = channelGeometry(slideCurve(from, to).getPoints(CHANNEL.samples));
      return {
        kind: 'channel' as const,
        floor,
        walls,
        floorMaterial: new MeshStandardMaterial({ ...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide }), side: DoubleSide, roughness: 0.8 }),
        wallMaterial: new MeshStandardMaterial({ color: pair, roughness: 0.45 }),
      };
    }
    return {
      kind: 'trail' as const,
      trail: trailGeometry(trailPath({ id, from, to })),
      trailMaterial: new MeshPhysicalMaterial({
        ...(lights ? { map: lights, emissiveMap: lights } : {}),
        color: pair,
        emissive: WORLD_COLORS.cloud,
        emissiveIntensity: 0.18,
        roughness: 0.3,
        clearcoat: clearcoat ? 0.9 : 0,
        clearcoatRoughness: 0.15,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        side: DoubleSide,
      }),
    };
  }, [slide, id, from, to, pair, clearcoat, chevrons, lights]);
  useEffect(
    () => () => {
      if (parts.kind === 'channel') {
        parts.floor.dispose();
        parts.walls.dispose();
        parts.floorMaterial.dispose();
        parts.wallMaterial.dispose();
      } else {
        parts.trail.dispose();
        parts.trailMaterial.dispose();
      }
    },
    [parts],
  );
  useFrame(() => {
    const t = progress();
    // A stretch is the triangles between two samples along the path.
    if (parts.kind === 'channel') {
      reveal(parts.floor, t, parts.floor.index!.count / CHANNEL.samples);
      reveal(parts.walls, t, parts.walls.index!.count / CHANNEL.samples);
    } else reveal(parts.trail, t, parts.trail.index!.count / TRAIL.samples);
  });
  return parts.kind === 'channel' ? (
    <>
      <mesh geometry={parts.walls} material={parts.wallMaterial} name={`channel-walls-${id}`} />
      <mesh geometry={parts.floor} material={parts.floorMaterial} name={`channel-floor-${id}`} receiveShadow />
    </>
  ) : (
    <mesh geometry={parts.trail} material={parts.trailMaterial} name={`trail-${id}`} />
  );
}

/**
 * Slides and launch pads (spec #2 §6.1, spec #5 §4.2, A13): the vortices, exits, pads and targets always;
 * each path (a slide's channel, a pad's trail) only while a piece stands on its start, rides it, or a
 * player tapped one of its ends. Parts a board edit adds or removes pop in or out.
 */
export function Jumps({ director, clearcoat, peeks }: { director: Director; clearcoat: boolean; peeks: Peeks }) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const styles = useMemo(() => pairStyles(jumps), [jumps]);
  const chevrons = useMemo(() => chevronTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const lights = useMemo(() => chevronTexture(WORLD_COLORS.trailMask, WORLD_COLORS.cloud), []);
  // Shown paths and how far each has grown in or shrunk away; React redraws when the set changes.
  const revealsRef = useRef(new Map<string, Reveal>());
  const [paths, setPaths] = useState<string[]>([]);
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vortex = useSlotMesh(
    'slide.vortex',
    () => ({ geometry: vortexGeometry(), material: new MeshBasicMaterial(swirl ? { map: swirl, transparent: true } : { color: BOARD_COLORS.slide }) }),
    { clearcoat },
  );
  const exit = useSlotMesh('slide.exit', () => ({ geometry: exitGeometry(), material: new MeshBasicMaterial() }), { clearcoat });
  const pad = useSlotMesh(
    'pad',
    () => ({ geometry: padGeometry(), material: new MeshStandardMaterial({ roughness: 0.5 }) }),
    { clearcoat },
  );
  const target = useSlotMesh('pad.target', () => ({ geometry: targetGeometry(), material: new MeshBasicMaterial() }), { clearcoat });
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
    },
    [symbols, symbolMaterial, cap, capMaterial],
  );
  const symbolsRef = useRef<Partial<Record<SymbolName, InstancedMesh | null>>>({});
  const capsRef = useRef<InstancedMesh>(null);
  const colour = useMemo(() => new Color(), []);
  const vorticesRef = useRef<InstancedMesh>(null);
  const exitsRef = useRef<InstancedMesh>(null);
  const padsRef = useRef<InstancedMesh>(null);
  const targetsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);

  useFrame(({ clock }, delta) => {
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
    const list = [...revealsRef.current.keys()];
    if (list.join() !== paths.join()) setPaths(list);
    const t = beat ? clamp01((Date.now() - beat.startedAt) / beat.durationMs) : 1;
    const pop = (id: string) => {
      if (beat?.kind !== 'boardEdit' || !presentation) return 1;
      const before = presentation.jumps.some((j) => j.id === id);
      const after = beat.after.jumps.some((j) => j.id === id);
      if (before && !after) return 1 - t;
      return !before && after ? Math.max(0, easeOutBack(t)) : 1;
    };
    // Every part stands on its tile's top, turns only about Y, and takes its pair's colour (spec #5 A13).
    const stamp = (mesh: InstancedMesh | null, list: Jump[], tile: (j: Jump) => number, turn: (j: Jump) => number) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        const [x, , z] = tileToWorld(tile(j));
        place.position.set(x, 0, z);
        place.rotation.set(0, turn(j), 0);
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
        mesh.setColorAt(i, colour.set(styles.get(j.id)?.colour ?? WORLD_COLORS.cloud));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    stamp(vorticesRef.current, snakes, (j) => j.from, () => clock.elapsedTime * 2.5);
    stamp(exitsRef.current, snakes, (j) => j.to, () => 0);
    stamp(padsRef.current, ladders, (j) => j.from, padHeading);
    stamp(targetsRef.current, ladders, (j) => j.to, () => 0);
    // The symbols lie flat and upright to the camera; a landing's glowing gold breathes.
    const marks = new Map<SymbolName, number>();
    const breathe = 0.78 + 0.22 * Math.sin(clock.elapsedTime * 3);
    const mark = (j: Jump, tile: number, y: number, size: number, tint: Color) => {
      const style = styles.get(j.id);
      const mesh = style ? symbolsRef.current[style.symbol] : null;
      if (!style || !mesh) return;
      const i = marks.get(style.symbol) ?? 0;
      if (i >= MAX_MARKS) return;
      marks.set(style.symbol, i + 1);
      const [x, , z] = tileToWorld(tile);
      const s = size * pop(j.id);
      place.position.set(x, y, z);
      place.rotation.set(0, 0, 0);
      place.scale.set(s, 1, s);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
      mesh.setColorAt(i, tint);
    };
    for (const j of ladders) {
      // A dark pad (teal, plum) carries a cream symbol: a dark one would vanish on it.
      colour.set(styles.get(j.id)?.colour ?? WORLD_COLORS.cloud);
      mark(j, j.from, PARTS.padTop + 0.004, PARTS.symbol.pad, colour.getHSL(hsl).l < 0.4 ? CREAM : INK);
      mark(j, j.to, PARTS.onTile, PARTS.symbol.landing, colour.copy(GOLD).multiplyScalar(breathe));
    }
    for (const j of snakes) {
      const pair = styles.get(j.id)?.colour ?? WORLD_COLORS.cloud;
      // On the cream cap a cream symbol wouldn't show: the cream pair's symbol is drawn in ink there.
      mark(j, j.from, PARTS.cap.top + 0.002, PARTS.symbol.eye, pair === PAIR_COLORS.cap ? INK : colour.set(pair));
      mark(j, j.to, PARTS.onTile, PARTS.symbol.exit, colour.set(pair));
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
    if (chevrons) chevrons.offset.y -= delta * 0.8;
    if (lights) lights.offset.y -= delta * 0.9; // the trail's lights travel toward the landing
  });

  const byId = useMemo(() => new Map(jumps.map((j) => [j.id, j])), [jumps]);
  return (
    <group>
      {paths.map((id) => {
        const jump = byId.get(id);
        const style = styles.get(id);
        if (!jump || !style) return null;
        const progress = () => {
          const r = revealsRef.current.get(id);
          return r ? revealed(r, Date.now()) : 0;
        };
        return <Path key={id} jump={jump} style={style} progress={progress} clearcoat={clearcoat} chevrons={chevrons} lights={lights} />;
      })}
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
      <instancedMesh ref={vorticesRef} name="vortices" args={[vortex.geometry, vortex.material, MAX_JUMPS]} />
      <instancedMesh ref={exitsRef} name="exits" args={[exit.geometry, exit.material, MAX_JUMPS]} />
      <instancedMesh ref={padsRef} name="pads" args={[pad.geometry, pad.material, MAX_JUMPS]} />
      <instancedMesh ref={targetsRef} name="targets" args={[target.geometry, target.material, MAX_JUMPS]} />
    </group>
  );
}
