import { library, promptOptions } from "../../library";

const cliCommand = "genui";

export function buildPromptSpec(): string {
  return [
    "You are generating OpenUI Lang for GenUI Popup Broker.",
    "Return only OpenUI Lang code. Do not return Markdown prose.",
    "The broker will validate the output and render it in an Electron popup.",
    "",
    library.prompt(promptOptions),
  ].join("\n");
}

export function buildAgentInstructions(): string {
  return `You have access to the GenUI CLI.

Use GenUI when a visual popup helps the user inspect status, risks, decisions, task boards, tables, diffs, maps, media, diagnostics, or approvals.

Workflow:
1. Run \`${cliCommand} prompt-spec\` and use that output as your OpenUI Lang authoring guide.
2. Generate OpenUI Lang yourself using only the listed components.
3. Validate before opening with \`${cliCommand} validate --openui-lang-file <file>\`.
4. Open the popup with \`${cliCommand} popup --openui-lang-file <file> --title "<title>" --agent-id "<agent-id>"\`.
5. Use \`${cliCommand} examples\` and \`${cliCommand} components\` for examples and the concise component catalog.
6. Add \`--wait\` when you need a completed, cancelled, closed, or failed result.

Do not send natural-language prompts to GenUI. The CLI/broker is an OpenUI Lang popup runtime, not a UI-planning LLM.
Never include secrets in OpenUI Lang or context.`;
}
