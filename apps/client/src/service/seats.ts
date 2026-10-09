import type { Seat } from '@laddorious/host';
import { SEAT_COLORS } from '../app/theme';
import type { SeatInfo } from './matchService';

/** A seat with its colour, which follows its place at the table on every screen (spec #4 M10). */
export function colorSeat(seat: Seat, index: number): SeatInfo {
  return { ...seat, color: SEAT_COLORS[index % SEAT_COLORS.length]! };
}

export function colorSeats(seats: readonly Seat[]): SeatInfo[] {
  return seats.map((seat, i) => colorSeat(seat, i));
}
