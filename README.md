# pg-magic 🪄✨

`pg-magic` is a TypeScript type generator for PostgreSQL queries. It is not intended for standalone usage, but instead provides an API that can be leveraged by other tools to generate TypeScript types from PostgreSQL queries.

When generating types, `pg-magic` fetches type information about your database from your PostgreSQL server. It then uses a [wrapper](https://github.com/pyramation/pgsql-parser) around the [actual parser](https://github.com/pganalyze/libpg_query) used by PostgreSQL to parse your queries. By statically analyzing the queries, `pg-magic` can support a wide variety of PostgreSQL-specific expressions and can generate types for queries of arbitrary complexity.

## Features

`pg-magic` supports parsing:

- SELECT, INSERT, UPDATE, DELETE and VALUES statements
- Qualified and unqualified column references
- Tables and column aliases
- Star expressions
- Most data types
- Enum types
- One-dimensional arrays (including access using subscript expressions)
- Most functions, operators and expressions
- Constant values (which are converted to TypeScript literal types)
- Views and materialized views
- Common table expressions and subqueries
- Set operations like UNION, INTERSECT and EXCEPT
- Type casting

## Installation

```
yarn add pg-magic
```

## Basic Usage

```typescript
const generator = await createTypeGenerator({
  connectionString: "postgresql://localhost:5432/postgres",
});

const query = generator.generate(`
  SELECT
    id,
    first_name || last_name "fullName",
    email
  FROM customer;
`);

if ("error" in query) {
  throw query.error;
}

console.log(query.results[0]);
// { id: number, fullName: string; email: string | null }
```

> Note: `results` is an array because the query could include multiple statements.

## API

````typescript
async function createTypeGenerator(
  options: CreateTypeGeneratorOptions
): Promise<TypeGenerator>;

type CreateTypeGeneratorOptions = {
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

type TypeGenerator = {
  generate: () => { results: string[] } | { error: unknown }>
};
````

## Roadmap

The following types have limited operator and function support:

- Functions and operators returning record sets
- [JSON](https://www.postgresql.org/docs/current/functions-json.html)
- [Geometry](https://www.postgresql.org/docs/current/functions-geometry.html)
- [Network address](https://www.postgresql.org/docs/current/functions-net.html)
- [Range and multirange](https://www.postgresql.org/docs/current/functions-range.html)
- [Text search](https://www.postgresql.org/docs/current/functions-textsearch.html)

Future enhancements:

- Infer nested types when using `json_build_object` and similar functions
- Allow overriding individual column types (i.e. providing more specific types for individual JSON columns)
- Allow custom handlers for functions and operators
- Support views with non-cyclical dependencies on other views
- Support specifying column aliases when specifying a table alias (regular column aliases are already supported)
