import fs from "fs";
import path from "path";
import { PATHS } from "../utils/projectPaths";
import { findPageClass } from "../tools/findPageClass";
import { listMethods, searchMethod } from "../tools/searchMethods";
import { formatProjectStructure } from "../tools/readProjectStructure";
import { generateTest, suggestAssertions } from "../tools/generateTest";
import { generatePomMethod } from "../tools/generatePomMethod";
import { convertRecordedScript } from "../tools/convertRecordedScript";
import {
  formatTemplateDetail,
  formatTemplateList,
  generateFromTemplate,
} from "../templates/testTemplates";

export interface AgentPlan {
  intent: string;
  steps: string[];
  outputs: string[];
}

export class PlaywrightAgent {
  plan(task: string): AgentPlan {
    const lower = task.toLowerCase();
    const steps: string[] = [];
    const outputs: string[] = [];

    steps.push("Read project structure");
    outputs.push(formatProjectStructure());

    const templateId = inferTemplateFromTask(lower);
    if (templateId) {
      steps.push(`Use template: ${templateId}`);
      outputs.push(formatTemplateDetail(templateId));
    }

    if (lower.includes("reservation")) {
      steps.push("Find ReservationPage");
      const page = findPageClass("ReservationPage");
      outputs.push(page.message);
      outputs.push(listMethods("ReservationPage"));
    }

    if (lower.includes("login") || lower.includes("sso")) {
      steps.push("Find SSOLoginPage");
      outputs.push(findPageClass("SSOLoginPage").message);
    }

    if (lower.includes("test") || lower.includes("create") || lower.includes("automate")) {
      steps.push("Generate test skeleton");
      outputs.push(
        generateTest({
          title: task,
          templateId: templateId ?? undefined,
        }),
      );
    }

    if (lower.includes("assert")) {
      steps.push("Suggest assertions from page objects");
      const assertions = suggestAssertions("ReservationPage");
      if (assertions.length) {
        outputs.push(`Suggested assertions:\n${assertions.map((a) => `  - ${a}`).join("\n")}`);
      }
    }

    return { intent: task, steps, outputs };
  }

  findPage(pageName: string): string {
    return findPageClass(pageName).message;
  }

  searchMethod(pageName: string, methodName: string): string {
    return searchMethod(pageName, methodName).message;
  }

  listMethods(pageName: string): string {
    return listMethods(pageName);
  }

  inspect(): string {
    return formatProjectStructure();
  }

  generateTest(
    title: string,
    templateId?: string,
    options?: { includeTeardown?: boolean },
  ): string {
    return generateTest({
      title,
      templateId,
      includeTeardown: options?.includeTeardown,
    });
  }

  listTemplates(): string {
    return formatTemplateList();
  }

  showTemplate(templateId: string): string {
    return formatTemplateDetail(templateId);
  }

  generateFromTemplate(
    templateId: string,
    title: string,
    options?: { includeTeardown?: boolean },
  ): string {
    return generateFromTemplate({
      templateId,
      title,
      includeTeardown: options?.includeTeardown,
    });
  }

  generateMethod(action: string, locatorExpression?: string): string {
    return generatePomMethod({
      action,
      locatorExpression,
    }).code;
  }

  convertScript(script: string, pageName?: string): string {
    const result = convertRecordedScript(script, pageName);
    const sections = [
      `Target page: ${result.suggestedPage}`,
      `Reused methods: ${result.reusedMethods.join(", ") || "none"}`,
      `New methods: ${result.newMethods.join(", ") || "none"}`,
      "",
      "--- POM additions ---",
      result.pomAdditions || "(none — all steps map to existing methods)",
      "",
      "--- Test body ---",
      `import { test, expect } from "../src/fixtures/sso.fixture";`,
      "",
      `test("Converted scenario", async ({ reservationPage }) => {`,
      result.testBody,
      `});`,
    ];
    return sections.join("\n");
  }

  loadStandards(): string {
    const standardsPath = path.join(PATHS.prompts, "standards.md");
    if (!fs.existsSync(standardsPath)) {
      return "Standards file not found.";
    }
    return fs.readFileSync(standardsPath, "utf-8");
  }
}

function inferTemplateFromTask(task: string): string | null {
  if (task.includes("calendar")) {
    return "shared-calendar-popup";
  }
  if (task.includes("shared") && task.includes("reservation")) {
    return "shared-find-list";
  }
  if (task.includes("find") && task.includes("list")) {
    return "shared-find-list";
  }
  return null;
}
