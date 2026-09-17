import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

type FeaturePhase =
	| "waiting-for-agent"
	| "implementing"
	| "validating"

interface FeatureRun {
	request: string
	phase: FeaturePhase
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
				phase: "waiting-for-agent"
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