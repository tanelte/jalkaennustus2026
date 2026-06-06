import { describe, expect, it, vi } from 'vitest';
import { loadAllTriviaPeerRowsForQuestionsCore } from './load-trivia-payloads';

describe('loadAllTriviaPeerRowsForQuestionsCore', () => {
  it('returns a Map keyed by questionId with PeerRow[] grouped from one batched query', async () => {
    const findGroupMembers = vi.fn(async () => [
      { user_id: 'u-viewer', username: 'Viewer' },
      { user_id: 'u-mart', username: 'Mart' },
      { user_id: 'u-anu', username: 'Anu' },
      { user_id: 'sys', username: 'tegelikud tulemused' },
    ]);
    const findSystemUserId = vi.fn(async () => 'sys');
    const findAnswersForQuestions = vi.fn(async () => [
      { user_id: 'u-mart', question_id: 'q-1', answer: 'Brasiilia', points: 3 },
      { user_id: 'u-mart', question_id: 'q-2', answer: '7', points: null },
      { user_id: 'u-anu', question_id: 'q-1', answer: 'Argentina', points: 0 },
      // q-5: peer submitted an answer — peer view shows it verbatim, no Q4-trick filter
      { user_id: 'u-anu', question_id: 'q-5', answer: 'Saksamaa', points: null },
    ]);

    const out = await loadAllTriviaPeerRowsForQuestionsCore(
      ['q-1', 'q-2', 'q-3', 'q-5'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers,
        findSystemUserId,
        findAnswersForQuestions,
      },
    );

    expect(out.get('q-1')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: { answer: 'Brasiilia', points: 3 },
      },
      {
        peerId: 'u-anu',
        peerName: 'Anu',
        submittedPayload: { answer: 'Argentina', points: 0 },
      },
    ]);
    expect(out.get('q-2')).toEqual([
      {
        peerId: 'u-mart',
        peerName: 'Mart',
        submittedPayload: { answer: '7', points: null },
      },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
    expect(out.get('q-3')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
      { peerId: 'u-anu', peerName: 'Anu', submittedPayload: null },
    ]);
    // Q5: shows whatever the peer submitted regardless of Q4 correctness.
    expect(out.get('q-5')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
      {
        peerId: 'u-anu',
        peerName: 'Anu',
        submittedPayload: { answer: 'Saksamaa', points: null },
      },
    ]);

    expect(findAnswersForQuestions).toHaveBeenCalledOnce();
    expect(findAnswersForQuestions).toHaveBeenCalledWith(
      ['q-1', 'q-2', 'q-3', 'q-5'],
      ['u-mart', 'u-anu'],
    );
  });

  it('excludes the viewer and the system singleton from every peer row', async () => {
    const out = await loadAllTriviaPeerRowsForQuestionsCore(
      ['q-1'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findAnswersForQuestions: async () => [
          {
            user_id: 'u-viewer',
            question_id: 'q-1',
            answer: 'self',
            points: null,
          },
          {
            user_id: 'sys',
            question_id: 'q-1',
            answer: 'official',
            points: null,
          },
          {
            user_id: 'u-mart',
            question_id: 'q-1',
            answer: 'Brasiilia',
            points: null,
          },
        ],
      },
    );
    const rows = out.get('q-1') ?? [];
    expect(rows.map((r) => r.peerId)).toEqual(['u-mart']);
    expect(rows[0].submittedPayload).toEqual({
      answer: 'Brasiilia',
      points: null,
    });
  });

  it('returns empty arrays per questionId when the viewer is the only peer (singleton group)', async () => {
    const findAnswersForQuestions = vi.fn();
    const out = await loadAllTriviaPeerRowsForQuestionsCore(
      ['q-1', 'q-2'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'sys', username: 'tegelikud tulemused' },
        ],
        findSystemUserId: async () => 'sys',
        findAnswersForQuestions,
      },
    );
    expect(out.get('q-1')).toEqual([]);
    expect(out.get('q-2')).toEqual([]);
    expect(findAnswersForQuestions).not.toHaveBeenCalled();
  });

  it('returns an empty (un-seeded) map when no questionIds are passed', async () => {
    const findAnswersForQuestions = vi.fn();
    const out = await loadAllTriviaPeerRowsForQuestionsCore(
      [],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: vi.fn(),
        findSystemUserId: vi.fn(),
        findAnswersForQuestions,
      },
    );
    expect(out.size).toBe(0);
    expect(findAnswersForQuestions).not.toHaveBeenCalled();
  });

  it('treats empty answer strings as not-submitted (null payload)', async () => {
    const out = await loadAllTriviaPeerRowsForQuestionsCore(
      ['q-1'],
      { groupId: 'group-1', viewerUserId: 'u-viewer' },
      {
        findGroupMembers: async () => [
          { user_id: 'u-viewer', username: 'Viewer' },
          { user_id: 'u-mart', username: 'Mart' },
        ],
        findSystemUserId: async () => 'sys',
        findAnswersForQuestions: async () => [
          { user_id: 'u-mart', question_id: 'q-1', answer: '', points: null },
        ],
      },
    );
    expect(out.get('q-1')).toEqual([
      { peerId: 'u-mart', peerName: 'Mart', submittedPayload: null },
    ]);
  });
});
