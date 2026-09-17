import path from "node:path"

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { runCoordinator } from "../../harness/src/coordinator"
import type { FeaturePlan } from "../../harness/src/types"

type FeaturePhase =
	| "planning"
	| "waiting-for-agent"
	| "implementing"
	| "validating"

interface FeatureRun {
	request: string
	phase: FeaturePhase
	startedAt: number
	plan?: FeaturePlan
}

export default function featureExtension(pi: ExtensionAPI) {
	let activeFeature: FeatureRun | null = null;

	pi.registerCommand("feature", {
		description: "Implement a feature using the project coding harness",

		handler: async (args, ctx) => {
			const request = args.trim()

			if (!request) {
				ctx.ui.notify(
					"Usage: /feature <feature description>",
					"warning"
				)
				return
			}

			if (activeFeature) {
				ctx.ui.notify(
					`Feature already running: ${activeFeature.request}`,
					"warning"
				)
				return
			}

			if (!ctx.isIdle()) {
				ctx.ui.notify(
					`Cannot start /feature while the agent is busy`,
					"warning"
				)
				return
			}

			activeFeature = {
				request,
				phase: "planning",
				startedAt: Date.now()
			}

			ctx.ui.setStatus(
				"feature",
				`Planning: ${request}`
			)

			try {
				//
				// STEP 1
				// Coordinator creates a validated FeaturePlan
				//
				const plan = await runCoordinator({
					request,
					repoRoot: ctx.cwd,
					model: ctx.model,
					thinkingLevel: ctx.thinkingLevel
				})

				//
				// STEP 2
				// Store validated plan as workflow state
				//
				activeFeature.plan = plan
				activeFeature.phase = "waiting-for-agent"

				ctx.ui.notify(
					`Feature plan created:\n\n${JSON.stringify(plan, null, 2)}`,
					"info"
				)

				ctx.ui.setStatus(
					"feature",
					`Starting implementation: ${plan.feature}`
				)

				//
				// STEP 3
				// Main Pi agent receives the REQUEST + validated PLAN
				//
				const prompt = buildFeatureImplementationPrompt(
					request,
					plan
				)

				pi.sendUserMessage(prompt)
			} catch (error) {
				ctx.ui.notify(
					`Feature planning failed: ${String(error)}`,
					"error"
				)

				activeFeature = null

				ctx.ui.setStatus(
					"feature",
					undefined
				)
			}
		}
	})

	pi.on("agent_start", async (_event, ctx) => {
		if (!activeFeature) {
			return
		}

		if (activeFeature.phase !== "waiting-for-agent") {
			return
		}

		activeFeature.phase = "implementing"

		ctx.ui.setStatus(
			"feature",
			`Implementing: ${activeFeature.request}`
		)
	})

	pi.on("agent_settled", async (_event, ctx) => {
		if (!activeFeature) {
			return
		}

		if (activeFeature.phase !== "implementing") {
			return
		}

		activeFeature.phase = "validating"

		ctx.ui.setStatus(
			"feature",
			"Running deterministic checks"
		)

		try {
			const result = await pi.exec(
				"bash",
				["harness/scripts/check-all.sh"],
				{
					cwd: ctx.cwd,
					timeout: 120_000
				}
			)

			if (result.code === 0) {
				ctx.ui.notify(
					"/feature PASSED deterministic checks",
					"info"
				)

				if (result.stdout.trim()) {
					ctx.ui.notify(
						`/feature PASSED deterministic checks\n\n${result.stdout.trim()}`,
						"info"
					)
				}
			} else {
				const output = [
					result.stdout,
					result.stderr
				]
					.filter(Boolean)
					.join("\n")
					.trim()

				ctx.ui.notify(
					`/feature FAILED deterministic checks\n\n${output}`,
					"error"
				)
			}
		}
		catch (error) {
			ctx.ui.notify(
				`Validation failed to execute: ${String(error)}`,
				"error"
			)
		}
		finally {
			activeFeature = null
			ctx.ui.setStatus(
				"feature",
				undefined
			)
		}
	})

	pi.on("tool_call", async (event, ctx) => {
		if (!activeFeature) {
			return
		}

		if (
			isToolCallEventType("write", event) ||
			isToolCallEventType("edit", event)
		) {
			const targetPath = path.resolve(
				ctx.cwd,
				event.input.path
			)

			const repoRoot = path.resolve(ctx.cwd)

			const relativePath = path.relative(
				repoRoot,
				targetPath
			)

			//
			// 1. No writes outside repository
			//
			if (
				relativePath.startsWith("..") ||
				path.isAbsolute(relativePath)
			) {
				return {
					block: true,
					reason:
						`Feature agent cannot modify files outside repository: ${event.input.path}`
				}
			}

			//
			// 2. Protect the harness itself
			//
			const protectedPrefixes = [
				".pi/extensions/",
				"harness/"
			]

			const normalized =
				relativePath.replaceAll("\\", "/")

			if (
				protectedPrefixes.some(prefix =>
					normalized.startsWith(prefix)
				)
			) {
				return {
					block: true,
					reason:
						`Feature agent cannot modify protected harness file: ${normalized}`
				}
			}
		}

		if (isToolCallEventType("bash", event)) {
			const command =
				event.input.command.trim()

			const forbiddenPatterns = [
				/\bgit\s+commit\b/i,
				/\bgit\s+push\b/i,

				/\bsudo\b/i,

				/\brm\s+-[^\n]*r[^\n]*f\b/i
			]

			const forbidden =
				forbiddenPatterns.find(pattern =>
					pattern.test(command)
				)

			if (forbidden) {
				return {
					block: true,
					reason:
						`Command blocked by /feature guardrail: ${command}`
				}
			}
		}
	})
}

function buildFeatureImplementationPrompt(
  request: string,
  plan: FeaturePlan
): string {
  return `
You are implementing a feature in the current repository.

# Original feature request

${request}

# Validated implementation plan

${JSON.stringify(plan, null, 2)}

# Your responsibility

Implement the feature according to the validated FeaturePlan.

The FeaturePlan defines WHAT needs to be achieved.
You are responsible for determining HOW to implement it correctly
within the existing architecture.

# Instructions

1. Inspect relevant existing code before modifying it
2. Follow the existing architecture and repository conventions
3. Implement all required parts of the FeaturePlan
4. Satisfy all applicable acceptance criteria
5. Do not implement areas where "required" is false
6. Keep changes limited to this feature
7. Do not modify the FeaturePlan
8. Do not modify the harness
9. Do not commit or push changes
10. Do not deploy anything
11. Do not run harness validation yourself

When implementation is complete, summarize:

- what you changed
- which files you changed
- which acceptance criteria you addressed
- any assumptions you made

The harness will independently validate the implementation after you finish.

Do not merely describe the implementation.
Implement it in the repository.
`.trim()
}