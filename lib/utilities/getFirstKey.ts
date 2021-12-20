export const getFirstKey = <T>(object: T): T extends T ? keyof T : never => {
  return Object.keys(object)[0] as T extends T ? keyof T : never;
};
