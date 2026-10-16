import { describe, expect, it } from 'vitest';
import {
  CARD_TYPES,
  ConfigError,
  RARITIES,
  STARTER_CARDS,
  cardById,
  createStream,
  drawCard,
  resolveConfig,
  validateCards,
  type CardDef,
  type MatchConfigInput,
} from '../src/index';

const EQUAL = { movement: 1, defense: 1, attack: 1, risky: 1, misc: 1 };

describe('starter set', () => {
  it('has 17 cards with unique ids and covers every (type, rarity) bucket', () => {
    expect(STARTER_CARDS).toHaveLength(17);
    expect(() => validateCards(STARTER_CARDS)).not.toThrow();
    for (const type of CARD_TYPES) {
      for (const rarity of RARITIES) expect(STARTER_CARDS.some((c) => c.type === type && c.rarity === rarity)).toBe(true);
    }
  });

  it('cardById finds cards and throws on unknown ids', () => {
    expect(cardById(STARTER_CARDS, 'shove').type).toBe('attack');
    expect(() => cardById(STARTER_CARDS, 'nope')).toThrow();
  });
});

describe('validateCards', () => {
  it('rejects a rarity with no card to deal, but allows a type with none (2026-10-15)', () => {
    expect(() => validateCards(STARTER_CARDS.filter((c) => c.rarity !== 'epic'))).toThrow(/no epic card to deal/);
    expect(() => validateCards(STARTER_CARDS.filter((c) => c.id !== 'shield'))).not.toThrow();
  });
  it('rejects duplicate ids and non-positive weights', () => {
    expect(() => validateCards([...STARTER_CARDS, STARTER_CARDS[0]!])).toThrow(/duplicate/);
    expect(() => validateCards(STARTER_CARDS.map((c) => (c.id === 'sprint' ? { ...c, weight: 0 } : c)))).toThrow(/weight/);
  });
});

describe('resolveConfig', () => {
  it('rejects unknown window keys instead of ignoring them', () => {
    const windows = { fooMs: 1_000 } as unknown as MatchConfigInput['windows'];
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(/windows\.fooMs is not a known window/);
  });

  it('rejects the removed bonusGraceMs window', () => {
    const windows = { bonusGraceMs: 5_000 } as unknown as MatchConfigInput['windows'];
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(/windows\.bonusGraceMs is not a known window/);
  });

  it('fills spec §9 defaults', () => {
    const cfg = resolveConfig({ seed: 's' });
    expect(cfg.windows).toEqual({ diceMs: 12_000, challengeMs: 8_000, mysteryMs: 30_000 });
    expect(cfg.collision).toEqual({ knockback: 3, maxReplays: 3, maxWaves: 3 });
    expect(cfg.mystery.maxRerolls).toBe(2);
    expect(cfg.board.size).toBe(100);
    expect(cfg.board.generatorVersion).toBe(4);
    expect(cfg.board.analysis).toEqual({ median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 });
    expect(cfg.board.mysteryRarityWeights).toEqual({ common: 70, rare: 25, epic: 5 });
    expect(cfg.cards).toEqual(STARTER_CARDS);
    expect(cfg.cardValues).toEqual({});
    expect(cfg.checkInvariants).toBe(true);
  });

  it('merges partial sections and validates them', () => {
    expect(resolveConfig({ seed: 's', windows: { diceMs: 1 } }).windows.challengeMs).toBe(8_000);
    expect(() => resolveConfig({ seed: '' })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', windows: { diceMs: 0 } })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', collision: { maxWaves: 0 } })).toThrow(ConfigError);
  });
});

