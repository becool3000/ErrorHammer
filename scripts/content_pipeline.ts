import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { ContentBundle } from "../src/core/types";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(scriptDir, "..");

const CONTENT_FILES = {
  tools: "tools.json",
  jobs: "jobs.json",
  events: "events.json",
  districts: "districts.json",
  bots: "bots.json",
  strings: "strings.json"
} as const;

const SCHEMA_FILES = {
  tools: "tools.schema.json",
  jobs: "jobs.schema.json",
  events: "events.schema.json",
  districts: "districts.schema.json",
  bots: "bots.schema.json",
  strings: "strings.schema.json"
} as const;

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

  const bundle = content as unknown as ContentBundle;
  errors.push(...crossValidate(bundle));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    bundle: normalizeBundle(bundle)
  };
}

export function normalizeBundle(bundle: ContentBundle): ContentBundle {
  const sortById = <T extends { id: string }>(items: T[]): T[] => [...items].sort((a, b) => a.id.localeCompare(b.id));

  return {
    tools: sortById(bundle.tools).map((tool) => ({
      ...tool,
      tags: [...tool.tags].sort((a, b) => a.localeCompare(b))
    })),
    jobs: sortById(bundle.jobs).map((job) => ({
      ...job,
      requiredTools: [...job.requiredTools].sort((a, b) => a.localeCompare(b)),
      tags: [...job.tags].sort((a, b) => a.localeCompare(b))
    })),
    events: sortById(bundle.events).map((event) => ({
      ...event,
      mods: {
        ...event.mods,
        forceNeutralTags: [...(event.mods.forceNeutralTags ?? [])].sort((a, b) => a.localeCompare(b))
      }
    })),
    districts: sortById(bundle.districts),
    bots: sortById(bundle.bots),
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

  const toolIds = new Set(bundle.tools.map((tool) => tool.id));
  const districtIds = new Set(bundle.districts.map((district) => district.id));

  for (const job of bundle.jobs) {
    if (!districtIds.has(job.districtId)) {
      errors.push(`jobs/${job.id}: unknown districtId '${job.districtId}'`);
    }

    for (const toolId of job.requiredTools) {
      if (!toolIds.has(toolId)) {
        errors.push(`jobs/${job.id}: unknown requiredTool '${toolId}'`);
      }
    }
  }

  return errors;
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
