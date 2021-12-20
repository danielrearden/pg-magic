export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array).values());
};
