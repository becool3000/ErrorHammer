import fs from "node:fs";
import path from "node:path";

type Finding = {
  file: string;
  line: number;
  label: string;
  text: string;
};

const canonicalRoots = ["README.md", "docs"];
const disallowedPatterns: Array<{ label: string; regex: RegExp }> = [
  { label: "retired lane", regex: /\bTestWriter\b/ },
  { label: "retired lane", regex: /\bDocumenter\b/ },
  { label: "retired commit tag", regex: /\[Planner\]/ },
  { label: "retired commit tag", regex: /\[Builder\]/ },
  { label: "retired commit tag", regex: /\[TestWriter\]/ },
  { label: "retired commit tag", regex: /\[Verifier\]/ },
  { label: "retired commit tag", regex: /\[Documenter\]/ },
];

function collectMarkdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return root.endsWith(".md") ? [root] : [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, index) => {
    for (const pattern of disallowedPatterns) {
      if (pattern.regex.test(lineText)) {
        findings.push({
          file,
          line: index + 1,
          label: pattern.label,
          text: lineText.trim(),
        });
      }
    }
  });
  return findings;
}

const markdownFiles = canonicalRoots.flatMap(collectMarkdownFiles);
const findings = markdownFiles.flatMap(scanFile);

if (findings.length > 0) {
  console.error(
    `[docs:check] Found ${findings.length} disallowed reference(s) in canonical docs:`,
  );
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} (${finding.label}) ${finding.text}`,
    );
  }
  process.exit(1);
}

console.log(
  `[docs:check] PASS canonical docs (${markdownFiles.length} markdown files) contain only active lane/tag references.`,
);
