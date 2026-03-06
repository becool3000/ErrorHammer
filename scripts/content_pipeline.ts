import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { ContentBundle, DistrictDef, JobDef, JobMaterialNeed, SkillId, TRADE_SKILLS } from "../src/core/types";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(scriptDir, "..");

const CONTENT_FILES = {
  tools: "tools.json",
  jobs: "jobs.json",
  babaJobs: "baba_jobs.json",
  events: "events.json",
  districts: "districts.json",
  bots: "bots.json",
  supplies: "supplies.json",
  strings: "strings.json"
} as const;

const SCHEMA_FILES = {
  tools: "tools.schema.json",
  jobs: "jobs.schema.json",
  babaJobs: "baba_jobs.schema.json",
  events: "events.schema.json",
  districts: "districts.schema.json",
  bots: "bots.schema.json",
  supplies: "supplies.schema.json",
  strings: "strings.schema.json"
} as const;

const LEGACY_FIVE_JOB_SKILLS: SkillId[] = [
  "electrician",
  "plumber",
  "carpenter",
  "mason",
  "concrete_finisher",
  "roofer",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "glazier",
  "insulation_installer",
  "framer",
  "siding_installer",
  "fence_installer",
  "cabinet_maker",
  "millworker",
  "scaffolder",
  "solar_panel_installer"
];

const CORE_TRADE_TRACKS = [
  "carpenter",
  "roofer",
  "landscaper",
  "welder",
  "electrician",
  "plumber",
  "hvac_technician",
  "drywall_installer",
  "painter",
  "flooring_installer",
  "finish_carpentry"
] as const;

const SUPPLY_GROUPS: Partial<Record<SkillId, [string, string]>> = {
  electrician: ["wire-spool", "breaker-kit"],
  plumber: ["pipe-kit", "valve-pack"],
  carpenter: ["board-pack", "fastener-box"],
  mason: ["mortar-mix", "brick-pack"],
  concrete_finisher: ["concrete-mix", "rebar-bundle"],
  roofer: ["roof-shingle-bundle", "roof-flashing-kit"],
  hvac_technician: ["duct-kit", "filter-pack"],
  drywall_installer: ["drywall-sheet-stack", "joint-compound-bucket"],
  painter: ["paint-bucket", "roller-pack"],
  flooring_installer: ["tile-box", "underlayment-roll"],
  glazier: ["glass-panel-crate", "glazing-sealant-tube"],
  insulation_installer: ["insulation-batt-pack", "vapor-barrier-roll"],
  framer: ["stud-bundle", "fastener-box"],
  siding_installer: ["siding-panel-pack", "trim-kit"],
  fence_installer: ["fence-panel-pack", "post-anchor-kit"],
  cabinet_maker: ["cabinet-panel-pack", "hinge-pack"],
  millworker: ["millwork-trim-kit", "fastener-box"],
  scaffolder: ["scaffold-coupler-pack", "anchor-set"],
  solar_panel_installer: ["solar-rack-kit", "wire-spool"],
  heavy_equipment_operator: ["anchor-set", "rebar-bundle"],
  demolition_specialist: ["anchor-set", "fastener-box"],
  low_voltage_data_tech: ["wire-spool", "breaker-kit"],
  lineman: ["wire-spool", "breaker-kit"],
  pipefitter: ["pipe-kit", "valve-pack"],
  steamfitter: ["pipe-kit", "valve-pack"],
  sprinkler_fitter: ["pipe-kit", "valve-pack"],
  gas_fitter: ["pipe-kit", "valve-pack"],
  refrigeration_technician: ["duct-kit", "filter-pack"],
  boiler_technician: ["duct-kit", "filter-pack"],
  sheet_metal_worker: ["duct-kit", "fastener-box"],
  welder: ["rebar-bundle", "anchor-set"],
  metal_fabricator: ["rebar-bundle", "anchor-set"],
  machinist: ["trim-kit", "fastener-box"],
  cnc_operator: ["trim-kit", "fastener-box"],
  blacksmith: ["rebar-bundle", "anchor-set"],
  auto_mechanic: ["filter-pack", "valve-pack"],
  diesel_mechanic: ["filter-pack", "valve-pack"],
  small_engine_repair: ["filter-pack", "valve-pack"],
  motorcycle_technician: ["filter-pack", "valve-pack"],
  aircraft_mechanic: ["filter-pack", "valve-pack"],
  landscaper: ["post-anchor-kit", "fence-panel-pack"],
  arborist: ["post-anchor-kit", "fence-panel-pack"],
  irrigation_technician: ["pipe-kit", "valve-pack"],
  well_driller: ["pipe-kit", "rebar-bundle"],
  industrial_maintenance: ["fastener-box", "anchor-set"],
  millwright: ["fastener-box", "anchor-set"],
  elevator_technician: ["wire-spool", "anchor-set"],
  robotics_technician: ["wire-spool", "breaker-kit"],
  tile_setter: ["tile-box", "underlayment-roll"],
  upholsterer: ["trim-kit", "paint-bucket"]
};

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  bundle?: ContentBundle;
}

