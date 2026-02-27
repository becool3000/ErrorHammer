export type Outcome = "success" | "fail" | "neutral" | "lost";

export interface ToolDef {
  id: string;
  name: string;
  tier: number;
  price: number;
  maxDurability: number;
  tags: string[];
  flavor: {
    description: string;
    quip_buy: string;
    quip_break: string;
  };
}

export interface JobDef {
  id: string;
  name: string;
  tier: number;
  districtId: string;
  requiredTools: string[];
  staminaCost: number;
  basePayout: number;
  risk: number;
  repGainSuccess: number;
  repLossFail: number;
  durabilityCost: number;
  tags: string[];
  flavor: {
    client_quote: string;
    success_line: string;
    fail_line: string;
    neutral_line: string;
  };
}

export interface EventDef {
  id: string;
  name: string;
  weight: number;
  mods: {
    payoutMultByTag?: Record<string, number>;
    riskDeltaByTag?: Record<string, number>;
    forceNeutralTags?: string[];
    toolPriceMult?: number;
  };
  flavor: {
    headline: string;
    detail: string;
    impact_line: string;
    success_line: string;
    fail_line: string;
    neutral_line: string;
  };
}

export interface DistrictDef {
  id: string;
  name: string;
  tier: number;
  flavor: {
    description: string;
  };
}

export interface BotProfile {
  id: string;
  name: string;
  weights: {
    wCash: number;
    wRep: number;
    wRiskAvoid: number;
    wToolBuy: number;
  };
  flavorLines: string[];
}

export interface StringsDef {
  title: string;
  subtitle: string;
  continueMissing: string;
  dayReportTitle: string;
  storeTitle: string;
  companyTitle: string;
  assignmentHint: string;
  noContracts: string;
  neutralLogFallback: string;
}

export interface ToolInstance {
  toolId: string;
  durability: number;
}

export interface CrewState {
  crewId: string;
  name: string;
  staminaMax: number;
  stamina: number;
  efficiency: number;
  reliability: number;
  morale: number;
}

export interface ActorState {
  actorId: string;
  name: string;
  cash: number;
  reputation: number;
  companyLevel: number;
  districtUnlocks: string[];
  staminaMax: number;
  stamina: number;
  tools: Record<string, ToolInstance>;
  crews: CrewState[];
}

export interface ContractInstance {
  contractId: string;
  jobId: string;
  districtId: string;
  payoutMult: number;
  expiresDay: number;
  claimedByActorId?: string;
}

export interface AssignmentIntent {
  assignee: "self" | string;
  contractId: string;
}

export interface Intent {
  actorId: string;
  day: number;
  assignments: AssignmentIntent[];
}

export interface Resolution {
  day: number;
  actorId: string;
  contractId: string;
  outcome: Outcome;
  winnerActorId?: string;
  cashDelta: number;
  repDelta: number;
  staminaBefore: number;
  staminaAfter: number;
  toolDurabilityBefore: Record<string, number>;
  toolDurabilityAfter: Record<string, number>;
  logLine: string;
}

export interface DayLog {
  day: number;
  actorId: string;
  contractId?: string;
  message: string;
}

export interface GameState {
  day: number;
  seed: number;
  player: ActorState;
  bots: ActorState[];
  contractBoard: ContractInstance[];
  activeEventIds: string[];
  log: DayLog[];
}

export interface ContentBundle {
  tools: ToolDef[];
  jobs: JobDef[];
  events: EventDef[];
  districts: DistrictDef[];
  bots: BotProfile[];
  strings: StringsDef;
}

export interface ResolverResult {
  nextState: GameState;
  resolutions: Resolution[];
  dayLog: DayLog[];
  digest: string;
}

export interface DayContext {
  events: EventDef[];
  daySeed: number;
}
