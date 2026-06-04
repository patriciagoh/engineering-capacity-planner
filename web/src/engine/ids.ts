// Single wrapper over the platform UUID so id generation has one call site.
export const newId = (): string => crypto.randomUUID();
