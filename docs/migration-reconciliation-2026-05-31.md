# Legacy migration reconciliation report

- **Source dump:** `../jalkaennustus/dump-plain-d11hgd41ejed91-202408181231.sql`
- **Built at:** 2026-05-31T10:25:50.451Z
- **Outcome:** **RECONCILIATION: OK**

## Totals

| Category | Count |
|----------|------:|
| Legacy user_results rows | 185 |
| Produced legacy_tournament_scores rows | 155 |
| Excluded — NULL points | 12 |
| Collapsed — duplicate singleton / same-user rows | 0 |
| Orphan user_group refs | 18 |
| Unknown tournament | 0 |

Balance: `legacyRows == produced + excludedNullPoints + collapsedSingletonDuplicates + orphanRefs + unknownTournament` per cell.

## Per (group, tournament) breakdown

| Group | Tournament | Legacy rows | Produced | NULL points | Collapsed | Orphan | Unknown | Balanced |
|-------|------------|------------:|---------:|------------:|----------:|-------:|--------:|:--------:|
| <orphan> | <orphan> | 18 | 0 | 0 | 0 | 18 | 0 | ✓ |
| NortRM | EM2016 | 14 | 13 | 1 | 0 | 0 | 0 | ✓ |
| NortRM | WC2018 | 29 | 29 | 0 | 0 | 0 | 0 | ✓ |
| Shound | WC2018 | 7 | 6 | 1 | 0 | 0 | 0 | ✓ |
| Tafkin | WC2018 | 1 | 0 | 1 | 0 | 0 | 0 | ✓ |
| ats | WC2022 | 1 | 0 | 1 | 0 | 0 | 0 | ✓ |
| jaank | WC2018 | 2 | 0 | 2 | 0 | 0 | 0 | ✓ |
| kommuun | WC2018 | 2 | 0 | 2 | 0 | 0 | 0 | ✓ |
| krisrei | WC2018 | 2 | 0 | 2 | 0 | 0 | 0 | ✓ |
| mehed | EM2012 | 7 | 7 | 0 | 0 | 0 | 0 | ✓ |
| mehed | EM2016 | 9 | 9 | 0 | 0 | 0 | 0 | ✓ |
| mehed | EM2020 | 9 | 9 | 0 | 0 | 0 | 0 | ✓ |
| mehed | EM2024 | 15 | 15 | 0 | 0 | 0 | 0 | ✓ |
| mehed | WC2014 | 7 | 7 | 0 | 0 | 0 | 0 | ✓ |
| mehed | WC2018 | 9 | 9 | 0 | 0 | 0 | 0 | ✓ |
| mehed | WC2022 | 12 | 12 | 0 | 0 | 0 | 0 | ✓ |
| mowka | WC2018 | 1 | 0 | 1 | 0 | 0 | 0 | ✓ |
| tanel | EM2012 | 7 | 7 | 0 | 0 | 0 | 0 | ✓ |
| tanel | EM2016 | 7 | 7 | 0 | 0 | 0 | 0 | ✓ |
| tanel | EM2020 | 9 | 9 | 0 | 0 | 0 | 0 | ✓ |
| tanel | WC2014 | 7 | 7 | 0 | 0 | 0 | 0 | ✓ |
| tanel | WC2018 | 9 | 9 | 0 | 0 | 0 | 0 | ✓ |
| testgroup | WC2018 | 1 | 0 | 1 | 0 | 0 | 0 | ✓ |
