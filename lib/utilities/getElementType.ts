export const getElementType = (pgType: string): string => {
  return pgType.replace(/(\[\])+$/, "");
};
