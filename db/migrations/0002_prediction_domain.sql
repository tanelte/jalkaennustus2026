-- Prediction-domain schema: teams, result_codes, games, user_games, user_teams,
-- user_best_thirds, questions, user_questions, legacy_tournament_scores.
-- Constitution Critical Rule 9: forward-only during tournament windows.

create table if not exists result_codes (
  code text primary key,
  label_et text not null,
  meaning_machine text not null
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  code text not null,
  name_et text not null,
  group_letter char(1) not null,
  created_at timestamptz not null default now(),
  constraint teams_tournament_code_unique unique (tournament_id, code)
);

create index if not exists teams_tournament_group_idx
  on teams (tournament_id, group_letter);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  stage_code text not null,
  round_label text not null,
  kickoff_at timestamptz not null,
  team_home_id uuid references teams(id) on delete set null,
  team_away_id uuid references teams(id) on delete set null,
  score_home integer,
  score_away integer,
  final_status text,
  result_code text references result_codes(code),
  double_points boolean not null default false,
  created_at timestamptz not null default now(),
  constraint games_tournament_round_unique unique (tournament_id, round_label)
);

create index if not exists games_tournament_stage_kickoff_idx
  on games (tournament_id, stage_code, kickoff_at);

create table if not exists user_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  prediction text not null,
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_games_user_game_unique unique (user_id, game_id)
);

create table if not exists user_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round text not null,
  slot text not null,
  team_id uuid not null references teams(id) on delete cascade,
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_teams_user_round_slot_unique unique (user_id, tournament_id, round, slot)
);

create table if not exists user_best_thirds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  group_letter char(1) not null,
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_best_thirds_user_tournament_letter_unique unique (user_id, tournament_id, group_letter)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  position integer not null,
  prompt_et text not null,
  answer_shape text not null,
  correct_answer text,
  conditional_on_position integer,
  created_at timestamptz not null default now(),
  constraint questions_tournament_position_unique unique (tournament_id, position)
);

create table if not exists user_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer text not null,
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_questions_user_question_unique unique (user_id, question_id)
);

create table if not exists legacy_tournament_scores (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  total_points integer not null,
  finishing_position integer not null,
  created_at timestamptz not null default now(),
  constraint legacy_tournament_scores_unique unique (group_id, tournament_id, user_id)
);
