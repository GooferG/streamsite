import {
  toPublicStatus,
  projectBoard,
  normalizeSlotName,
  takenSlotSet,
  dedupeAgainstTaken,
} from '../suggestionBoard';

describe('toPublicStatus', () => {
  test('maps the four internal states to three public ones', () => {
    expect(toPublicStatus('done')).toBe('in');
    expect(toPublicStatus('passed')).toBe('skipped');
    expect(toPublicStatus('open')).toBe('pending');
    expect(toPublicStatus('in_bonus')).toBe('pending');
    expect(toPublicStatus('anything-else')).toBe('pending');
    expect(toPublicStatus(undefined)).toBe('pending');
  });
});

describe('projectBoard', () => {
  const SUGGESTIONS = [
    {
      id: 'p1', person: 'Ana', source: 'link', submittedAt: 123,
      slots: [
        { id: 's1', name: 'Big Bass', status: 'done' },
        { id: 's2', name: 'Gates', status: 'open' },
      ],
    },
    {
      id: 'p2', person: 'Bo', source: 'roster', submittedAt: 456,
      slots: [{ id: 's3', name: 'Doom', status: 'passed' }],
    },
  ];

  test('projects person + slots with public status, stripping internal fields', () => {
    const board = projectBoard(SUGGESTIONS);
    expect(board).toEqual([
      { person: 'Ana', slots: [
        { name: 'Big Bass', status: 'in' },
        { name: 'Gates', status: 'pending' },
      ] },
      { person: 'Bo', slots: [{ name: 'Doom', status: 'skipped' }] },
    ]);
  });

  test('never leaks id / source / submittedAt', () => {
    const board = projectBoard(SUGGESTIONS);
    const json = JSON.stringify(board);
    expect(json).not.toMatch(/submittedAt|source|"id"|s1|p1/);
  });

  test('empty / missing input returns []', () => {
    expect(projectBoard([])).toEqual([]);
    expect(projectBoard(undefined)).toEqual([]);
    expect(projectBoard(null)).toEqual([]);
  });

  test('tolerates a person with no slots array', () => {
    expect(projectBoard([{ person: 'X' }])).toEqual([{ person: 'X', slots: [] }]);
  });
});

describe('normalizeSlotName', () => {
  test('lowercases and trims', () => {
    expect(normalizeSlotName('  Big Bass ')).toBe('big bass');
    expect(normalizeSlotName('BIG BASS')).toBe('big bass');
    expect(normalizeSlotName(null)).toBe('');
  });
});

describe('takenSlotSet', () => {
  const SUGGESTIONS = [
    { id: 'p1', person: 'Ana', slots: [
      { name: 'Big Bass', status: 'done' }, { name: 'Gates', status: 'passed' },
    ] },
    { id: 'p2', person: 'Bo', slots: [{ name: 'Doom', status: 'open' }] },
  ];

  test('collects all slot names lowercased across people and statuses', () => {
    const taken = takenSlotSet(SUGGESTIONS);
    expect(taken.has('big bass')).toBe(true); // done still blocks
    expect(taken.has('gates')).toBe(true);    // passed still blocks
    expect(taken.has('doom')).toBe(true);
    expect(taken.size).toBe(3);
  });

  test('excludePersonId omits that entry’s own slots (returning submitter)', () => {
    const taken = takenSlotSet(SUGGESTIONS, { excludePersonId: 'p1' });
    expect(taken.has('big bass')).toBe(false);
    expect(taken.has('gates')).toBe(false);
    expect(taken.has('doom')).toBe(true);
  });

  test('handles empty / missing', () => {
    expect(takenSlotSet([]).size).toBe(0);
    expect(takenSlotSet(undefined).size).toBe(0);
  });
});

describe('dedupeAgainstTaken', () => {
  test('partitions accepted vs dropped by the taken set (case-insensitive)', () => {
    const taken = new Set(['big bass']);
    const { accepted, dropped } = dedupeAgainstTaken(['BIG BASS', 'Gates', 'Doom'], taken);
    expect(accepted).toEqual(['Gates', 'Doom']);
    expect(dropped).toEqual(['BIG BASS']);
  });

  test('dedups within the incoming batch (keeps first occurrence)', () => {
    const { accepted, dropped } = dedupeAgainstTaken(['Gates', 'gates', 'Doom'], new Set());
    expect(accepted).toEqual(['Gates', 'Doom']);
    expect(dropped).toEqual(['gates']); // second occurrence dropped as in-batch dup
  });

  test('empty input yields empty partitions', () => {
    expect(dedupeAgainstTaken([], new Set())).toEqual({ accepted: [], dropped: [] });
  });
});
