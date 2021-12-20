export const isText = (typeName: string): boolean => {
  return ["bpchar", "citext", "text", "varchar"].includes(typeName);
};
