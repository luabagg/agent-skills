export function parseOpenCodeModels(output, providerId) {
  const models = {};
  const records = output.matchAll(/^([^\s/]+)\/([^\s]+)\r?\n(\{[\s\S]*?^\})/gm);
  for (const [, provider, id, json] of records) {
    if (provider !== providerId) continue;
    const model = JSON.parse(json);
    if (model.id !== id || model.providerID !== providerId) {
      throw new Error(`OpenCode model identity does not match ${providerId}/${id}`);
    }
    models[id] = {
      name: model.name,
      reasoning: model.capabilities?.reasoning,
      input: ["text", "image"].filter((kind) => model.capabilities?.input?.[kind]),
      contextWindow: model.limit?.context,
      maxTokens: model.limit?.output,
      cost: {
        input: model.cost?.input,
        output: model.cost?.output,
        cacheRead: model.cost?.cache?.read ?? 0,
        cacheWrite: model.cost?.cache?.write ?? 0,
      },
    };
  }
  if (Object.keys(models).length === 0) {
    throw new Error(`OpenCode discovery returned no models for ${providerId}`);
  }
  return models;
}
