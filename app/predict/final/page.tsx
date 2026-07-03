import { and, asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FinalPeerView } from '@/components/peer-predictions/final-peer-view';
import { TopBar } from '@/components/top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { WindowStatePill } from '@/components/window-state-pill';
import { auth, signOut } from '@/lib/auth';
import {
  clearCurrentUserCookie,
  requireCurrentUserId,
} from '@/lib/current-user';
import { db } from '@/lib/db';
import { loadFinalPeerRows } from '@/lib/peer-predictions/load-final-payloads';
import { resolveEditMode } from '@/lib/pin/edit-mode';
import { getMaskedRecoveryEmailForUser } from '@/lib/pin/recovery';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getSystemUserId } from '@/lib/system-user';
import { resolveTournamentCode, getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, teams, user_teams, users } from '@/db/schema';
import { FinalForm, type CandidateTeamView } from './final-form';
import {
  buildFinalSlotResults,
  type FinalResultsView,
  type OfficialFinalSlot,
} from './result-view';
import {
  FINAL_ROUND_VALUE,
  FINAL_SLOTS,
  FINAL_STAGE_CODE,
  isFinalSlot,
  type FinalSlot,
} from './constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finaali ennustus — Jalkaennustus' };

async function logoutAction() {
  'use server';
  await clearCurrentUserCookie();
  await signOut({ redirectTo: '/login' });
}

async function loadPlayerContext(
  userId: string,
): Promise<{ playerName: string; isOperator: boolean }> {
  const rows = await db
    .select({ username: users.username, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    playerName: rows[0]?.username ?? 'tundmatu mängija',
    isOperator: rows[0]?.is_operator ?? false,
  };
}

async function loadCandidateTeams(tournamentId: string): Promise<CandidateTeamView[]> {
  // The four semifinalists become known the moment SF pairings are set: both
  // SF games carry non-null home/away team IDs. Before that (during local-dev
  // validation), fall back to all 48 tournament teams per the S09 AC.
  const sfGames = await db
    .select({
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
    })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), eq(games.stage_code, 'sf')));

  const sfTeamIds = sfGames
    .flatMap((g) => [g.team_home_id, g.team_away_id])
    .filter((id): id is string => id !== null);
  const allFourKnown = sfGames.length === 2 && sfTeamIds.length === 4;

  const rows = allFourKnown
    ? await db
        .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
        .from(teams)
        .where(inArray(teams.id, sfTeamIds))
        .orderBy(asc(teams.name_et))
    : await db
        .select({ id: teams.id, code: teams.code, name_et: teams.name_et })
        .from(teams)
        .where(eq(teams.tournament_id, tournamentId))
        .orderBy(asc(teams.name_et));

  return rows;
}

async function loadCurrentPicks(
  userId: string,
  tournamentId: string,
): Promise<Partial<Record<FinalSlot, string>>> {
  const rows = await db
    .select({ slot: user_teams.slot, team_id: user_teams.team_id })
    .from(user_teams)
    .where(
      and(
        eq(user_teams.user_id, userId),
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
      ),
    );
  const out: Partial<Record<FinalSlot, string>> = {};
  for (const row of rows) {
    if (isFinalSlot(row.slot)) out[row.slot] = row.team_id;
  }
  return out;
}

/**
 * The official medal standings: the `tegelikud tulemused` singleton's four
 * final picks, joined to team names. Empty until the operator confirms the
 * result; the result view then gates on the full set being present.
 */
async function loadOfficialSlots(
  tournamentId: string,
): Promise<Partial<Record<FinalSlot, OfficialFinalSlot>>> {
  const systemUserId = await getSystemUserId();
  const rows = await db
    .select({
      slot: user_teams.slot,
      team_id: user_teams.team_id,
      team_name: teams.name_et,
    })
    .from(user_teams)
    .innerJoin(teams, eq(teams.id, user_teams.team_id))
    .where(
      and(
        eq(user_teams.user_id, systemUserId),
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
      ),
    );
  const out: Partial<Record<FinalSlot, OfficialFinalSlot>> = {};
  for (const row of rows) {
    if (isFinalSlot(row.slot)) {
      out[row.slot] = { teamId: row.team_id, teamName: row.team_name };
    }
  }
  return out;
}

/**
 * UX spec §15.4 — shared prediction shell wraps the F1–F4 medal-position
 * picker. Pure re-skin: scoring & validation rules untouched (story S05 §Out
 * and constitution §6 Rule 6).
 */
export default async function FinalPredictPage() {
  const session = await auth();
  if (!session?.user?.group_id) redirect('/login');

  const userId = await requireCurrentUserId();
  const tournamentId = await getCurrentTournamentId();
  const tournamentChip = resolveTournamentCode();

  const [
    candidates,
    initialPicks,
    officialSlots,
    gate,
    { playerName, isOperator },
    maskedRecoveryEmail,
    peerRows,
  ] = await Promise.all([
    loadCandidateTeams(tournamentId),
    loadCurrentPicks(userId, tournamentId),
    loadOfficialSlots(tournamentId),
    isStageOpen(FINAL_STAGE_CODE, tournamentId),
    loadPlayerContext(userId),
    getMaskedRecoveryEmailForUser(userId),
    // E04-S05 — page-level peer-view payload for F1/F2/F3/F4 ordering.
    // Submitted-only gate: peers with < 4 picks come back as null per the
    // loader's contract.
    loadFinalPeerRows(tournamentId, {
      groupId: session.user.group_id,
      viewerUserId: userId,
    }),
  ]);

  const editMode = await resolveEditMode({ userId, stageGate: gate });

  // Per-slot earned-points tail, once the official medal standings are complete.
  const results: FinalResultsView | null = buildFinalSlotResults(
    initialPicks,
    officialSlots,
  );

  return (
    <>
      <TopBar
        groupName={session.user.username}
        playerName={playerName}
        isOperator={isOperator}
        tournamentChip={tournamentChip}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Asukoht" className="text-sm text-text-muted">
          <Link href="/" className="hover:underline">
            Avaleht
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Finaali ennustus</span>
        </nav>

        <WindowStatePill gate={gate} />

        {/*
          E04-S05 — page-level peer-view trigger, aligned right. Renders
          nothing for a singleton group (peerRows.length === 0).
        */}
        <div className="flex justify-end">
          <FinalPeerView
            groupName={session.user.username}
            peerRows={peerRows}
          />
        </div>

        <header>
          <h1 className="text-3xl font-semibold text-text-primary">
            Finaali ennustus
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Vali igale medalikohale meeskond: F1 kuld, F2 hõbe, F3 pronks,
            F4 neljas koht. Punkte annab vaid see koht, kus meeskond ka
            päriselt finišeerib (F1 = 60, F2 = 40, F3 = 30, F4 = 20).
          </p>
          {candidates.length === 4 ? (
            <p className="mt-1 text-sm text-text-muted">
              Valikus on 4 poolfinaali jõudnud meeskonda.
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-muted">
              Poolfinaali paarid pole veel teada — valikus on kõik turniiri
              meeskonnad.
            </p>
          )}
        </header>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <FinalForm
              candidates={candidates}
              initialPicks={initialPicks}
              mode={editMode}
              slotsOrder={FINAL_SLOTS}
              userId={userId}
              maskedRecoveryEmail={maskedRecoveryEmail}
              results={results}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
