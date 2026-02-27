import { loadAndValidateContent, writeBundle } from "./content_pipeline";

const result = await loadAndValidateContent();

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`[content:compile] ${error}`);
  }
  process.exit(1);
}

const output = await writeBundle(result.bundle!);
console.log(`[content:compile] wrote ${output}`);