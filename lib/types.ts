import { Options as PrettierOptions } from "prettier";

export type Column = { nullable: boolean; type: string };

export type Table = {
  columns: Record<string, Column>;
  nullable: boolean;
};

export type Tables = Record<string, Table>;

export type TablesBySchema = Record<string, Tables>;

export type Context = {
  tables: Tables;
  defaultSchema: string;
  fallbackType: string;
  formatFunc: (name: string, tsType: string) => string;
  mapType: (pgType: string) => string;
  tablesBySchema: TablesBySchema;
};

export type ParsedExpression = {
  /**
   * If the expression is a constant, we capture the value and then map it to a TypeScript literal
   * type. The `type` property is still populated and used to evaluate other expressions (like
   * operators).
   */
  constantValue?: string;
  name?: string;
  nullable: boolean;
  /**
   * Set operations like unions or intersections include multiple queries that are combined into a
   * single set of records. The queries must be "union compatible", which means that they return the
   * same number of columns and the corresponding columns have compatible data types. However, each
   * query could include constant values that are specific to it, so we want the TypeScript to be a
   * union of object types, with each object type reflecting one query. We use this property to
   * capture the type for this particular column for each query.
   */
  set?: ParsedExpression[];
  type: string;
  /**
   * Certain expressions, like CASE expressions, may contain multiple possible values. While these
   * values need to have compatible types (which is reflected by the `type` property), they should
   * be mapped to a TypeScript union type to account for constant values. For example,
   * `CASE WHEN a > 100 THEN 'HIGH' ELSE 'LOW' END` should be mapped to `"HIGH" | "LOW"`.
   */
  types?: ParsedExpression[];
};

export type ParsedResultTarget = Omit<ParsedExpression, "name"> & {
  name: string;
};

export type ParsedTable = {
  alias: string;
  columns: Record<string, Column>;
  nullable: boolean;
};

export type GenerateOptions = {
  /**
   * The connection string used to connect to your PostgreSQL backend. For format, see:
   * https://www.postgresql.org/docs/current/libpq-connect.html#id-1.7.3.8.3.6
   */
  connectionString: string;
  /**
   * The schema to reference when a schema is not provided. The default value is `"public"`.
   */
  defaultSchema?: string;
  /**
   * The TypeScript type to use when one cannot be determined based on the PG type. The default
   * value is `"string"`.
   */
  fallbackType?: string;
  /**
   * A function that can be used to customize the return type properties. The function is ran for
   * each property (column) in the returned type and is passed the column name and the generated
   * TypeScript type. This option is helpful when, for example, converting column names from snake
   * case to camel case.  The default value is:
   * ```
   * (name, tsType) => `"${name}": ${tsType},`
   * ```
   */
  formatFunc?: (name: string, tsType: string) => string;
  /**
   * Additional options to pass to Prettier. Used when formatting the generated TypeScript type for
   * the query. The default value is `{}`.
   */
  prettierOptions?: PrettierOptions;
  /**
   * A list of queries to generate types for, mapped to arbitrary keys. Typically, the keys will map
   * to filenames or locations inside of files.
   */
  queriesByKey: Record<string, string>;
  /**
   * Additional map of PostgreSQL to TypeScript types. This can be used to either provide type
   * information for custom types or override the default mapping for built-in types.
   * For example, if `bigint` values are parsed as strings, we would provide `{ int8: "string" }` as
   * the value. The default value is `{}`.
   */
  typeMap?: Record<string, string>;
};

export type GeneratePayload = Record<
  string,
  { results: string[] } | { error: unknown }
>;
