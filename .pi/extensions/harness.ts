import path from "node:path"

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent"

type FeaturePhase =
	| "waiting-for-agent"
	| "implementing"
	| "validating"

interface FeatureRun {
	request: string
	phase: FeaturePhase
	startedAt: number
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
				phase: "waiting-for-agent",
				startedAt: Date.now()
			}

			ctx.ui.setStatus(
				"feature",
				`Starting: ${request}`
			)

			const prompt = buildFeaturePrompt(request)

			pi.sendUserMessage(prompt)
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

function buildFeaturePrompt(request: string): string {
	return `
You are implementing a feature in the current repository.

## Feature request

${request}

## Instructions

1. Inspect the repository before making changes
2. Understand the existing architecture and conventions
3. Implement the requested feature
4. Keep the change limited to what is necessary for this feature
5. Do not commit or push changes
6. Do not deploy anything
7. Do not modify CI/CD configuration unless the feature explicitly requires it
8. When implementation is complete, summarize:
   - what you changed
   - which files you changed
   - any assumptions you made

Do not merely describe how to implement the feature.
Implement it in the repository.
`.trim()
}