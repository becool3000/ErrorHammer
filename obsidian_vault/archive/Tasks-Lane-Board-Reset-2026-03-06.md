# Tasks Lane Board Reset Archive
Archived on 2026-03-06 by planner cleanup chain `PLN-019`.

## Purpose
1. Preserve closed and parked lane-card history removed from live `Tasks.md`.
2. Record deterministic supersession traceability from legacy cards to replacement cards.
3. Keep the active board limited to current pull-ready and dependency-blocked work only.

## Moved `DONE` Cards
1. `BLD-018` (`DONE`) moved from active board to archive after ReleaseOps builder handoff completion.
2. `BLD-014` (`DONE`) moved from active board to archive as closed legacy chain history.
3. `TW-014` (`DONE`) moved from active board to archive as closed legacy chain history.
4. `VF-014` (`DONE`) moved from active board to archive as closed legacy chain history.
5. `DOC-014` (`DONE`) moved from active board to archive as closed legacy chain history.
6. `BLD-012` (`DONE`) moved from active board to archive as closed legacy chain history.
7. `TW-012` (`DONE`) moved from active board to archive as closed legacy chain history.
8. `VF-012` (`DONE`) moved from active board to archive as closed legacy chain history.
9. `DOC-012` (`DONE`) moved from active board to archive as closed legacy chain history.
10. `BLD-011` (`DONE`) moved from active board to archive as closed legacy chain history.
11. `TW-011` (`DONE`) moved from active board to archive as closed legacy chain history.
12. `VF-011` (`DONE`) moved from active board to archive as closed legacy chain history.
13. `DOC-011` (`DONE`) moved from active board to archive as closed legacy chain history.

## `SUPERSEDED` Mapping Rows (`legacy -> replacement`)
1. `TW-018` (`IN_PROGRESS`) -> `TW-020`
Reason: ReleaseOps unfinished test scope reissued after clean-slate reset.
2. `VF-018` (`BLOCKED`) -> `VF-020`
Reason: ReleaseOps unfinished verification scope reissued after clean-slate reset.
3. `DOC-018` (`BLOCKED`) -> `DOC-020`
Reason: ReleaseOps unfinished documentation scope reissued after clean-slate reset.
4. `BLD-015` (`IN_PROGRESS`) -> `BLD-021`
Reason: Confidence/flow unfinished builder scope reissued after clean-slate reset.
5. `TW-015` (`READY`) -> `TW-021`
Reason: Confidence/flow queued test scope reissued after clean-slate reset.
6. `VF-015` (`READY`) -> `VF-021`
Reason: Confidence/flow queued verification scope reissued after clean-slate reset.
7. `DOC-015` (`READY`) -> `DOC-021`
Reason: Confidence/flow queued documentation scope reissued after clean-slate reset.
8. `BLD-016` (`READY`) -> `BLD-022`
Reason: Encounter queued builder scope reissued after clean-slate reset.
9. `TW-016` (`READY`) -> `TW-022`
Reason: Encounter queued test scope reissued after clean-slate reset.
10. `VF-016` (`READY`) -> `VF-022`
Reason: Encounter queued verification scope reissued after clean-slate reset.
11. `DOC-016` (`READY`) -> `DOC-022`
Reason: Encounter queued documentation scope reissued after clean-slate reset.

## Planner Chain Supersession
1. `PLN-018` -> `PLN-020`
Reason: continue unfinished ReleaseOps lane work under fresh clean-slate chain IDs.
2. `PLN-015` -> `PLN-021`
Reason: continue unfinished confidence/flow lane work under fresh clean-slate chain IDs.
3. `PLN-016` -> `PLN-022`
Reason: continue unfinished Rebar Bob lane work under fresh clean-slate chain IDs.

## Reissued Chain Priority Order
1. `PLN-020` / `BLD-020` (`P0`) is top pull.
2. `PLN-021` / `BLD-021` (`P1`) is second pull.
3. `PLN-022` / `BLD-022` (`P2`) is third pull.
