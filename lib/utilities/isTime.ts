export const isTime = (typeName: string): boolean => {
  return ["time", "timetz"].includes(typeName);
};
