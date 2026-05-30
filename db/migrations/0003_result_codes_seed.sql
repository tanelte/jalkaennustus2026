-- Reference data: result_codes lookup table.
-- Estonian labels per LOCKED-7 (brainstorming-session-2026-05-30-1115.md, line 198-200).
-- The 'X' placeholder in label_et is the front team's perspective.

insert into result_codes (code, label_et, meaning_machine) values
  ('1A', 'X võidab kuni kahe väravaga',          'team1_narrow_win'),
  ('1B', 'X võidab kolme või enama väravaga',    'team1_wide_win'),
  ('2A', 'X kaotab kuni kahe väravaga',          'team2_narrow_win'),
  ('2B', 'X kaotab kolme või enama väravaga',    'team2_wide_win'),
  ('X',  'Viik',                                  'draw')
on conflict (code) do nothing;
