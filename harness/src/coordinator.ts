import fs from "node:fs/promises"
import path from "node:path"

import {
  createAgentSession,
  SessionManager
} from "@earendil-works/pi-coding-agent"

import { parseFeaturePlan } from "./feature-plan"
import type { FeaturePlan } from "./types"

const MAX_PLAN_ATTEMPTS = 2

export async function runCoordinator({
  request,
  repoRoot,
  model,
  thinkingLevel
}: {
  request: string
  repoRoot: string
  model?: any
  thinkingLevel?: any
}): Promise<FeaturePlan> {
  const rolePath = path.join(
    repoRoot,
    "harness/agents/coordinator.md"
  )

  const role = await fs.readFile(
    rolePath,
    "utf8"
  )

  const { session } = await createAgentSession({
    cwd: repoRoot,
    model,
    thinkingLevel,

    tools: [
      "read",
      "grep",
      "find",
      "ls"
    ],

    sessionManager:
      SessionManager.inMemory(repoRoot)
  })

  let output = ""

  const unsubscribe =
    session.subscribe(event => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type ===
          "text_delta"
      ) {
        output +=
          event.assistantMessageEvent.delta
      }
    })

  try {
    let prompt = buildInitialPrompt(
      role,
      request
    )

    for (
      let attempt = 1;
      attempt <= MAX_PLAN_ATTEMPTS;
      attempt++
    ) {
      //
      // Capture only this attempt's output
      //
      output = ""

      await session.prompt(prompt)

      try {
        return await parseFeaturePlan(
          output.trim(),
          repoRoot
        )
      } catch (error) {
        if (attempt === MAX_PLAN_ATTEMPTS) {
          throw new Error(
            `Coordinator failed to produce a valid FeaturePlan after ${MAX_PLAN_ATTEMPTS} attempts.\n\n${String(error)}`
          )
        }

        prompt = buildRepairPrompt(error)
      }
    }

    throw new Error(
      "Coordinator unexpectedly exited planning loop"
    )
  } finally {
    unsubscribe()
  }
}

function buildInitialPrompt(
  role: string,
  request: string
): string {
  return `
${role}

# Feature request

${request}

Inspect the repository before producing the plan.

Return ONLY the FeaturePlan JSON.
No Markdown fences.
No commentary before or after the JSON.
`.trim()
}

function buildRepairPrompt(
  error: unknown
): string {
  return `
Your previous FeaturePlan failed deterministic validation.

Validation error:

${String(error)}

Correct the FeaturePlan.

Important:

- Return the COMPLETE FeaturePlan again
- Fix all reported structural problems
- Preserve valid information from the previous plan
- Do not implement anything
- Return ONLY JSON
- Do not use Markdown fences
- Do not include commentary
`.trim()
}