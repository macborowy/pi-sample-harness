import fs from "node:fs/promises"
import path from "node:path"

import Ajv2020 from "ajv/dist/2020"

import type { FeaturePlan } from "./types"

export async function parseFeaturePlan(
  raw: string,
  repoRoot: string
): Promise<FeaturePlan> {
  //
  // 1. Parse JSON
  //
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Coordinator returned invalid JSON: ${String(error)}`
    )
  }

  //
  // 2. Load schema
  //
  const schemaPath = path.join(
    repoRoot,
    "harness/schemas/feature-plan.schema.json"
  )

  const schema = JSON.parse(
    await fs.readFile(schemaPath, "utf8")
  )

  //
  // 3. Validate schema
  //
  const ajv = new Ajv2020({
    allErrors: true
  })

  const validate = ajv.compile(schema)

  const valid = validate(parsed)

  if (!valid) {
    const errors = validate.errors
      ?.map(error => {
        return `${error.instancePath || "/"} ${error.message}`
      })
      .join("\n")

    throw new Error(
      `Coordinator returned invalid FeaturePlan:\n${errors}`
    )
  }

  return parsed as FeaturePlan
}