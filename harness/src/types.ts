export type AgentRole =
  | "frontend"
  | "backend"

export interface AgentTask {
  required: boolean
  task: string
  acceptanceCriteria: string[]
  dependsOn: AgentRole[]
}

export interface FeaturePlan {
  feature: string

  summary: string

  frontend: AgentTask
  backend: AgentTask

  crossCuttingAcceptanceCriteria: string[]
}