export async function loadRawContent(root = PROJECT_ROOT): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(CONTENT_FILES).map(async ([key, filename]) => {
      const fullPath = path.join(root, "content", filename);
      return [key, await readJson(fullPath)] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function loadSchemas(root = PROJECT_ROOT): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(SCHEMA_FILES).map(async ([key, filename]) => {
      const fullPath = path.join(root, "schemas", filename);
      return [key, await readJson(fullPath)] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function loadAndValidateContent(root = PROJECT_ROOT): Promise<ValidationResult> {
  const [content, schemas] = await Promise.all([loadRawContent(root), loadSchemas(root)]);
  return validateContent(content, schemas);
}

export function validateContent(content: Record<string, unknown>, schemas: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  for (const key of Object.keys(CONTENT_FILES)) {
    const schema = schemas[key];
    if (!schema) {
      errors.push(`Missing schema: ${key}`);
      continue;
    }

    const validate = ajv.compile(schema);
    const valid = validate(content[key]);
    if (!valid) {
      const text = ajv.errorsText(validate.errors, { separator: "; " });
      errors.push(`${key}: ${text}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const bundle = normalizeBundle(content as unknown as ContentBundle);
  errors.push(...crossValidate(bundle));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    bundle
  };
}

export function normalizeBundle(bundle: ContentBundle): ContentBundle {
  const sortById = <T extends { id: string }>(items: T[]): T[] => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const availableSupplyIds = sortById(bundle.supplies ?? []).map((supply) => supply.id);
  const normalizedSupplies = sortById(bundle.supplies ?? []).map((supply) => ({
    ...supply,
    prices: {
      low: supply.prices.low,
      medium: supply.prices.medium,
      high: supply.prices.high
    },
    tags: [...supply.tags].sort((a, b) => a.localeCompare(b))
  }));

  return {
    tools: sortById(bundle.tools).map((tool) => ({
      ...tool,
      tags: [...tool.tags].sort((a, b) => a.localeCompare(b))
    })),
    jobs: sortById(bundle.jobs).map((job) => normalizeJob(job as Partial<JobDef>, availableSupplyIds, false)),
    babaJobs: sortById(bundle.babaJobs ?? []).map((job) => normalizeJob(job as Partial<JobDef>, availableSupplyIds, true)),
    events: sortById(bundle.events).map((event) => ({
      ...event,
      mods: {
        ...event.mods,
        forceNeutralTags: [...(event.mods.forceNeutralTags ?? [])].sort((a, b) => a.localeCompare(b))
      }
    })),
    districts: sortById(bundle.districts).map((district) => normalizeDistrict(district as Partial<DistrictDef>)),
    bots: sortById(bundle.bots),
    supplies: normalizedSupplies,
    strings: { ...bundle.strings }
  };
}

export async function writeBundle(bundle: ContentBundle, root = PROJECT_ROOT): Promise<string> {
  const outputPath = path.join(root, "src", "generated", "content.bundle.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${stableStringify(bundle)}\n`, "utf8");
  return outputPath;
}

function crossValidate(bundle: ContentBundle): string[] {
  const errors: string[] = [];

  ensureUniqueIds(bundle.tools, "tools", errors);
  ensureUniqueIds(bundle.jobs, "jobs", errors);
  ensureUniqueIds(bundle.babaJobs, "babaJobs", errors);
  ensureUniqueIds(bundle.events, "events", errors);
  ensureUniqueIds(bundle.districts, "districts", errors);
  ensureUniqueIds(bundle.bots, "bots", errors);
  ensureUniqueIds(bundle.supplies, "supplies", errors);

  if (bundle.tools.length < 19) {
    errors.push("tools: minimum 19 entries required");
  }
  const expandedSkills = TRADE_SKILLS.filter((skillId) => !LEGACY_FIVE_JOB_SKILLS.includes(skillId));
  const expectedTradeJobs = LEGACY_FIVE_JOB_SKILLS.length * 5 + expandedSkills.length * 3;
  if (bundle.jobs.length !== expectedTradeJobs) {
    errors.push(`jobs: expected exactly ${expectedTradeJobs} trade jobs, got ${bundle.jobs.length}`);
  }
  if (bundle.babaJobs.length < 22) {
    errors.push(`babaJobs: minimum 22 entries required, got ${bundle.babaJobs.length}`);
  }
  if (bundle.events.length < 12) {
    errors.push("events: minimum 12 entries required");
  }
  if (bundle.districts.length < 3) {
    errors.push("districts: minimum 3 entries required");
  }
  if (bundle.bots.length !== 10) {
    errors.push(`bots: expected exactly 10 entries, got ${bundle.bots.length}`);
  }
  if (bundle.supplies.length < 12) {
    errors.push("supplies: minimum 12 entries required");
  }

  const toolIds = new Set(bundle.tools.map((tool) => tool.id));
  const districtIds = new Set(bundle.districts.map((district) => district.id));
  const supplyIds = new Set(bundle.supplies.map((supply) => supply.id));

  for (const job of bundle.jobs) {
    if (!TRADE_SKILLS.includes(job.primarySkill)) {
      errors.push(`jobs/${job.id}: unknown primarySkill '${job.primarySkill}'`);
    }
    if (!districtIds.has(job.districtId)) {
      errors.push(`jobs/${job.id}: unknown districtId '${job.districtId}'`);
    }

    if (job.workUnits < 1) {
      errors.push(`jobs/${job.id}: workUnits must be >= 1`);
    }
    if (job.trashUnits < 0) {
      errors.push(`jobs/${job.id}: trashUnits must be >= 0`);
    }

    for (const toolId of job.requiredTools) {
      if (!toolIds.has(toolId)) {
        errors.push(`jobs/${job.id}: unknown requiredTool '${toolId}'`);
      }
    }

    for (const material of job.materialNeeds) {
      if (!supplyIds.has(material.supplyId)) {
        errors.push(`jobs/${job.id}: unknown supply '${material.supplyId}'`);
      }
      if (material.quantity < 1) {
        errors.push(`jobs/${job.id}: supply '${material.supplyId}' quantity must be >= 1`);
      }
    }
  }

  const countsBySkill = new Map<SkillId, number>();
  for (const skill of TRADE_SKILLS) {
    countsBySkill.set(skill, 0);
  }
  for (const job of bundle.jobs) {
    countsBySkill.set(job.primarySkill, (countsBySkill.get(job.primarySkill) ?? 0) + 1);
  }
  for (const skill of TRADE_SKILLS) {
    const expectedCount = LEGACY_FIVE_JOB_SKILLS.includes(skill) ? 5 : 3;
    if ((countsBySkill.get(skill) ?? 0) !== expectedCount) {
      errors.push(`jobs: expected ${expectedCount} jobs for '${skill}', got ${countsBySkill.get(skill) ?? 0}`);
    }
  }

  for (const job of bundle.babaJobs) {
    if (!TRADE_SKILLS.includes(job.primarySkill)) {
      errors.push(`babaJobs/${job.id}: unknown primarySkill '${job.primarySkill}'`);
    }
    if (!job.tags.includes("baba-g")) {
      errors.push(`babaJobs/${job.id}: missing required 'baba-g' tag`);
    }
    if (!districtIds.has(job.districtId)) {
      errors.push(`babaJobs/${job.id}: unknown districtId '${job.districtId}'`);
    }
    if (job.trashUnits < 0) {
      errors.push(`babaJobs/${job.id}: trashUnits must be >= 0`);
    }
    for (const toolId of job.requiredTools) {
      if (!toolIds.has(toolId)) {
        errors.push(`babaJobs/${job.id}: unknown requiredTool '${toolId}'`);
      }
    }
    for (const material of job.materialNeeds) {
      if (!supplyIds.has(material.supplyId)) {
        errors.push(`babaJobs/${job.id}: unknown supply '${material.supplyId}'`);
      }
    }
  }

  const babaTrackCounts = new Map<(typeof CORE_TRADE_TRACKS)[number], number>();
  for (const track of CORE_TRADE_TRACKS) {
    babaTrackCounts.set(track, 0);
  }
  for (const job of bundle.babaJobs) {
    const track = mapSkillToCoreTrack(job.primarySkill);
    if (!track) {
      continue;
    }
    babaTrackCounts.set(track, (babaTrackCounts.get(track) ?? 0) + 1);
  }
  for (const track of CORE_TRADE_TRACKS) {
    if ((babaTrackCounts.get(track) ?? 0) < 2) {
      errors.push(`babaJobs: expected at least 2 jobs for core track '${track}', got ${babaTrackCounts.get(track) ?? 0}`);
    }
  }

  return errors;
}

function normalizeDistrict(district: Partial<DistrictDef>): DistrictDef {
  const tier = district.tier ?? 1;
  return {
    id: district.id ?? "unknown-district",
    name: district.name ?? "Unknown District",
    tier,
    travel: {
      shopToSiteTicks: district.travel?.shopToSiteTicks ?? tier + 1,
      shopToSiteFuel: district.travel?.shopToSiteFuel ?? Math.max(1, tier),
      supplierToSiteTicks: district.travel?.supplierToSiteTicks ?? tier + 1,
      supplierToSiteFuel: district.travel?.supplierToSiteFuel ?? Math.max(1, tier)
    },
    flavor: {
      description: district.flavor?.description ?? "A district with opinions and invoices."
    }
  };
}

function normalizeJob(job: Partial<JobDef>, availableSupplyIds: string[], isBaba: boolean): JobDef {
  const tags = [...(job.tags ?? [])].sort((a, b) => a.localeCompare(b));
  const requiredTools = [...(job.requiredTools ?? [])].sort((a, b) => a.localeCompare(b));
  const workUnits = job.workUnits ?? deriveWorkUnits(job);
  const primarySkill = (job.primarySkill ?? "carpenter") as SkillId;
  const materialNeeds = normalizeMaterialNeeds(job.materialNeeds, availableSupplyIds, {
    primarySkill,
    requiredTools,
    tier: job.tier ?? 1,
    workUnits
  });
  const normalizedTags = isBaba && !tags.includes("baba-g") ? [...tags, "baba-g"] : tags;
  const derivedTrashUnits = deriveTrashUnits(workUnits, job.tier ?? 1, isBaba);

  return {
    id: job.id ?? "unknown-job",
    name: job.name ?? "Unknown Job",
    primarySkill,
    tier: job.tier ?? 1,
    districtId: job.districtId ?? "residential",
    requiredTools,
    trashUnits: Math.max(0, Math.floor(job.trashUnits ?? derivedTrashUnits)),
    staminaCost: job.staminaCost ?? 2,
    basePayout: job.basePayout ?? 100,
    risk: job.risk ?? 0.15,
    repGainSuccess: job.repGainSuccess ?? 2,
    repLossFail: job.repLossFail ?? 1,
    durabilityCost: job.durabilityCost ?? 2,
    workUnits,
    materialNeeds,
    tags: normalizedTags,
    flavor: {
      client_quote: job.flavor?.client_quote ?? "Please keep the building in one mood.",
      success_line: job.flavor?.success_line ?? "The work no longer looks theoretical.",
      fail_line: job.flavor?.fail_line ?? "The work remains a conversation piece.",
      neutral_line: job.flavor?.neutral_line ?? "The work happened in a technically observable way."
    }
  };
}

function deriveTrashUnits(workUnits: number, tier: number, isBaba: boolean): number {
  const base = clamp(Math.ceil(workUnits * 0.75) + Math.max(0, tier - 1), 1, 12);
  if (isBaba) {
    return Math.max(4, base + 2);
  }
  return base;
}

function normalizeMaterialNeeds(
  materialNeeds: JobMaterialNeed[] | undefined,
  availableSupplyIds: string[],
  context: { primarySkill: SkillId; requiredTools: string[]; tier: number; workUnits: number }
): JobMaterialNeed[] {
  if (Array.isArray(materialNeeds) && materialNeeds.length > 0) {
    return materialNeeds
      .map((material) => ({
        supplyId: material.supplyId,
        quantity: Math.max(1, material.quantity)
      }))
      .sort((a, b) => a.supplyId.localeCompare(b.supplyId));
  }

  const derived = deriveMaterialNeeds(context.primarySkill, context.requiredTools, context.tier, context.workUnits);
  return derived
    .filter((material) => availableSupplyIds.includes(material.supplyId))
    .sort((a, b) => a.supplyId.localeCompare(b.supplyId));
}

function deriveWorkUnits(job: Partial<JobDef>): number {
  const tier = job.tier ?? 1;
  const payout = job.basePayout ?? 100;
  const toolLoad = job.requiredTools?.length ?? 1;
  return clamp(Math.ceil(payout / 70) + tier + toolLoad - 1, 4, 10);
}

function deriveMaterialNeeds(primarySkill: SkillId, requiredTools: string[], tier: number, workUnits: number): JobMaterialNeed[] {
  const [primaryId, secondaryId] = SUPPLY_GROUPS[primarySkill] ?? ["anchor-set", "fastener-box"];
  const primaryQuantity = clamp(Math.ceil(workUnits / 2), 1, 6);
  const secondaryQuantity = clamp(tier + Math.max(0, requiredTools.length - 1), 1, 5);
  return [
    { supplyId: primaryId, quantity: primaryQuantity },
    { supplyId: secondaryId, quantity: secondaryQuantity }
  ];
}

function mapSkillToCoreTrack(skillId: SkillId): (typeof CORE_TRADE_TRACKS)[number] | null {
  if (
    skillId === "carpenter" ||
    skillId === "roofer" ||
    skillId === "landscaper" ||
    skillId === "welder" ||
    skillId === "electrician" ||
    skillId === "plumber" ||
    skillId === "hvac_technician" ||
    skillId === "drywall_installer" ||
    skillId === "painter" ||
    skillId === "flooring_installer"
  ) {
    return skillId;
  }
  if (skillId === "cabinet_maker" || skillId === "millworker") {
    return "finish_carpentry";
  }
  return null;
}

function ensureUniqueIds<T extends { id: string }>(items: T[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      errors.push(`${label}: duplicate id '${item.id}'`);
    }
    seen.add(item.id);
  }
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]));
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
