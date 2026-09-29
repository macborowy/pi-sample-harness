import type {
    AgentRole,
    AgentTask,
    FeaturePlan
} from "./types"

import { runImplementationAgent } from "./implementation-agent"

const ROLES: AgentRole[] = [
    "backend",
    "frontend"
]

export async function executeFeaturePlan({
    plan,
    repoRoot,
    model,
    thinkingLevel,
    onStatus
}: {
    plan: FeaturePlan
    repoRoot: string
    model?: any
    thinkingLevel?: any
    onStatus?: (message: string) => void
}): Promise<Record<string, string>> {
    const executionOrder =
        getExecutionOrder(plan)

    const results: Record<string, string> = {}

    for (const role of executionOrder) {
        const task = plan[role]

        onStatus?.(
            `Running ${role} agent`
        )

        const result =
            await runImplementationAgent({
                role,
                task,
                plan,
                repoRoot,
                model,
                thinkingLevel
            })

        results[role] = result
    }

    return results
}

function getExecutionOrder(
    plan: FeaturePlan
): AgentRole[] {
    const requiredRoles = ROLES.filter(role => plan[role].required)

    const result: AgentRole[] = []
    const visited = new Set<AgentRole>()
    const visiting = new Set<AgentRole>()

    function visit(role: AgentRole) {
        if (visited.has(role)) {
            return
        }

        if (visiting.has(role)) {
            throw new Error(
                `Circular dependency detected involving ${role}`
            )
        }

        visiting.add(role)

        const task: AgentTask = plan[role]

        for (const dependency of task.dependsOn) {
            if (plan[dependency].required) {
                visit(dependency)
            }

        }

        visiting.delete(role)
        visited.add(role)

        result.push(role)
    }

    for (const role of requiredRoles) {
        visit(role)
    }

    return result
}