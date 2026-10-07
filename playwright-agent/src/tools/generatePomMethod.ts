export interface PomMethodInput {
  action: string;
  locatorName?: string;
  locatorExpression?: string;
  pageName?: string;
}

export interface PomMethodOutput {
  methodName: string;
  locatorName: string;
  code: string;
}

function toMethodName(action: string): string {
  const words = action
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "performAction";
  }

  const [first, ...rest] = words;
  const camel =
    first.toLowerCase() +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");

  if (/^click/i.test(action)) {
    return camel.startsWith("click") ? camel : `click${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }
  if (/^enter|^fill|^type/i.test(action)) {
    return camel.startsWith("enter") ? camel : `enter${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }
  if (/^select/i.test(action)) {
    return camel.startsWith("select") ? camel : `select${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }
  if (/^verify/i.test(action)) {
    return camel.startsWith("verify") ? camel : `verify${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }

  return camel;
}

function toLocatorName(action: string, explicit?: string): string {
  if (explicit) {
    return explicit;
  }

  const methodName = toMethodName(action);
  return methodName
    .replace(/^click/, "")
    .replace(/^enter/, "")
    .replace(/^select/, "")
    .replace(/^verify/, "")
    .replace(/^[A-Z]/, (c) => c.toLowerCase()) +
    (methodName.startsWith("click") ? "Button" : methodName.startsWith("enter") ? "Input" : "Element");
}

function inferMethodBody(
  action: string,
  locatorName: string,
  locatorExpression?: string,
): string {
  const locator = locatorExpression ?? `this.${locatorName}`;
  const lower = action.toLowerCase();

  if (lower.includes("fill") || lower.includes("enter") || lower.includes("type")) {
  const paramName = lower.includes("email")
    ? "email"
    : lower.includes("password")
      ? "password"
      : lower.includes("name")
        ? "name"
        : "value";
    return `async enter${locatorName.charAt(0).toUpperCase()}${locatorName.slice(1).replace(/Input$/, "")}(${paramName}: string): Promise<void> {
    await this.${locatorName}.fill(${paramName});
  }`;
  }

  if (lower.includes("select")) {
    return `async select${locatorName.charAt(0).toUpperCase()}${locatorName.slice(1).replace(/Dropdown$|Element$/, "")}(option: string): Promise<void> {
    await this.${locatorName}.click();
    await this.page.getByText(option, { exact: true }).click();
  }`;
  }

  if (lower.includes("verify")) {
    return `async verify${locatorName.charAt(0).toUpperCase()}${locatorName.slice(1).replace(/Element$/, "")}Displayed(): Promise<void> {
    await this.waitForVisible(${locator});
  }`;
  }

  return `async ${toMethodName(action)}(): Promise<void> {
    await ${locator}.click();
  }`;
}

export function generatePomMethod(input: PomMethodInput): PomMethodOutput {
  const methodName = toMethodName(input.action);
  const locatorName = toLocatorName(input.action, input.locatorName);
  const locatorExpression = input.locatorExpression
    ? `this.${locatorName}`
    : undefined;

  const methodBody = inferMethodBody(input.action, locatorName, locatorExpression);

  const locatorDeclaration = input.locatorExpression
    ? `private readonly ${locatorName}: Locator = ${input.locatorExpression.replace(/^this\./, "this.page.")};`
    : `private readonly ${locatorName}: Locator = this.page.getByRole("button", { name: "TODO" });`;

  const code = [
    "// Add to Page Elements section:",
    locatorDeclaration,
    "",
    "// Add to methods section:",
    methodBody,
  ].join("\n");

  return { methodName, locatorName, code };
}
