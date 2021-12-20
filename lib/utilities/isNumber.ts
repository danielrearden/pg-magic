export const isNumber = (typeName: string): boolean => {
  return [
    "bigserial",
    "decimal",
    "float2",
    "float4",
    "float8",
    "int2",
    "int4",
    "int8",
    "serial",
    "serial2",
    "serial4",
    "serial8",
    "smallserial",
  ].includes(typeName);
};