describe('drawCard', () => {
  it('only draws cards of the requested rarity', () => {
    const s = createStream('draw');
    for (let i = 0; i < 200; i++) expect(cardById(STARTER_CARDS, drawCard(STARTER_CARDS, 'epic', EQUAL, s)!).rarity).toBe('epic');
  });

  it('never returns the excluded card, even from a one-card bucket', () => {
    const s = createStream('exclude');
    for (let i = 0; i < 200; i++) expect(drawCard(STARTER_CARDS, 'rare', EQUAL, s, ['shield'])).not.toBe('shield');
  });

  it('never returns any card on the exclude list (polish spec 3.2)', () => {
    const s = createStream('exclude-many');
    const exclude = ['loaded-die', 'shield', 'heavy-boots', 'snake-bait'];
    for (let i = 0; i < 50; i++) expect(drawCard(STARTER_CARDS, 'rare', EQUAL, s, exclude)).toBe('snake-pit');
  });

  it('returns null, without using the stream, when every card of the rarity is excluded', () => {
    const s = createStream('none-left');
    const before = JSON.stringify(s);
    const rares = STARTER_CARDS.filter((c) => c.rarity === 'rare').map((c) => c.id);
    expect(drawCard(STARTER_CARDS, 'rare', EQUAL, s, rares)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('falls back to the other types when the weighted ones have run out', () => {
    const s = createStream('fallback');
    const onlyAttack = { movement: 0, defense: 0, attack: 1, risky: 0, misc: 0 };
    for (let i = 0; i < 50; i++) {
      const id = drawCard(STARTER_CARDS, 'rare', onlyAttack, s, ['heavy-boots']);
      expect(id).not.toBeNull();
      expect(cardById(STARTER_CARDS, id!).rarity).toBe('rare');
      expect(id).not.toBe('heavy-boots');
    }
  });

  it('respects type weights', () => {
    const s = createStream('types');
    const onlyAttack = { movement: 0, defense: 0, attack: 1, risky: 0, misc: 0 };
    for (let i = 0; i < 50; i++) expect(cardById(STARTER_CARDS, drawCard(STARTER_CARDS, 'common', onlyAttack, s)!).type).toBe('attack');
  });
});

describe('deep config validation (review I3)', () => {
  const card = (overrides: Partial<CardDef>): CardDef[] => [...STARTER_CARDS, { ...STARTER_CARDS[0]!, id: 'extra', ...overrides }];

  it('rejects an afterMove effect that re-triggers on its own movement without charges', () => {
    const runaway = card({
      effects: [{ op: 'conditional', trigger: { cause: 'effect', condition: 'landedOnSnakeHead' }, amount: 10, lifetime: { rounds: 5 } }],
    });
    expect(() => validateCards(runaway)).toThrow(ConfigError);
  });

  it.each<[string, CardDef[]]>([
    ['a die face outside 1..6', card({ effects: [{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: 7 }, lifetime: { charges: 1 } } }] })],
    ['a fractional move', card({ effects: [{ op: 'moveRelative', amount: 1.5 }] })],
    ['a gamble with no outcomes', card({ effects: [{ op: 'gamble', outcomes: [] }] })],
    ['a gamble with a zero weight', card({ effects: [{ op: 'gamble', outcomes: [{ weight: 0, ops: [] }] }] })],
    ['a board edit range that is backwards', card({ effects: [{ op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 6, maxAhead: 2, length: 8, lifetime: { rounds: 3 } }] })],
    ['a zero-round lifetime', card({ effects: [{ op: 'addEffect', template: { params: { hook: 'beforeSnake' }, lifetime: { rounds: 0 } } }] })],
    ['an unknown card type', card({ type: 'bogus' as CardDef['type'] })],
  ])('rejects %s', (_, cards) => {
    expect(() => validateCards(cards)).toThrow(ConfigError);
  });

  it('rejects type weights that can never pick a card', () => {
    const zero = { movement: 0, defense: 0, attack: 0, risky: 0, misc: 0 };
    expect(() => resolveConfig({ seed: 's', mystery: { typeWeights: zero } })).toThrow(ConfigError);
  });

  it('deep-merges nested board settings instead of dropping their defaults', () => {
    const cfg = resolveConfig({ seed: 's', board: { analysis: { median4pRounds: [15, 30] } } });
    expect(cfg.board.analysis).toEqual({ median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 });
  });

  it('rejects invalid board settings', () => {
    expect(() => resolveConfig({ seed: 's', board: { mysteryDensity: 2 } })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', board: { ladders: { count: [10, 8] } } })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', board: { maxAttempts: 0 } })).toThrow(ConfigError);
  });
});
