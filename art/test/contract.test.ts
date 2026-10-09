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

  it('refuses a model with no rule', () => {
    expect(contractProblems('teapot', knight())).toEqual(['teapot has no rule in art/contract.ts']);
  });

  const pad = (notchZ: [number, number], top: number = PARTS.padTop): GlbSummary => ({
    min: [-0.57, 0, -0.57],
    max: [0.57, top, 0.57],
    triangles: 1000,
    shadowTriangles: 0,
    materials: ['Tint', 'Ink'],
    byMaterial: { Ink: { min: [-0.09, top - 0.04, notchZ[0]], max: [0.09, top, notchZ[1]] } },
    transformedNodes: [],
  });

  it("checks a pad's notch points forward (+Z), the way the game turns it toward the landing (spec #5 A13)", () => {
    expect(contractProblems('pad', pad([0.33, 0.47]))).toEqual([]);
    expect(contractProblems('pad', pad([-0.47, -0.33]))).toEqual(['the Ink does not point forward (+Z): it reaches -0.33 forward and 0.47 back']);
  });

  it("keeps a pad's plate top where the game lays its symbol (PARTS.padTop)", () => {
    expect(contractProblems('pad', pad([0.33, 0.47], PARTS.padTop + 0.03))).toEqual([`its top is at 0.340, but the symbol lies at ${PARTS.padTop}`]);
  });

  it('keeps a tile to its one Tint material, so instancing can paint it, 0.30 tall (spec #5 A13)', () => {
    const tile: GlbSummary = { min: [-0.76, 0, -0.76], max: [0.76, 0.3, 0.76], triangles: 196, shadowTriangles: 0, materials: ['Tint', 'Edge'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('tile', tile)).toEqual(['it has 2 materials; at most 1']);
    expect(contractProblems('tile', { ...tile, max: [0.76, 0.22, 0.76], materials: ['Tint'] })).toEqual(['it is 0.22 tall; 0.29–0.31 expected']);
  });

  it('paints the landing ring, whirlpool and collar through Tint, so each takes its pair colour (spec #5 A13)', () => {
    const part = (materials: string[]): GlbSummary => ({ min: [-0.4, 0, -0.4], max: [0.4, 0.1, 0.4], triangles: 600, shadowTriangles: 0, materials, byMaterial: {}, transformedNodes: [] });
    expect(contractProblems('target', part(['Ring']))).toEqual(['it has no Tint material']);
    expect(contractProblems('vortex', part(['Inside', 'Glow']))).toEqual(['it has no Tint material']);
    expect(contractProblems('exit', part(['Collar']))).toEqual(['it has no Tint material']);
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
