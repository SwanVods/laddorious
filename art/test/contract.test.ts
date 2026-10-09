import { describe, expect, it } from 'vitest';
import { contractProblems } from '../contract';
import type { GlbSummary } from '../glb';

const knight = (change: Partial<GlbSummary> = {}): GlbSummary => ({
  min: [-0.42, 0, -0.45],
  max: [0.42, 1.2, 0.45],
  triangles: 3200,
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

  it('refuses a model with no rule', () => {
    expect(contractProblems('teapot', knight())).toEqual(['teapot has no rule in art/contract.ts']);
  });

  it('checks the die keeps its middle at the origin and its one-pip face up (+Y)', () => {
    const die = (oneAt: [number, number, number]): GlbSummary => ({
      min: [-0.25, -0.25, -0.25],
      max: [0.25, 0.25, 0.25],
      triangles: 1200,
      materials: ['Body', 'Pip', 'One'],
      byMaterial: { One: { min: [oneAt[0] - 0.07, oneAt[1] - 0.02, oneAt[2] - 0.07], max: [oneAt[0] + 0.07, oneAt[1] + 0.02, oneAt[2] + 0.07] } },
      transformedNodes: [],
    });
    expect(contractProblems('die', die([0, 0.24, 0]))).toEqual([]);
    expect(contractProblems('die', die([0, 0, 0.24]))).toEqual(['the one-pip face is not on top (+Y): its pip is at 0.00, 0.00, 0.24']);
  });
});
