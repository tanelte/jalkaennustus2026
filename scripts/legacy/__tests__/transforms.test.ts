import { describe, it, expect } from 'vitest';
import {
  SINGLETON_KEY,
  SINGLETON_NAME,
  transformGroups,
  transformUsers,
  transformScores,
} from '../transforms';

describe('transformGroups', () => {
  it('passes legacy username + encrypted_password through', () => {
    const out = transformGroups([
      { id: 1, username: 'mehed', encryptedPassword: '$2a$10$x' },
      { id: 2, username: 'NortalRM', encryptedPassword: '$2a$10$y' },
    ]);
    expect(out).toEqual([
      { username: 'mehed', passwordHash: '$2a$10$x', legacyId: 1 },
      { username: 'NortalRM', passwordHash: '$2a$10$y', legacyId: 2 },
    ]);
  });
});

describe('transformUsers', () => {
  it('collapses every "tegelikud tulemused" row to the singleton key', () => {
    const out = transformUsers(
      [
        { id: 1, name: 'Mart' },
        { id: 12, name: SINGLETON_NAME },
        { id: 17, name: SINGLETON_NAME },
        { id: 34, name: SINGLETON_NAME },
      ],
      [],
      new Map(),
    );
    expect(out.userKeyByLegacyId.get(12)).toBe(SINGLETON_KEY);
    expect(out.userKeyByLegacyId.get(17)).toBe(SINGLETON_KEY);
    expect(out.userKeyByLegacyId.get(34)).toBe(SINGLETON_KEY);
    expect(out.userKeyByLegacyId.get(1)).toBe(1);
    expect(out.users.map((u) => u.username)).toEqual(['Mart']); // singletons omitted
  });

  it('keeps same-name users as distinct rows (Trevor #37 and Trevor #53)', () => {
    const out = transformUsers(
      [
        { id: 37, name: 'Trevor' },
        { id: 53, name: 'Trevor' },
      ],
      [],
      new Map(),
    );
    expect(out.users).toHaveLength(2);
    expect(out.users.map((u) => u.legacyId)).toEqual([37, 53]);
    expect(out.users.every((u) => u.username === 'Trevor')).toBe(true);
  });

  it('fills empty names with legacy_user_<id>', () => {
    const out = transformUsers([{ id: 44, name: '' }], [], new Map());
    expect(out.users[0]!.username).toBe('legacy_user_44');
  });

  it('attaches groupUsernames from user_groups via legacy group id map', () => {
    const groupNames = new Map<number, string>([
      [1, 'mehed'],
      [4, 'NortalRM'],
    ]);
    const out = transformUsers(
      [{ id: 11, name: 'Tarts' }],
      [
        { id: 1, userId: 11, groupId: 1 },
        { id: 2, userId: 11, groupId: 4 },
      ],
      groupNames,
    );
    expect(out.users[0]!.groupUsernames).toEqual(['NortalRM', 'mehed']);
  });
});

describe('transformScores', () => {
  const groupNames = new Map<number, string>([
    [1, 'mehed'],
    [4, 'NortalRM'],
  ]);
  const tournamentCodes = new Map<number, string>([
    [3, 'EM2016'],
    [4, 'WC2018'],
  ]);

  function userKeys(entries: Array<[number, number | typeof SINGLETON_KEY]>) {
    return new Map<number, number | typeof SINGLETON_KEY>(entries);
  }

  it('computes finishing_position by RANK() over points DESC, ties share rank', () => {
    const out = transformScores({
      results: [
        { id: 100, tournamentId: 3, points: 200, userGroupId: 10 },
        { id: 101, tournamentId: 3, points: 200, userGroupId: 11 },
        { id: 102, tournamentId: 3, points: 150, userGroupId: 12 },
      ],
      userGroups: [
        { id: 10, userId: 1, groupId: 1 },
        { id: 11, userId: 2, groupId: 1 },
        { id: 12, userId: 3, groupId: 1 },
      ],
      legacyUserKeyByLegacyId: userKeys([
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
      legacyGroupUsernameById: groupNames,
      legacyTournamentCodeById: tournamentCodes,
    });

    const ranks = out.scores
      .filter((s) => s.tournamentCode === 'EM2016')
      .map((s) => ({ userKey: s.userKey, rank: s.finishingPosition }));

    // 200, 200, 150 → ranks 1, 1, 3
    expect(ranks.sort((a, b) => (a.userKey as number) - (b.userKey as number))).toEqual([
      { userKey: 1, rank: 1 },
      { userKey: 2, rank: 1 },
      { userKey: 3, rank: 3 },
    ]);
    expect(out.report.ok).toBe(true);
  });

  it('excludes null points but reconciles them in the report', () => {
    const out = transformScores({
      results: [
        { id: 1, tournamentId: 3, points: 100, userGroupId: 10 },
        { id: 2, tournamentId: 3, points: null, userGroupId: 11 },
      ],
      userGroups: [
        { id: 10, userId: 1, groupId: 1 },
        { id: 11, userId: 2, groupId: 1 },
      ],
      legacyUserKeyByLegacyId: userKeys([
        [1, 1],
        [2, 2],
      ]),
      legacyGroupUsernameById: groupNames,
      legacyTournamentCodeById: tournamentCodes,
    });
    expect(out.scores).toHaveLength(1);
    expect(out.report.totals.produced).toBe(1);
    expect(out.report.totals.excludedNullPoints).toBe(1);
    expect(out.report.totals.legacyRows).toBe(2);
    expect(out.report.ok).toBe(true);
  });

  it('collapses two singleton user_group rows for the same (group, tournament) to one score', () => {
    const out = transformScores({
      results: [
        // Two per-group magic-user rows that should collapse to one singleton row.
        { id: 1, tournamentId: 3, points: 300, userGroupId: 99 },
        { id: 2, tournamentId: 3, points: 350, userGroupId: 100 },
      ],
      userGroups: [
        { id: 99, userId: 12, groupId: 1 }, // legacy id 12 = tegelikud tulemused
        { id: 100, userId: 17, groupId: 1 }, // legacy id 17 = tegelikud tulemused
      ],
      legacyUserKeyByLegacyId: userKeys([
        [12, SINGLETON_KEY],
        [17, SINGLETON_KEY],
      ]),
      legacyGroupUsernameById: groupNames,
      legacyTournamentCodeById: tournamentCodes,
    });
    expect(out.scores).toHaveLength(1);
    expect(out.scores[0]!.userKey).toBe(SINGLETON_KEY);
    expect(out.scores[0]!.totalPoints).toBe(350); // MAX kept
    expect(out.report.totals.collapsedSingletonDuplicates).toBe(1);
    expect(out.report.ok).toBe(true);
  });

  it('routes orphan user_group_id references into the orphan bucket', () => {
    const out = transformScores({
      results: [{ id: 1, tournamentId: 3, points: 100, userGroupId: 999 }],
      userGroups: [],
      legacyUserKeyByLegacyId: new Map(),
      legacyGroupUsernameById: groupNames,
      legacyTournamentCodeById: tournamentCodes,
    });
    expect(out.scores).toHaveLength(0);
    expect(out.report.totals.orphanRefs).toBe(1);
    expect(out.report.ok).toBe(true);
  });
});
