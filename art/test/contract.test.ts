import { describe, expect, it } from 'vitest';
import { contractProblems } from '../contract';
import type { GlbSummary } from '../glb';
import { PARTS } from '../../apps/client/src/scene/layout';

const knight = (change: Partial<GlbSummary> = {}): GlbSummary => ({
  min: [-0.42, 0, -0.45],
  max: [0.42, 1.2, 0.45],
  triangles: 3200,
  shadowTriangles: 400,
  materials: ['Seat', 'Eye', 'Shine'],
  byMaterial: {},
  transformedNodes: [],
  ...change,
});

describe('the model contract (spec #5 §4.1, §5)', () => {
  it('passes a knight that keeps the rules', () => {
    expect(contractProblems('knight', knight())).toEqual([]);
  });

  it('names every rule a model breaks', () => {
    const problems = contractProblems('knight', knight({ min: [-0.42, 0.1, -0.45], max: [0.42, 1.6, 0.45], triangles: 12000, materials: ['Body'], transformedNodes: ['knight'] }));
    expect(problems).toEqual([
      'its base is at y = 0.100, not 0',
      'it is 1.50 tall; 0.85–1.3 expected',
      'it has 12000 triangles; at most 10000',
      'it has no Seat material',
      'these nodes still carry a transform: knight',
    ]);
  });

  it('wants a small Shadow mesh on every model that casts a shadow, and none on the board parts', () => {
    expect(contractProblems('knight', knight({ shadowTriangles: 0 }))).toEqual(['it has no Shadow mesh; the game casts its shadow from one']);
    expect(contractProblems('knight', knight({ shadowTriangles: 2000 }))).toEqual(['its Shadow mesh has 2000 triangles; at most 600']);
    const tile: GlbSummary = { min: [-0.76, 0, -0.76], max: [0.76, 0.3, 0.76], triangles: 196, shadowTriangles: 40, materials: ['Tint'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('tile', tile)).toEqual(['it has a Shadow mesh, but the game draws it instanced, without one']);
  });

  it("holds a piece's Low file to its rule, at most 40% of the triangles and no shadow stand-in (spec #5 A14)", () => {
    expect(contractProblems('knight-low', knight({ triangles: 3200, shadowTriangles: 0 }))).toEqual([]);
    expect(contractProblems('knight-low', knight({ triangles: 5000, shadowTriangles: 0 }))).toEqual(['it has 5000 triangles; at most 4000']);
    expect(contractProblems('knight-low', knight({ triangles: 3200 }))).toEqual(['it has a Shadow mesh, but Low quality casts no shadows']);
    expect(contractProblems('tile-low', knight())).toEqual(['tile-low has no rule in art/contract.ts']);
  });

  it('stands a ladder flag up and lays a portal splat flat (spec #5 A13, the third review)', () => {
    const flag: GlbSummary = { min: [-0.25, 0, -0.12], max: [0.35, PARTS.flag.height, 0.12], triangles: 1000, shadowTriangles: 0, materials: ['Tint'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('target', flag)).toEqual([]);
    expect(contractProblems('target', { ...flag, max: [0.35, 0.07, 0.12] })).toEqual(['it is 0.07 tall; 1.2–1.35 expected']);
    expect(contractProblems('target', { ...flag, materials: ['Tint', 'Pole'] })).toEqual(['it has 2 materials; at most 1']);
    const splat: GlbSummary = { min: [-0.42, 0, -0.42], max: [0.42, PARTS.splat.top, 0.42], triangles: 500, shadowTriangles: 0, materials: ['Tint'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('exit', splat)).toEqual([]);
    expect(contractProblems('exit', { ...splat, max: [0.42, 0.09, 0.42] })).toEqual(['it is 0.09 tall; 0.03–0.06 expected', `its top is at 0.090, but the symbol lies at ${PARTS.splat.top}`]);
  });

  it('refuses a model with no rule', () => {
    expect(contractProblems('teapot', knight())).toEqual(['teapot has no rule in art/contract.ts']);
  });

  const rocket = (front: number): GlbSummary => ({
    min: [-0.4, 0, -0.4],
    max: [0.4, PARTS.rocket.height, 0.4],
    triangles: 900,
    shadowTriangles: 0,
    materials: ['Tint', 'Window', 'Flame'],
    byMaterial: { Window: { min: [-0.15, PARTS.rocket.y - 0.15, front - 0.06], max: [0.15, PARTS.rocket.y + 0.15, front] } },
    transformedNodes: [],
  });

  it("puts a launch rocket's porthole on its front, where the game stands its symbol (spec #5 A16)", () => {
    expect(contractProblems('pad', rocket(PARTS.rocket.z))).toEqual([]);
    expect(contractProblems('pad', rocket(-0.2))).toEqual([`its Window faces away: its front is at -0.20, the symbol stands at ${PARTS.rocket.z}`]);
  });

  it('keeps a tile to its one Tint material, so instancing can paint it, 0.30 tall (spec #5 A13)', () => {
    const tile: GlbSummary = { min: [-0.76, 0, -0.76], max: [0.76, 0.3, 0.76], triangles: 196, shadowTriangles: 0, materials: ['Tint', 'Edge'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('tile', tile)).toEqual(['it has 2 materials; at most 1']);
    expect(contractProblems('tile', { ...tile, max: [0.76, 0.22, 0.76], materials: ['Tint'] })).toEqual(['it is 0.22 tall; 0.29–0.31 expected']);
  });

  it('paints the whirlpool and the splat through Tint, so each takes its pair colour (spec #5 A13)', () => {
    const part = (materials: string[]): GlbSummary => ({ min: [-0.4, 0, -0.4], max: [0.4, 0.1, 0.4], triangles: 600, shadowTriangles: 0, materials, byMaterial: {}, transformedNodes: [] });
    expect(contractProblems('vortex', part(['Inside', 'Glow']))).toEqual(['it has no Tint material']);
    expect(contractProblems('exit', { ...part(['Splat']), max: [0.4, PARTS.splat.top, 0.4] })).toEqual(['it has no Tint material']);
  });

  it('checks the die keeps its middle at the origin and its one-pip face up (+Y)', () => {
    const die = (oneAt: [number, number, number]): GlbSummary => ({
      min: [-0.25, -0.25, -0.25],
      max: [0.25, 0.25, 0.25],
      triangles: 1200,
      shadowTriangles: 150,
      materials: ['Body', 'Pip', 'One'],
      byMaterial: { One: { min: [oneAt[0] - 0.07, oneAt[1] - 0.02, oneAt[2] - 0.07], max: [oneAt[0] + 0.07, oneAt[1] + 0.02, oneAt[2] + 0.07] } },
      transformedNodes: [],
    });
    expect(contractProblems('die', die([0, 0.24, 0]))).toEqual([]);
    expect(contractProblems('die', die([0, 0, 0.24]))).toEqual(['the one-pip face is not on top (+Y): its pip is at 0.00, 0.00, 0.24']);
  });
});
