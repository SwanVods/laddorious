import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOW_SLOTS, SLOT_FILES, slotFile } from '../../apps/client/src/assets/slotFiles';
import { MAX_TOTAL_BYTES, MODELS, contractProblems } from '../contract';
import { readGlb } from '../glb';

const DIR = new URL('../../apps/client/public/models/', import.meta.url);
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort() : [];

describe('the built models (spec #5 §7)', () => {
  it('has a built file for every slot the game loads, built for that slot', () => {
    for (const [slot, id] of Object.entries(SLOT_FILES)) {
      expect(files, `${slot} is listed in slotFiles.ts but ${id}.glb isn't built`).toContain(`${id}.glb`);
      expect(MODELS[id!]?.slot, `${id} is built for another slot`).toBe(slot);
    }
  });

  it('has a lighter file for every slot that loads one on Low quality (spec #5 A14)', () => {
    for (const slot of LOW_SLOTS) expect(files, `${slot} has no Low file`).toContain(`${slotFile(slot, true)}.glb`);
  });

  for (const file of files) {
    it(`${file} keeps its contract`, () => {
      const model = readGlb(new Uint8Array(readFileSync(new URL(file, DIR))));
      expect(contractProblems(file.replace(/\.glb$/, ''), model)).toEqual([]);
    });
  }

  it('keeps all the models together under 2.5 MB', () => {
    const total = files.reduce((sum, f) => sum + statSync(new URL(f, DIR)).size, 0);
    expect(total).toBeLessThan(MAX_TOTAL_BYTES);
  });
});
