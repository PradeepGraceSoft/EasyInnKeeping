import path from "path";

export const PROJECT_ROOT = path.resolve(__dirname, "../../..");

export const PATHS = {
  pages: path.join(PROJECT_ROOT, "src", "pages"),
  fixtures: path.join(PROJECT_ROOT, "src", "fixtures"),
  tests: path.join(PROJECT_ROOT, "tests"),
  constants: path.join(PROJECT_ROOT, "src", "constants"),
  testData: path.join(PROJECT_ROOT, "src", "test-data"),
  prompts: path.join(PROJECT_ROOT, "playwright-agent", "prompts"),
} as const;
