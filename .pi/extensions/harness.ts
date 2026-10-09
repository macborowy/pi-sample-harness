import { type ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { runCoordinator } from "../../harness/src/coordinator"
import { executeFeaturePlan } from "../../harness/src/feature-execution"
import type { FeaturePlan } from "../../harness/src/types"

type FeaturePhase =
    | "planning"
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

                activeFeature.plan = plan
                activeFeature.phase = "implementing"

                ctx.ui.notify(
                    `Feature plan created:\n\n${JSON.stringify(plan, null, 2)}`,
                    "info"
                )

                try {
                    //
                    // IMPLEMENTATION
                    //
                    const results =
                        await executeFeaturePlan({
                            plan,
                            repoRoot: ctx.cwd,
                            model: ctx.model,
                            thinkingLevel:
                                ctx.thinkingLevel,

                            onStatus: message => {
                                ctx.ui.setStatus(
                                    "feature",
                                    message
                                )
                            }
                        })

                    //
                    // VALIDATION
                    //
                    activeFeature.phase = "validating"

                    ctx.ui.setStatus(
                        "feature",
                        "Running deterministic checks"
                    )

                    const validation =
                        await pi.exec(
                            "bash",
                            [
                                "harness/scripts/check-all.sh"
                            ],
                            {
                                cwd: ctx.cwd,
                                timeout: 120_000
                            }
                        )

                    if (validation.code !== 0) {
                        const output = [
                            validation.stdout,
                            validation.stderr
                        ]
                            .filter(Boolean)
                            .join("\n")
                            .trim()

                        throw new Error(
                            `Deterministic validation failed:\n\n${output}`
                        )
                    }

                    ctx.ui.notify(
                        [
                            "FEATURE PASSED",
                            "",
                            "Agents executed:",
                            ...Object.keys(results)
                                .map(role => `- ${role}`)
                        ].join("\n"),
                        "info"
                    )
                } catch (error) {
                    ctx.ui.notify(
                        `FEATURE FAILED:\n\n${String(error)}`,
                        "error"
                    )
                } finally {
                    activeFeature = null

                    ctx.ui.setStatus(
                        "feature",
                        undefined
                    )
                }
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
}
