import fs from "fs";
import path from "path";
import { PATHS } from "./projectPaths";

export interface PageInfo {
  className: string;
  filePath: string;
  relativePath: string;
  methods: string[];
  locators: string[];
}

function readPageFiles(): string[] {
  if (!fs.existsSync(PATHS.pages)) {
    return [];
  }

  return fs
    .readdirSync(PATHS.pages)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => path.join(PATHS.pages, file));
}

export function listPages(): PageInfo[] {
  return readPageFiles().map(parsePageFile);
}

export function findPageByName(pageName: string): PageInfo | null {
  const normalized = pageName.replace(/\.ts$/, "").replace(/Page$/, "");
  const candidates = listPages();

  const match = candidates.find((page) => {
    const baseName = path.basename(page.filePath, ".ts");
    return (
      baseName.toLowerCase() === `${normalized}page`.toLowerCase() ||
      baseName.toLowerCase() === normalized.toLowerCase() ||
      page.className.toLowerCase() === pageName.toLowerCase()
    );
  });

  return match ?? null;
}

export function parsePageFile(filePath: string): PageInfo {
  const content = fs.readFileSync(filePath, "utf-8");
  const classMatch = content.match(/export class (\w+)/);
  const className = classMatch?.[1] ?? path.basename(filePath, ".ts");

  const methods = [
    ...content.matchAll(/async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise</g),
  ].map((match) => match[1]);

  const locators = [
    ...content.matchAll(/private readonly (\w+)\s*:\s*Locator/g),
  ].map((match) => match[1]);

  return {
    className,
    filePath,
    relativePath: path.relative(PATHS.pages, filePath).replace(/\\/g, "/"),
    methods: [...new Set(methods)],
    locators: [...new Set(locators)],
  };
}

export function readPageContent(pageName: string): string | null {
  const page = findPageByName(pageName);
  if (!page) {
    return null;
  }
  return fs.readFileSync(page.filePath, "utf-8");
}

export function methodExists(pageName: string, methodName: string): boolean {
  const page = findPageByName(pageName);
  if (!page) {
    return false;
  }
  return page.methods.includes(methodName);
}
