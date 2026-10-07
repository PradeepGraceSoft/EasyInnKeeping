import { findPageByName } from "../utils/pageParser";

export interface FindPageResult {
  found: boolean;
  className?: string;
  filePath?: string;
  methodCount?: number;
  message: string;
}

export function findPageClass(pageName: string): FindPageResult {
  const page = findPageByName(pageName);

  if (!page) {
    return {
      found: false,
      message: `No page class found for '${pageName}'. Available pages are in src/pages/.`,
    };
  }

  return {
    found: true,
    className: page.className,
    filePath: `src/pages/${page.relativePath}`,
    methodCount: page.methods.length,
    message: `Found ${page.className} at src/pages/${page.relativePath} (${page.methods.length} methods)`,
  };
}
