import { findPageByName } from "../utils/pageParser";

export interface SearchMethodResult {
  exists: boolean;
  pageName?: string;
  methodName: string;
  similarMethods: string[];
  message: string;
}

export function searchMethod(
  pageName: string,
  methodName: string,
): SearchMethodResult {
  const page = findPageByName(pageName);

  if (!page) {
    return {
      exists: false,
      methodName,
      similarMethods: [],
      message: `Page '${pageName}' not found.`,
    };
  }

  const exists = page.methods.includes(methodName);
  const normalized = methodName.toLowerCase();
  const similarMethods = page.methods.filter(
    (method) =>
      method.toLowerCase().includes(normalized) ||
      normalized.includes(method.toLowerCase()),
  );

  return {
    exists,
    pageName: page.className,
    methodName,
    similarMethods: exists ? [] : similarMethods.slice(0, 8),
    message: exists
      ? `Method '${methodName}' exists on ${page.className}.`
      : `Method '${methodName}' does not exist on ${page.className}.${
          similarMethods.length
            ? ` Similar: ${similarMethods.join(", ")}`
            : ""
        }`,
  };
}

export function listMethods(pageName: string): string {
  const page = findPageByName(pageName);

  if (!page) {
    return `Page '${pageName}' not found.`;
  }

  const lines = [
    `${page.className} methods (${page.methods.length}):`,
  ];

  for (const method of page.methods.sort()) {
    lines.push(`  - ${method}`);
  }

  return lines.join("\n");
}
