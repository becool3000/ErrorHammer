import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { ContentBundle, DistrictDef, JobDef, JobMaterialNeed } from "../src/core/types";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(scriptDir, "..");

const CONTENT_FILES = {
  tools: "tools.json",
  jobs: "jobs.json",
  events: "events.json",
  districts: "districts.json",
  bots: "bots.json",
  supplies: "supplies.json",
  strings: "strings.json"
} as const;

const SCHEMA_FILES = {
  tools: "tools.schema.json",
  jobs: "jobs.schema.json",
  events: "events.schema.json",
  districts: "districts.schema.json",
  bots: "bots.schema.json",
  supplies: "supplies.schema.json",
  strings: "strings.schema.json"
} as const;

const SUPPLY_GROUPS: Array<{ match: string[]; supplyIds: [string, string] }> = [
  { match: ["electrical"], supplyIds: ["wire-spool", "junction-box"] },
  { match: ["plumbing"], supplyIds: ["pipe-kit", "sealant-tube"] },
  { match: ["roof"], supplyIds: ["roof-patch", "fastener-box"] },
  { match: ["finish"], supplyIds: ["trim-kit", "paint-sleeve"] },
  { match: ["framing"], supplyIds: ["board-pack", "fastener-box"] },
  { match: ["mechanical"], supplyIds: ["hinge-pack", "fastener-box"] },
  { match: ["seal"], supplyIds: ["sealant-tube", "anchor-set"] },
  { match: ["inspection"], supplyIds: ["anchor-set", "safety-kit"] }
];

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
    jobs: sortById(bundle.jobs).map((job) => normalizeJob(job as Partial<JobDef>, normalizedSupplies.map((supply) => supply.id))),
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
  ensureUniqueIds(bundle.events, "events", errors);
  ensureUniqueIds(bundle.districts, "districts", errors);
  ensureUniqueIds(bundle.bots, "bots", errors);
  ensureUniqueIds(bundle.supplies, "supplies", errors);

  if (bundle.tools.length < 10) {
    errors.push("tools: minimum 10 entries required");
  }
  if (bundle.jobs.length < 30) {
    errors.push("jobs: minimum 30 entries required");
  }
  if (bundle.events.length < 12) {
    errors.push("events: minimum 12 entries required");
  }
  if (bundle.districts.length < 3) {
    errors.push("districts: minimum 3 entries required");
  }
  if (bundle.bots.length < 2) {
    errors.push("bots: minimum 2 entries required");
  }
  if (bundle.supplies.length < 12) {
    errors.push("supplies: minimum 12 entries required");
  }

  const toolIds = new Set(bundle.tools.map((tool) => tool.id));
  const districtIds = new Set(bundle.districts.map((district) => district.id));
  const supplyIds = new Set(bundle.supplies.map((supply) => supply.id));

  for (const job of bundle.jobs) {
    if (!districtIds.has(job.districtId)) {
      errors.push(`jobs/${job.id}: unknown districtId '${job.districtId}'`);
    }

    if (job.workUnits < 1) {
      errors.push(`jobs/${job.id}: workUnits must be >= 1`);
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

function normalizeJob(job: Partial<JobDef>, availableSupplyIds: string[]): JobDef {
  const tags = [...(job.tags ?? [])].sort((a, b) => a.localeCompare(b));
  const requiredTools = [...(job.requiredTools ?? [])].sort((a, b) => a.localeCompare(b));
  const workUnits = job.workUnits ?? deriveWorkUnits(job);
  const materialNeeds = normalizeMaterialNeeds(job.materialNeeds, availableSupplyIds, {
    tags,
    requiredTools,
    tier: job.tier ?? 1,
    workUnits
  });

  return {
    id: job.id ?? "unknown-job",
    name: job.name ?? "Unknown Job",
    tier: job.tier ?? 1,
    districtId: job.districtId ?? "residential",
    requiredTools,
    staminaCost: job.staminaCost ?? 2,
    basePayout: job.basePayout ?? 100,
    risk: job.risk ?? 0.15,
    repGainSuccess: job.repGainSuccess ?? 2,
    repLossFail: job.repLossFail ?? 1,
    durabilityCost: job.durabilityCost ?? 2,
    workUnits,
    materialNeeds,
    tags,
    flavor: {
      client_quote: job.flavor?.client_quote ?? "Please keep the building in one mood.",
      success_line: job.flavor?.success_line ?? "The work no longer looks theoretical.",
      fail_line: job.flavor?.fail_line ?? "The work remains a conversation piece.",
      neutral_line: job.flavor?.neutral_line ?? "The work happened in a technically observable way."
    }
  };
}

function normalizeMaterialNeeds(
  materialNeeds: JobMaterialNeed[] | undefined,
  availableSupplyIds: string[],
  context: { tags: string[]; requiredTools: string[]; tier: number; workUnits: number }
): JobMaterialNeed[] {
  if (Array.isArray(materialNeeds) && materialNeeds.length > 0) {
    return materialNeeds
      .map((material) => ({
        supplyId: material.supplyId,
        quantity: Math.max(1, material.quantity)
      }))
      .sort((a, b) => a.supplyId.localeCompare(b.supplyId));
  }

  const derived = deriveMaterialNeeds(context.tags, context.requiredTools, context.tier, context.workUnits);
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

function deriveMaterialNeeds(tags: string[], requiredTools: string[], tier: number, workUnits: number): JobMaterialNeed[] {
  const matched = SUPPLY_GROUPS.find((group) => group.match.some((tag) => tags.includes(tag)));
  const [primaryId, secondaryId] = matched?.supplyIds ?? ["anchor-set", "fastener-box"];
  const primaryQuantity = clamp(Math.ceil(workUnits / 2), 1, 6);
  const secondaryQuantity = clamp(tier + Math.max(0, requiredTools.length - 1), 1, 5);
  return [
    { supplyId: primaryId, quantity: primaryQuantity },
    { supplyId: secondaryId, quantity: secondaryQuantity }
  ];
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
