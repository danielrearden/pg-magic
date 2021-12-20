export const isBit = (typeName: string): boolean => {
  return ["bit", "varbit"].includes(typeName);
};
