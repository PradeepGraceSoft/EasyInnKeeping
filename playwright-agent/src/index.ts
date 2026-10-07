import fs from "fs";
import path from "path";
import { PlaywrightAgent } from "./agents/playwrightAgent";

const agent = new PlaywrightAgent();

function printHelp(): void {
  console.log(`Playwright Automation Agent

Usage:
  npm run agent -- <command> [args]

Commands:
  inspect                          List pages, fixtures, tests
  find-page <PageName>             Locate a page object file
  search-method <Page> <method>    Check if a method exists
  methods <PageName>               List all methods on a page
  templates                        List reusable test templates and step blocks
  template <id>                    Show template details and routine steps
  from-template <id> "<title>"     Generate test from a template
  generate-test "<title>"          Generate a test skeleton
  generate-test --template <id> "<title>"  Generate test using a template
  generate-method "<action>"       Generate a POM method stub
  convert <file>                   Convert recorded script to POM + test
  convert-stdin                    Convert recorded script from stdin
  plan "<task>"                    Run full agent workflow for a task
  standards                        Print coding standards

Templates (from SharedReservation.spec.ts):
  shared-find-list          Login + reset (UserAdmin) + navigate via Find list
  shared-calendar-popup     Login (User1) + navigate via Calendar popup
  shared-find-list-full     Complete find-list flow with both guests
  shared-calendar-full      Complete calendar flow with both guests

Examples:
  npm run agent -- templates
  npm run agent -- template shared-find-list
  npm run agent -- from-template shared-find-list "Verify room warning on shared reservation"
  npm run agent -- generate-test --template shared-find-list "My new shared test"
  npm run agent -- plan "Create test for New Reservation"
`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseTemplateArgs(args: string[]): {
  templateId?: string;
  title: string;
  includeTeardown: boolean;
} {
  let templateId: string | undefined;
  let includeTeardown = false;
  const titleParts: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--template" && args[index + 1]) {
      templateId = args[index + 1];
      index++;
      continue;
    }

    if (arg === "--teardown") {
      includeTeardown = true;
      continue;
    }

    titleParts.push(arg);
  }

  return {
    templateId,
    title: titleParts.join(" ").replace(/^["']|["']$/g, ""),
    includeTeardown,
  };
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  switch (command) {
    case "inspect":
      console.log(agent.inspect());
      break;

    case "find-page":
      console.log(agent.findPage(args[0] ?? ""));
      break;

    case "search-method":
      console.log(agent.searchMethod(args[0] ?? "", args[1] ?? ""));
      break;

    case "methods":
      console.log(agent.listMethods(args[0] ?? ""));
      break;

    case "templates":
      console.log(agent.listTemplates());
      break;

    case "template":
      console.log(agent.showTemplate(args[0] ?? ""));
      break;

    case "from-template": {
      const templateId = args[0];
      const { title, includeTeardown } = parseTemplateArgs(args.slice(1));
      if (!templateId || !title) {
        console.error('Usage: from-template <id> "<title>" [--teardown]');
        process.exit(1);
      }
      console.log(
        agent.generateFromTemplate(templateId, title, { includeTeardown }),
      );
      break;
    }

    case "generate-test": {
      const { templateId, title, includeTeardown } = parseTemplateArgs(args);
      if (!title) {
        console.error('Usage: generate-test [--template <id>] "<title>" [--teardown]');
        process.exit(1);
      }
      console.log(
        agent.generateTest(title, templateId, { includeTeardown }),
      );
      break;
    }

    case "generate-method":
      console.log(agent.generateMethod(args.join(" ")));
      break;

    case "convert": {
      const filePath = args[0];
      if (!filePath) {
        console.error("Usage: convert <file>");
        process.exit(1);
      }
      const script = fs.readFileSync(path.resolve(filePath), "utf-8");
      console.log(agent.convertScript(script, args[1]));
      break;
    }

    case "convert-stdin": {
      const script = await readStdin();
      console.log(agent.convertScript(script, args[0]));
      break;
    }

    case "plan": {
      const task = args.join(" ");
      const plan = agent.plan(task);
      console.log(`Task: ${plan.intent}\n`);
      console.log("Workflow:");
      plan.steps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
      console.log("\n--- Output ---\n");
      console.log(plan.outputs.join("\n\n"));
      break;
    }

    case "standards":
      console.log(agent.loadStandards());
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
