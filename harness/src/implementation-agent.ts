import fs from "node:fs/promises"
import path from "node:path"

import {
    createAgentSession,
    DefaultResourceLoader,
    getAgentDir,
    isToolCallEventType,
    SessionManager
} from "@earendil-works/pi-coding-agent"

import type {
    AgentRole,
    AgentTask,
    FeaturePlan
} from "./types"
import { KeywordCxt } from "ajv"

const WRITE_OWNERSHIP: Record<
    AgentRole,
    string[]
> = {
    frontend: [
        "apps/web/"
    ],

    backend: [
        "apps/api/",
        "contracts/"
    ]
}

function canWritePath(
    role: AgentRole,
    repoRoot: string,
    requestedPath: string
): boolean {
    const absolutePath = path.resolve(
        repoRoot,
        requestedPath
    )

    const relativePath = path
        .relative(repoRoot, absolutePath)
        .replaceAll("\\", "/")

    //
    // Outside repository
    //
    if (
        relativePath.startsWith("../") ||
        path.isAbsolute(relativePath)
    ) {
        return false
    }

    return WRITE_OWNERSHIP[role]
        .some(prefix => relativePath.startsWith(prefix))
}

function createOwnershipGuardrail(
    role: AgentRole,
    repoRoot: string
) {
    return (pi: any) => {
        pi.on(
            "tool_call",
            async (event: any) => {
                //
                // WRITE / EDIT
                //
                if (
                    isToolCallEventType("write", event)
                    || isToolCallEventType("edit", event)
                ) {
                    if (
                        !canWritePath(
                            role,
                            repoRoot,
                            event.input.path
                        )
                    ) {
                        return {
                            block: true,
                            reason: `${role} agent cannot modify ${event.input.path}`
                        }
                    }
                }

                //
                // BASH
                //
                if (isToolCallEventType("bash", event)) {
                    const command = event.input.command

                    const forbiddenPatterns = [
                        /\bgit\s+commit\b/i,
                        /\bgit\s+push\b/i,

                        /\bterraform\s+apply\b/i,
                        /\bterraform\s+destroy\b/i,

                        /\bsudo\b/i
                    ]

                    const blocked = forbiddenPatterns
                        .some(pattern => pattern.test(command))

                    if (blocked) {
                        return {
                            block: true,
                            reason: `Command blocked for ${role} agent: ${command}`
                        }
                    }
                }
            }
        )
    }
}

export async function runImplementationAgent({
    role,
    task,
    plan,
    repoRoot,
    model,
    thinkingLevel
}: {
    role: AgentRole
    task: AgentTask
    plan: FeaturePlan
    repoRoot: string
    model?: any
    thinkingLevel?: any
}): Promise<string> {
    const rolePath = path.join(
        repoRoot,
        "harness/agents",
        `${role}.md`
    )

    const roleInstructions =
        await fs.readFile(
            rolePath,
            "utf8"
        )

    //
    // ResourceLoader lets us inject
    // the role-specific guardrail
    //
    const resourceLoader =
        new DefaultResourceLoader({
            cwd: repoRoot,
            agentDir: getAgentDir(),

            noExtensions: true,

            extensionFactories: [
                createOwnershipGuardrail(
                    role,
                    repoRoot
                )
            ]
        })

    await resourceLoader.reload()

    const { session } =
        await createAgentSession({
            cwd: repoRoot,

            model,
            thinkingLevel,

            tools: [
                "read",
                "grep",
                "find",
                "ls",
                "bash",
                "edit",
                "write"
            ],

            resourceLoader,

            sessionManager:
                SessionManager.inMemory(
                    repoRoot
                )
        })

    let output = ""

    const unsubscribe =
        session.subscribe(event => {
            if (
                event.type === "message_update"
                && event.assistantMessageEvent.type === "text_delta"
            ) {
                output +=
                    event.assistantMessageEvent
                        .delta
            }
        })

    try {
        await session.prompt(
            buildRolePrompt(
                roleInstructions,
                role,
                task,
                plan
            )
        )

        return output.trim()
    } finally {
        unsubscribe()
        session.dispose()
    }
}

function buildRolePrompt(
    roleInstructions: string,
    role: AgentRole,
    task: AgentTask,
    plan: FeaturePlan
): string {
    return `
${roleInstructions}

# Feature

${plan.feature}

# Feature summary

${plan.summary}

# Your assigned role

${role}

# Your assigned task

${task.task}

# Acceptance criteria

${task.acceptanceCriteria
            .map(item => `- ${item}`)
            .join("\n")}

# Cross-cutting acceptance criteria

${plan.crossCuttingAcceptanceCriteria
            .map(item => `- ${item}`)
            .join("\n")}

Implement ONLY your assigned part of the feature.

Inspect the existing repository before making changes.

Do not attempt work belonging to another role.

Do not modify the harness.

When your implementation is complete, stop.
`.trim()
}