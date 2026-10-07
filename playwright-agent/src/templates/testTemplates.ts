import { STEP_BLOCKS, StepBlock } from "./stepBlocks";

export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  sourceTest: string;
  blockIds: string[];
  bodyPlaceholder: string;
  /** When true, reservationPage is created from a popup — do not inject the fixture */
  usesLocalReservationPage?: boolean;
}

/**
 * Full test templates derived from the first two tests in SharedReservation.spec.ts.
 * Each template includes routine login/setup; add custom steps where indicated.
 */
export const TEST_TEMPLATES: Record<string, TestTemplate> = {
  "shared-find-list": {
    id: "shared-find-list",
    name: "Shared reservation via Find Reservation list",
    description:
      "Setup from 'Verify a shared reservation is created successfully via Find Reservation screen'. " +
      "UserAdmin login with DB reset, navigate to shared new reservation form.",
    sourceTest:
      "Verify a shared reservation is created successfully via Find Reservation screen",
    blockIds: ["login-admin-with-reset", "navigate-shared-via-find-list"],
    bodyPlaceholder:
      "// TODO: add test-specific steps here\n  // e.g. await reservationPage.selectFirstAvailableRoomType();",
  },

  "shared-calendar-popup": {
    id: "shared-calendar-popup",
    name: "Shared reservation via Calendar popup",
    description:
      "Setup from 'Verify a shared reservation is created successfully via Calendar screen'. " +
      "User1 login, open calendar, launch New Reservation popup as Shared.",
    sourceTest:
      "Verify a shared reservation is created successfully via Calendar screen",
    blockIds: ["login-user1", "navigate-shared-via-calendar-popup"],
    bodyPlaceholder:
      "// TODO: add test-specific steps here\n  // reservationPage is already created from the calendar popup",
    usesLocalReservationPage: true,
  },

  "shared-find-list-full": {
    id: "shared-find-list-full",
    name: "Full shared reservation flow (Find list)",
    description:
      "Complete flow from test 1: login + reset, navigate, create both guests, assert, delete.",
    sourceTest:
      "Verify a shared reservation is created successfully via Find Reservation screen",
    blockIds: [
      "login-admin-with-reset",
      "navigate-shared-via-find-list",
      "save-primary-shared-guest",
      "add-second-shared-guest-and-save",
      "teardown-delete-reservation",
    ],
    bodyPlaceholder: "",
  },

  "shared-calendar-full": {
    id: "shared-calendar-full",
    name: "Full shared reservation flow (Calendar)",
    description:
      "Complete flow from test 2: User1 login, calendar popup, create both guests, assert, delete.",
    sourceTest:
      "Verify a shared reservation is created successfully via Calendar screen",
    blockIds: [
      "login-user1",
      "navigate-shared-via-calendar-popup",
      "save-primary-shared-guest",
      "add-second-shared-guest-and-save",
      "teardown-delete-reservation",
    ],
    bodyPlaceholder: "",
    usesLocalReservationPage: true,
  },
};

const BASE_IMPORTS = [
  'import { test, expect } from "../src/fixtures/sso.fixture";',
  'import { AlertMessages } from "../src/constants/AlertMessages";',
  'import { ConstNames } from "../src/constants/ConstNames";',
  'import { SSOUsers } from "../src/test-data/SSOUsers";',
];

function collectBlocks(blockIds: string[]): StepBlock[] {
  return blockIds.map((id) => {
    const block = STEP_BLOCKS[id];
    if (!block) {
      throw new Error(`Unknown step block: ${id}`);
    }
    return block;
  });
}

function collectFixtures(blocks: StepBlock[]): string[] {
  const fixtures = new Set<string>();
  for (const block of blocks) {
    for (const fixture of block.fixtures) {
      fixtures.add(fixture);
    }
  }
  return [...fixtures];
}

function collectImports(blocks: StepBlock[]): string[] {
  const imports = new Set(BASE_IMPORTS);
  for (const block of blocks) {
    for (const extraImport of block.extraImports ?? []) {
      imports.add(extraImport);
    }
  }
  return [...imports];
}

export interface GenerateFromTemplateInput {
  templateId: string;
  title: string;
  customSteps?: string[];
  includeTeardown?: boolean;
}

export function getTemplate(templateId: string): TestTemplate | undefined {
  return TEST_TEMPLATES[templateId];
}

export function listTemplates(): TestTemplate[] {
  return Object.values(TEST_TEMPLATES);
}

export function formatTemplateList(): string {
  const lines = ["Available test templates:", ""];

  for (const template of listTemplates()) {
    lines.push(`  ${template.id}`);
    lines.push(`    ${template.name}`);
    lines.push(`    Source: ${template.sourceTest}`);
    lines.push(`    Blocks: ${template.blockIds.join(" → ")}`);
    lines.push("");
  }

  lines.push("Reusable step blocks:");
  for (const block of Object.values(STEP_BLOCKS)) {
    lines.push(`  ${block.id} — ${block.name}`);
  }

  return lines.join("\n");
}

export function formatTemplateDetail(templateId: string): string {
  const template = getTemplate(templateId);
  if (!template) {
    return `Template '${templateId}' not found. Run: npm run agent -- templates`;
  }

  const blocks = collectBlocks(template.blockIds);
  const lines = [
    `Template: ${template.id}`,
    `Name: ${template.name}`,
    `Description: ${template.description}`,
    `Source test: ${template.sourceTest}`,
    "",
    "Step blocks:",
  ];

  for (const block of blocks) {
    lines.push(`  [${block.id}] ${block.name}`);
    for (const step of block.steps) {
      lines.push(`    ${step}`);
    }
    lines.push("");
  }

  if (template.bodyPlaceholder) {
    lines.push("Body placeholder:");
    lines.push(`  ${template.bodyPlaceholder}`);
  }

  return lines.join("\n");
}

export function generateFromTemplate(input: GenerateFromTemplateInput): string {
  const template = getTemplate(input.templateId);
  if (!template) {
    throw new Error(
      `Template '${input.templateId}' not found. Available: ${Object.keys(TEST_TEMPLATES).join(", ")}`,
    );
  }

  const blockIds = [...template.blockIds];

  if (
    input.includeTeardown &&
    !blockIds.includes("teardown-delete-reservation")
  ) {
    blockIds.push("teardown-delete-reservation");
  }

  const blocks = collectBlocks(blockIds);
  const fixtures = collectFixtures(blocks);

  if (template.usesLocalReservationPage) {
    const reservationFixtureIndex = fixtures.indexOf("reservationPage");
    if (reservationFixtureIndex !== -1) {
      fixtures.splice(reservationFixtureIndex, 1);
    }
  }

  if (
    blockIds.includes("login-admin-with-reset") &&
    !fixtures.includes("dbHelper")
  ) {
    fixtures.unshift("dbHelper");
  }

  const imports = collectImports(blocks);
  const allSteps: string[] = [];

  for (const block of blocks) {
    allSteps.push(...block.steps);
  }

  if (input.customSteps?.length) {
    if (allSteps.length > 0) {
      allSteps.push("");
    }
    allSteps.push(...input.customSteps);
  } else if (template.bodyPlaceholder) {
    allSteps.push("");
    allSteps.push(template.bodyPlaceholder);
  }

  const fixtureParams = fixtures.join(",\n  ");

  return `${imports.join("\n")}

// =========================================================================
// ${input.title}
// Template: ${template.id} (from ${template.sourceTest})
// =========================================================================

test("${input.title}", async ({
  ${fixtureParams},
}) => {
${allSteps.map((step) => `  ${step}`).join("\n")}
});
`;
}
