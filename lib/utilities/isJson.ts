export const isJson = (typeName: string): boolean => {
  return ["json", "jsonb"].includes(typeName);
};
