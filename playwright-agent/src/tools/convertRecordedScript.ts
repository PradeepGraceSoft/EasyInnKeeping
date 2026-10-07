import { findPageByName, methodExists } from "../utils/pageParser";
import { generatePomMethod } from "./generatePomMethod";

export interface RecordedStep {
  raw: string;
  action: "click" | "fill" | "press" | "select" | "navigate" | "other";
  locatorExpression: string;
  value?: string;
  suggestedMethodName: string;
  existingMethod?: string;
  pageHint?: string;
}

export interface ConvertScriptResult {
  steps: RecordedStep[];
  suggestedPage: string;
  newMethods: string[];
  reusedMethods: string[];
  testBody: string;
  pomAdditions: string;
}

const PAGE_HINTS: Array<{ pattern: RegExp; page: string }> = [
  { pattern: /reservation|save|guest|room|booking/i, page: "ReservationPage" },
  { pattern: /login|verify|sso|password|credential/i, page: "SSOLoginPage" },
  { pattern: /calendar|new reservation/i, page: "CalendarPage" },
  { pattern: /find|search|shared|regular|hourly/i, page: "FindReservationPage" },
  { pattern: /list|report|setup|hamburger|menu/i, page: "LayoutPage" },
];

function inferPageHint(script: string): string {
  for (const hint of PAGE_HINTS) {
    if (hint.pattern.test(script)) {
      return hint.page;
    }
  }
  return "ReservationPage";
}

function parseLine(line: string): RecordedStep | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("import ")) {
    return null;
  }

  const awaitMatch = trimmed.match(/await\s+(.+);$/);
  const expression = awaitMatch?.[1] ?? trimmed.replace(/;$/, "");

  if (expression.includes("goto(")) {
    return {
      raw: trimmed,
      action: "navigate",
      locatorExpression: expression,
      suggestedMethodName: "navigate",
    };
  }

  const fillMatch = expression.match(/(?:page|this\.page)\.(.*?)\.fill\((.+)\)/);
  if (fillMatch) {
    const locatorExpression = fillMatch[1];
    const value = fillMatch[2];
    const field = locatorExpression.includes("Name")
      ? "Name"
      : locatorExpression.includes("email")
        ? "Email"
        : "Field";
    return {
      raw: trimmed,
      action: "fill",
      locatorExpression,
      value,
      suggestedMethodName: `enter${field}`,
    };
  }

  const clickMatch = expression.match(/(?:page|this\.page)\.(.*?)\.click\(\)/);
  if (clickMatch) {
    const locatorExpression = clickMatch[1];
    const nameMatch = locatorExpression.match(/name:\s*['"]([^'"]+)['"]/);
    const label = nameMatch?.[1] ?? "Element";
    const methodName = `click${label.replace(/[^a-zA-Z0-9]/g, "")}`;
    return {
      raw: trimmed,
      action: "click",
      locatorExpression,
      suggestedMethodName: methodName,
    };
  }

  const pressMatch = expression.match(/(?:page|this\.page)\.(.*?)\.press\((.+)\)/);
  if (pressMatch) {
    return {
      raw: trimmed,
      action: "press",
      locatorExpression: pressMatch[1],
      value: pressMatch[2],
      suggestedMethodName: "pressKey",
    };
  }

  return {
    raw: trimmed,
    action: "other",
    locatorExpression: expression,
    suggestedMethodName: "performAction",
  };
}

function findExistingMethod(pageName: string, step: RecordedStep): string | undefined {
  const page = findPageByName(pageName);
  if (!page) {
    return undefined;
  }

  const exact = page.methods.find(
    (method) => method.toLowerCase() === step.suggestedMethodName.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  if (step.action === "click") {
    return page.methods.find((method) => method.toLowerCase().includes("click"));
  }
  if (step.action === "fill") {
    return page.methods.find((method) =>
      method.toLowerCase().startsWith("enter"),
    );
  }

  return undefined;
}

function toFixtureCall(pageName: string, methodName: string): string {
  const fixtureMap: Record<string, string> = {
    ReservationPage: "reservationPage",
    SSOLoginPage: "ssoLoginPage",
    FindReservationPage: "findReservationPage",
    LayoutPage: "layoutPage",
    CalendarPage: "calendarPage",
  };
  const fixture = fixtureMap[pageName] ?? "page";
  return `await ${fixture}.${methodName}(${stepNeedsArgs(methodName) ? "/* value */" : ""});`;
}

function stepNeedsArgs(methodName: string): boolean {
  return (
    methodName.startsWith("enter") ||
    methodName.startsWith("select") ||
    methodName.includes("Payment")
  );
}

export function convertRecordedScript(
  script: string,
  pageName?: string,
): ConvertScriptResult {
  const suggestedPage = pageName ?? inferPageHint(script);
  const lines = script.split("\n");
  const steps = lines
    .map(parseLine)
    .filter((step): step is RecordedStep => step !== null);

  const reusedMethods: string[] = [];
  const newMethods: string[] = [];
  const testLines: string[] = [];
  const pomBlocks: string[] = [];

  for (const step of steps) {
    const existing = findExistingMethod(suggestedPage, step);
    if (existing && methodExists(suggestedPage, existing)) {
      step.existingMethod = existing;
      reusedMethods.push(existing);
      testLines.push(toFixtureCall(suggestedPage, existing));
      continue;
    }

    const generated = generatePomMethod({
      action: step.suggestedMethodName,
      locatorExpression: `this.page.${step.locatorExpression}`,
      pageName: suggestedPage,
    });

    if (!newMethods.includes(generated.methodName)) {
      newMethods.push(generated.methodName);
      pomBlocks.push(generated.code);
    }

    testLines.push(toFixtureCall(suggestedPage, generated.methodName));
  }

  return {
    steps,
    suggestedPage,
    newMethods,
    reusedMethods: [...new Set(reusedMethods)],
    testBody: testLines.join("\n"),
    pomAdditions: pomBlocks.join("\n\n"),
  };
}
