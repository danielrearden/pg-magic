export const isTimestamp = (typeName: string): boolean => {
  return ["timestamp", "timestamptz"].includes(typeName);
};
