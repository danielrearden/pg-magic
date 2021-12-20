export const isArray = (typeName: string): boolean => {
  return /(\[\])+$/.test(typeName);
};
