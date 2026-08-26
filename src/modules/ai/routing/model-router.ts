export type ModelRoute = "triage" | "summary";

export type ModelSelection = {
  provider: "openai";
  model: string;
};

export function selectModel(route: ModelRoute): ModelSelection {
  return route === "triage"
    ? { provider: "openai", model: "gpt-5-mini" }
    : { provider: "openai", model: "gpt-5" };
}
