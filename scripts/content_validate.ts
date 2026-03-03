import { loadAndValidateContent } from "./content_pipeline";

const result = await loadAndValidateContent();

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`[content:validate] ${error}`);
  }
  process.exit(1);
}

const bundle = result.bundle!;
console.log(
  `[content:validate] OK tools=${bundle.tools.length} jobs=${bundle.jobs.length} babaJobs=${bundle.babaJobs.length} events=${bundle.events.length} districts=${bundle.districts.length} bots=${bundle.bots.length} supplies=${bundle.supplies.length}`
);
