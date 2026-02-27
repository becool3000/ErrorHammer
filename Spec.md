Error Hammer Game Spec

Error Hammer

Text-based construction ladder sim (dry deadpan + wholesome goofy)
MVP: single-player with AI competitors (bots), content-driven so Codex can add lots of jobs fast.
Launch path: itch (HTML5) first, then Play Store wrapper (TWA), then Steam wrapper and builds.

Sources for platform + tooling claims: itch HTML5 upload rules , Vite build and static deploy , Ajv JSON Schema validation , Android Trusted Web Activity + Digital Asset Links , Steamworks SteamPipe upload/builds , Firebase pieces for later async multiplayer .

0) One sentence pitch

You start as a tiny scrappy contractor with a hammer, climb to running a small scrappy company with up to 3 crews, competing against a couple of polite weird AI contractors in a living contract board.

1) Design goals

Fast, readable, “one more day” loop.

Low art burden. Mostly text, menus, logs, tiny icons.

Humor is dry and wholesome. Never mean.

Content scales via JSON packs and schema validation so Codex can add content safely.

Architecture supports later async multiplayer without rewriting core logic (actors submit intents, resolver produces results).

Non-goals for MVP:

Realtime multiplayer.

Complex pathing, physics, or maps.

Deep HR simulator. Crews are simple.

2) Tone bible (hard rules)

Never mock the player.

Failure is funny but gentle.

Clients are odd but sincere.

Competitors are not villains.

Style examples:

Success: “The deck no longer flexes like a nervous thought.”

Fail: “The drywall remains interpretive.”

Neutral: “You did the work. The work happened.”

Implementation rule:
Every job and event includes success_line, fail_line, neutral_line so writers (Codex) can expand humor without touching mechanics.

3) Player fantasy and progression arc

Start:

Solo contractor

1 tool: Hammer

Small neighborhood jobs only

Limited stamina per day

Mid:

Unlock better tools

Unlock districts

Unlock first crew

End (still scrappy):

Up to 3 crews

Light commercial and tiny municipal jobs

Modest fleet flavor only (truck/van as unlocks, not driving gameplay)

You still feel small, just more capable

4) Core loop (MVP)

Each “Day” is a turn.

Morning summary (weather, market note, odd headline)

Contract board refresh (finite list)

Player picks assignments:

Self: 0 to N jobs (stamina limited)

Crews (if unlocked): 0 to N jobs each (crew stamina limited)

Bots pick assignments

Resolver runs:

Conflicts resolved (two actors choose same contract)

Outcomes computed (success/fail/neutral)

Cash, rep, durability updated

Events applied

End-of-day report:

Ledger changes

Log lines (humor)

Next day

No waiting for other humans. Bots run instantly.

5) Systems
5.1 Stats and currencies

Player and bots share the same model.

Stats:

cash (int)

reputation (int)

staminaMax (int)

stamina (int, resets each day)

inventory.tools (map toolId -> durability int)

companyLevel (int, derived from rep thresholds)

districtUnlocks (set)

crews (array, max 3)

Derived:

contract access: based on tier + district unlocks

tie-break power: based on reputation

5.2 Stamina rules

Solo stamina starts at 4.

Each job costs stamina.

If not enough stamina, cannot assign.

Crew stamina:

Each crew has its own stamina pool, starts around 6.

Each crew can do 1 to 2 jobs per day early, then more by upgrades, but keep it modest.

5.3 Tools and durability

Tools:

Required by jobs (hard requirement)

Durability decreases on use

If durability hits 0, tool becomes “broken” and cannot be used until repaired or replaced

MVP repair:

Simple: “Repair tool” option at store for cash, restores durability.

5.4 Contracts and conflict resolution

Contract board is a list of contracts for the day.

Conflict:

If multiple actors select the same contract:

Higher reputation wins

Tie: deterministic RNG using day seed (so consistent results)

Losers:

Lose the opportunity, spend no stamina, but may get a small “wasted time” flavor line.

5.5 Outcome model (simple but expandable)

Each job has:

basePayout

risk (0..1)

repGain on success

repLoss on fail (small)

durabilityCost per tool used

Outcome:

Roll rng vs risk to determine fail, else success

Neutral outcome used for “meh” results triggered by events (rain, inspection)

5.6 Events

Events are small modifiers applied per day:

Rain: outdoor payout -10%

Hardware sale: tool prices -15%

