import fs from "fs";
import path from "path";
import { PATHS } from "../utils/projectPaths";
import { listPages } from "../utils/pageParser";

export interface ProjectStructure {
  pages: Array<{ className: string; file: string; methodCount: number }>;
  fixtures: string[];
  tests: string[];
  constants: string[];
}

export function readProjectStructure(): ProjectStructure {
  const pages = listPages().map((page) => ({
    className: page.className,
    file: `src/pages/${page.relativePath}`,
    methodCount: page.methods.length,
  }));

  const listTsFiles = (dir: string): string[] => {
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir).filter((file) => file.endsWith(".ts"));
  };

  return {
    pages,
    fixtures: listTsFiles(PATHS.fixtures).map((f) => `src/fixtures/${f}`),
    tests: listTsFiles(PATHS.tests).map((f) => `tests/${f}`),
    constants: listTsFiles(PATHS.constants).map((f) => `src/constants/${f}`),
  };
}

export function formatProjectStructure(): string {
  const structure = readProjectStructure();
  const lines: string[] = ["EasyInnKeeping Playwright Project", ""];

  lines.push("Pages:");
  for (const page of structure.pages) {
    lines.push(`  - ${page.className} (${page.file}) — ${page.methodCount} methods`);
  }

  lines.push("", "Fixtures:");
  for (const fixture of structure.fixtures) {
    lines.push(`  - ${fixture}`);
  }

  lines.push("", "Tests:");
  for (const testFile of structure.tests) {
    lines.push(`  - ${testFile}`);
  }

  lines.push("", "Constants:");
  for (const constant of structure.constants) {
    lines.push(`  - ${constant}`);
  }

  return lines.join("\n");
}
