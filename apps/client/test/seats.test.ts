import { buildSeats } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { colorSeat, colorSeats } from '../src/service/seats';

describe('seat colours (spec #4 M10)', () => {
  it('colours seats by their place at the table: pink, blue, lime, purple', () => {
    const seats = buildSeats([{ nickname: 'Ari', piece: 'knight' }, { nickname: 'Bo', piece: 'pawn' }]);
    expect(colorSeats(seats).map((s) => s.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
    expect(colorSeat(seats[1]!, 1)).toEqual({ ...seats[1], color: '#3b82f6' });
  });
});