Surprise inspection: higher failure chance for certain job tags

Events are data-driven and can be added as content.

5.7 Bots (AI competitors)

Bots are actors with a “personality profile” that weights decisions.

MVP bots:

Doug: buys tools impulsively, high risk tolerance

Marlene: efficient, avoids risk, prioritizes rep

Bot decision algorithm:

Score each available contract:

payout weight

rep weight

risk penalty (based on personality)

tool availability gate

Choose top-scoring contracts within stamina

Store decisions:

if tool unlock would increase next-day expected score, buy it

No cheating:

Same visibility and rules as player

6) Content-driven design (Codex-friendly)
6.1 Content packs

All gameplay content lives in /content/*.json.
Codex can add content by editing JSON only.

Files:

content/tools.json

content/jobs.json

content/events.json

content/districts.json

content/bots.json

content/strings.json (global quips, UI lines)

6.2 Schemas and validation

Add JSON Schema files in /schemas/*.schema.json and validate with Ajv.

Validation happens:

in a build step (npm run content:validate)

also at runtime in dev mode (fail fast)

6.3 Content compiler

A Node script reads all content JSON, validates, normalizes, and emits a single bundle:

src/generated/content.bundle.json

This keeps the runtime simple and makes loading fast.

7) Tech stack and deployment path
7.1 Frontend (itch first)

React + TypeScript

Vite build system

State: Zustand (or Redux Toolkit, your call)

Storage: local save in localStorage for MVP

itch packaging:

Build output zipped with index.html at the zip root per itch HTML5 upload doc

7.2 Android (later)

Wrap the same web app as a Trusted Web Activity (TWA)

Use Digital Asset Links (.well-known/assetlinks.json) to verify the relationship

7.3 Steam (later)

Wrap web build in a desktop shell (Tauri or Electron) and store saves locally.

Upload builds via SteamPipe scripts and Steamworks builds flow

7.4 Async multiplayer (optional later)

If you add async multiplayer:

Firebase Auth (anonymous sign-in to start)

Firestore for game state

Cloud Functions for authoritative resolution

Scheduled functions for timed ticks (if you choose ticks)

Firestore transactions for atomic “claim contract” semantics

MVP does not require Firebase.

8) Data models (TypeScript interfaces)
8.1 Core types

ToolDef

id, name, tier, price, maxDurability

tags[]

flavor: description, quip_buy, quip_break

JobDef

id, name, tier, districtId

requiredTools[]

staminaCost

basePayout

risk

repGainSuccess, repLossFail

tags[] (ex: outdoor, plumbing, electrical)

flavor: client_quote, success_line, fail_line, neutral_line

EventDef

id, name, weight

mods (structured modifiers)

flavor: headline, detail, impact_line

BotProfile

id, name

weights: wCash, wRep, wRiskAvoid, wToolBuy

flavorLines[]

8.2 Runtime state

GameState

day (int)

seed (int)

player: ActorState

bots: ActorState[]

contractBoard: ContractInstance[]

activeEventIds[]

log: DayLog[]

ActorState

actorId

cash, reputation

staminaMax, stamina

tools: Record<ToolId, ToolInstance>

crews: CrewState[]

CrewState

crewId, name

staminaMax, stamina

efficiency (small bonus)

reliability (small fail reduction)

morale (cosmetic for MVP)

ContractInstance

contractId (unique for day)

jobId

districtId

payoutMult (from economy/event)

expiresDay (usually same day)

claimedByActorId?

Intent

actorId

day

assignments[] where each assignment is { assignee: "self" | crewId, contractId }

Resolution

contractId

winnerActorId?

outcome: success | fail | neutral | lost

cashDelta

repDelta

toolDurabilityDeltas[]

logLine

9) Resolver architecture (important for Codex)

Split code into pure functions with no UI dependencies.

Modules:

rng.ts deterministic RNG (seeded)

economy.ts contract generation, pricing modifiers

bots.ts bot intent generation

resolver.ts resolves a day:

apply event mods

resolve conflicts

roll outcomes

apply deltas

append logs

save.ts serialize/deserialize game state

Rule: UI never edits state directly. UI creates intents and calls resolver.

This makes later server-side resolution easy.

10) UI spec (MVP screens)

Title screen

New game

Continue

Settings (text size, humor intensity slider optional)

Main screen layout

Left: Stats panel (cash, rep, stamina, day)

Center: Contract Board list (filter by district, tier)

Right: Assignments (self, crews)

Bottom: Buttons

Confirm Day

Store

Company

Store screen

Buy tools

Repair tools

Flavor lines on buy/repair

Company screen

Hire crew (when unlocked)

Rename crews

View bots “news” (flavor only)

End-of-day report modal

Summary totals

Scrollable log lines

Accessibility:

Big touch-friendly buttons for Play Store later.

Font scaling.

11) Content minimums (MVP numbers)

Districts: 3

Residential

Small Commercial

Civic Lite

Tools: 10

Hammer, Screwdriver, Wrench, Drill, Saw, Ladder, Level, Caulk Gun, Utility Knife, Stud Finder (joke tool)

Jobs: 30

10 tier 1

12 tier 2

8 tier 3

Events: 12

Weighted random selection, 1 to 2 per day

Bots: 2

12) Balancing targets (MVP)

Day 1 average payout if optimized: $120 to $220

First crew unlock around day 8 to 15 depending on play

Tool upgrade decisions matter, but you can always recover from mistakes

Failures should sting a little, but never brick the run

13) Save system

MVP:

Save GameState JSON to localStorage (one slot)

Later:

Add export/import save file

Add cloud save (Firebase or Steam Cloud later)

14) Testing and verification (Codex must keep green)
14.1 Unit tests (Vitest)

Required tests:

resolver deterministic: same seed + same intents = same results

stamina cannot go negative

tool requirement enforcement

conflict resolution priority by reputation

durability cannot drop below 0

content validation fails on missing required fields (schema)

14.2 Content validation in CI

npm run content:validate must run in CI and fail build on schema errors (Ajv).

15) Repo layout (create exactly this)
nail-and-error/
  README.md
  package.json
  vite.config.ts
  tsconfig.json

  content/
    tools.json
    jobs.json
    events.json
    districts.json
    bots.json
    strings.json

  schemas/
    tools.schema.json
    jobs.schema.json
    events.schema.json
    districts.schema.json
    bots.schema.json

  scripts/
    content_validate.ts
    content_compile.ts

  src/
    generated/
      content.bundle.json   (generated)
    core/
      rng.ts
      types.ts
      economy.ts
      bots.ts
      resolver.ts
      save.ts
      content.ts
    ui/
      App.tsx
      screens/
        Title.tsx
        Main.tsx
        Store.tsx
        Company.tsx
      components/
        ContractList.tsx
        AssignmentPanel.tsx
        DayReport.tsx
        StatsPanel.tsx
    main.tsx

  tests/
    resolver.test.ts
    economy.test.ts
    bots.test.ts
    content_validation.test.ts
16) Build commands (must exist)

npm run dev

npm run build (Vite build)

npm run preview

npm run content:validate (Ajv validate JSON against schemas)

npm run content:compile (emit bundle)

npm test

Itch pipeline:

npm run build produces dist/ suitable for static hosting

Zip the dist/ contents with index.html at root for itch HTML upload

17) Codex workflow spec (how Codex should operate)
17.1 Lanes

Planner: writes tasks and acceptance criteria, no code.

Builder: implements code and content, must keep tests passing.

Verifier: runs tests, adds missing tests, checks determinism.

Content Writer: adds jobs/tools/events via JSON only, must pass schema validation.

Reviewer: checks tone bible compliance, no mean jokes.

17.2 Definition of done

A task is done only if:

Tests pass

content:validate passes

Build passes

New content has humor lines filled

17.3 Safety rails

No gameplay logic embedded in UI components.

All randomness goes through seeded RNG.

All content edits are schema-validated.

18) MVP milestone checklist (ship to itch)

MVP shipping criteria:

Start new run, play 30 days without crash

Save/continue works

2 bots compete and affect contract availability

At least 1 crew unlock and assignment works

End-of-day report is readable and funny

Zip uploads and runs on itch as HTML5

19) Optional Phase 2 and 3 notes (do not build yet)
Android wrapper

Convert to PWA and wrap via TWA, verify via Digital Asset Links

Steam

Desktop wrapper plus SteamPipe build upload

Async multiplayer later (if you want)

Use anonymous auth to avoid account friction

Server-side resolution in Cloud Functions

Contract claiming via Firestore transactions

Optional scheduled ticks

20) Starter content requirements (Codex must generate)

Deliver with the initial repo:

10 tools

30 jobs

12 events

2 bots

3 districts
All with full flavor lines (dry + wholesome).