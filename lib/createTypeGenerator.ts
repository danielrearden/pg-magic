import { Pool } from "pg";
import {
  A_ArrayExpr,
  A_Const,
  A_Expr,
  A_Indirection,
  BoolExpr,
  CaseExpr,
  CoalesceExpr,
  ColumnRef,
  CommonTableExpr,
  DeleteStmt,
  deparse,
  Expression,
  Float,
  FromItem,
  FuncCall,
  InsertStmt,
  Integer,
  JoinExpr,
  List,
  MinMaxExpr,
  parse,
  RangeSubselect,
  RangeVar,
  RawStmt,
  ResTarget,
  SelectStmt,
  SQLValueFunction,
  Stmt,
  String,
  SubLink,
  TypeCast,
  UpdateStmt,
  WithClause,
} from "pgsql-parser";
import { format as prettierFormat, Options as PrettierOptions } from "prettier";
import {
  Column,
  Context,
  CreateTypeGeneratorOptions,
  TypeGenerator,
  ParsedExpression,
  ParsedResultTarget,
  ParsedTable,
  Table,
  TablesBySchema,
} from "./types";
import {
  clone,
  getElementType,
  getFirstKey,
  isArray,
  isBit,
  isJson,
  isNumber,
  isText,
  isTime,
  isTimestamp,
  unique,
} from "./utilities";

const parseAArrayExpr = (
  { A_ArrayExpr: { elements } }: A_ArrayExpr,
  context: Context
): ParsedExpression => {
  return {
    nullable: false,
    type: `${parseExpression(elements[0], context).type}[]`,
  };
};

const parseAConst = (aConst: A_Const): ParsedExpression => {
  const {
    A_Const: { val },
  } = aConst;

  const nodeType = getFirstKey(val);
  switch (nodeType) {
    case "Integer":
      return {
        constantValue: (val as Integer).Integer.ival.toString(10),
        nullable: false,
        type: "int4",
      };
    case "Float":
      return {
        constantValue: (val as Float).Float.str,
        nullable: false,
        type: "float4",
      };
    case "Null":
      return { nullable: true, type: "null" };
    case "String":
      return {
        constantValue: `"${(val as String).String.str}"`,
        nullable: false,
        type: "text",
      };
    default:
      throw new Error(
        `Parsing constant value of type "${nodeType}" is not currently supported.`
      );
  }
};

const parseAExpr = (
  { A_Expr: expression }: A_Expr,
  context: Context
): ParsedExpression => {
  switch (expression.kind) {
    case "AEXPR_OP": {
      const name = expression.name[expression.name.length - 1].String.str;
      const lexpr =
        expression.lexpr && parseExpression(expression.lexpr, context);
      const rexpr =
        expression.rexpr && parseExpression(expression.rexpr, context);

      switch (name) {
        case "+": {
          let type = rexpr.type;

          if (lexpr) {
            if (lexpr.type === "date") {
              if (isNumber(rexpr.type)) {
                type = "date";
              } else if (isTime(rexpr.type) || rexpr.type === "interval") {
                type = "timestamp";
              }
            } else if (rexpr.type === "date") {
              if (isNumber(lexpr.type)) {
                type = "date";
              } else if (isTime(lexpr.type) || lexpr.type === "interval") {
                type = "timestamp";
              }
            } else if (lexpr.type === "interval") {
              if (isTimestamp(rexpr.type) || isTime(rexpr.type)) {
                type = rexpr.type;
              }
            } else if (rexpr.type === "interval") {
              if (isTimestamp(lexpr.type) || isTime(lexpr.type)) {
                type = lexpr.type;
              }
            }
          }

          return {
            nullable: (lexpr ? lexpr.nullable : false) || rexpr.nullable,
            type,
          };
        }

        case "-": {
          let type = rexpr.type;

          if (lexpr) {
            if (isJson(lexpr.type)) {
              type = lexpr.type;
            } else if (lexpr.type === "date" && rexpr.type === "date") {
              type = "int4";
            } else if (lexpr.type === "date" && isNumber(rexpr.type)) {
              type = "date";
            } else if (lexpr.type === "date" && rexpr.type === "interval") {
              type = "timestamp";
            } else if (isTime(lexpr.type) && isTime(rexpr.type)) {
              type = "interval";
            } else if (isTime(lexpr.type) && rexpr.type === "interval") {
              type = lexpr.type;
            } else if (isTimestamp(lexpr.type) && rexpr.type === "interval") {
              type = lexpr.type;
            } else if (isTimestamp(lexpr.type) && isTimestamp(rexpr.type)) {
              type = "interval";
            }
          }

          return {
            nullable: (lexpr ? lexpr.nullable : false) || rexpr.nullable,
            type,
          };
        }

        case "*": {
          let type = rexpr.type;

          if (lexpr.type === "interval" && isNumber(rexpr.type)) {
            type = "interval";
          } else if (rexpr.type === "interval" && isNumber(lexpr.type)) {
            type = "interval";
          }

          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type,
          };
        }

        case "/": {
          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type:
              lexpr.type === "interval" && isNumber(rexpr.type)
                ? "interval"
                : rexpr.type,
          };
        }

        case ">>":
        case "<<": {
          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type: isNumber(rexpr.type) ? lexpr.type : "bool",
          };
        }

        case "~": {
          return {
            nullable: (lexpr ? lexpr.nullable : false) || rexpr.nullable,
            type:
              isNumber(rexpr.type) || isBit(rexpr.type) ? rexpr.type : "bool",
          };
        }

        case "||": {
          return {
            type: isArray(lexpr.type)
              ? lexpr.type
              : isArray(rexpr.type)
              ? rexpr.type
              : isText(lexpr.type)
              ? lexpr.type
              : rexpr.type,
            nullable: lexpr.nullable || rexpr.nullable,
          };
        }

        case "<":
        case "<=":
        case ">":
        case ">=":
        case "<>":
        case "!=":
        case "=":
        case "@>":
        case "<@":
        case "?":
        case "?|":
        case "?&":
        case "@?":
        case "@@":
        case "&&":
        case "&<":
        case "&>":
        case "-|-":
        case "~*":
        case "!~":
        case "!~*": {
          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type: "bool",
          };
        }

        case "&":
        case "|":
        case "#":
        case "->":
        case "#>":
        case "#-": {
          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type: lexpr.type,
          };
        }

        case "->>":
        case "#>>": {
          return {
            nullable: lexpr.nullable || rexpr.nullable,
            type: "text",
          };
        }

        case "%":
        case "^":
        case "|/":
        case "||/":
        case "@": {
          return {
            nullable: (lexpr ? lexpr.nullable : false) || rexpr.nullable,
            type: rexpr.type,
          };
        }
      }

      throw new Error(`Parsing operator "${name}" is not currently supported.`);
    }
    case "AEXPR_OP_ANY":
    case "AEXPR_OP_ALL":
    case "AEXPR_IN":
    case "AEXPR_LIKE":
    case "AEXPR_ILIKE":
    case "AEXPR_SIMILAR":
    case "AEXPR_BETWEEN":
    case "AEXPR_NOT_BETWEEN":
    case "AEXPR_BETWEEN_SYM":
    case "AEXPR_NOT_BETWEEN_SYM":
      return {
        nullable:
          parseExpression(expression.lexpr, context).nullable ||
          parseExpression(expression.rexpr, context).nullable,
        type: "bool",
      };
    case "AEXPR_DISTINCT":
    case "AEXPR_NOT_DISTINCT":
      return { nullable: false, type: "bool" };
    case "AEXPR_NULLIF":
      const lexpr = parseExpression(expression.lexpr, context);
      return {
        ...lexpr,
        nullable: true,
      };
    default:
      throw new Error(
        `Parsing expression of kind "${
          (expression as any).kind
        }" is not currently supported.`
      );
  }
};

const parseAIndirection = (
  { A_Indirection: { arg, indirection } }: A_Indirection,
  context: Context
): ParsedExpression => {
  const { nullable, type } = parseExpression(arg, context);
  if (isArray(type)) {
    if (indirection.length > 1) {
      throw new Error(
        `Parsing subscript expressions for multidimensional arrays is not currently supported.`
      );
    } else {
      const { is_slice: isSlice, lidx, uidx } = indirection[0].A_Indices;
      if (isSlice) {
        return {
          nullable:
            nullable ||
            (lidx ? parseExpression(lidx, context).nullable : false) ||
            (uidx ? parseExpression(uidx, context).nullable : false),
          type,
        };
      }

      return {
        nullable: true,
        type: getElementType(type),
      };
    }
  } else if (isJson(type)) {
    return {
      nullable: true,
      type: "any",
    };
  } else {
    throw new Error(
      `Parsing subscript expressions with type "${type}" is not currently supported.`
    );
  }
};

const parseBoolExpr = (
  { BoolExpr: { args } }: BoolExpr,
  context: Context
): ParsedExpression => {
  const expressions = args.map((arg) => parseExpression(arg, context));
  const nullable = expressions.some((expression) => expression.nullable);
  return {
    nullable,
    type: "bool",
  };
};

const parseBoolTest = (): ParsedExpression => {
  return {
    nullable: false,
    type: "bool",
  };
};

const parseCaseExpr = (
  { CaseExpr: { args, defresult } }: CaseExpr,
  context: Context
): ParsedExpression => {
  const results = args.map((arg) =>
    parseExpression(arg.CaseWhen.result, context)
  );
  const defaultResult = defresult ? parseExpression(defresult, context) : null;
  const possibleResults = defaultResult ? [...results, defaultResult] : results;

  return {
    nullable:
      !defaultResult ||
      possibleResults.some((expression) => expression.nullable),
    type: results[0].type,
    types: possibleResults,
  };
};

const parseCoalesceExpr = (
  { CoalesceExpr: { args } }: CoalesceExpr,
  context: Context
): ParsedExpression => {
  const types: ParsedExpression[] = [];
  for (const arg of args) {
    const expression = parseExpression(arg, context);
    types.push(expression);
    // If any value will always be non-null, subsequent arguments won't ever be used, so they
    // shouldn't be used in the final TypeScript type
    if (!expression.nullable) {
      break;
    }
  }

  return {
    nullable: types.every((type) => type.nullable),
    type: types[0].type,
    types,
  };
};

const parseColumnRef = (
  columnRef: ColumnRef,
  { tables }: Context
): ParsedExpression => {
  const {
    ColumnRef: { fields },
  } = columnRef;
  let column: Column | undefined;

  if (fields.length > 2) {
    throw new Error(
      `Parsing fully qualified column names is not currently supported.`
    );
  } else if (fields.length === 2) {
    if ("A_Star" in fields[1]) {
      // Star expressions are parsed and expanded inside of `parseTargetList` so we should only need
      // to parse the expression in the context of other expressions like function calls. We return
      // placeholder values for name and type because nullability is the only meaningful property
      // we can actually determine in this case.
      return {
        name: "",
        nullable: tables[fields[0].String.str]?.nullable ?? true,
        type: "any",
      };
    } else {
      column = tables[fields[0].String.str]?.columns[fields[1].String.str];
    }
  } else {
    if ("A_Star" in fields[0]) {
      return {
        name: "",
        nullable: false,
        type: "any",
      };
    }
    for (const tableName of Object.keys(tables)) {
      const maybeColumn = tables[tableName].columns[fields[0].String.str];
      if (maybeColumn) {
        column = maybeColumn;
        break;
      }
    }
  }

  if (!column) {
    throw new Error(`Unable to find column "${deparse(columnRef)}".`);
  }

  return {
    ...column,
    name: (fields[fields.length - 1] as String).String.str,
  };
};

const parseFuncCall = (
  { FuncCall: { args, funcname } }: FuncCall,
  context: Context
): ParsedExpression => {
  const functionName = funcname[funcname.length - 1].String.str;
  switch (functionName) {
    case "abs":
    case "acos":
    case "acosd":
    case "acosh":
    case "asin":
    case "asind":
    case "asinh":
    case "atan":
    case "atan2":
    case "atan2d":
    case "atand":
    case "atanh":
    case "bit_and":
    case "bit_or":
    case "bit_xor":
    case "btrim":
    case "cbrt":
    case "ceil":
    case "ceiling":
    case "convert":
    case "cos":
    case "cosd":
    case "cosh":
    case "cot":
    case "cotd":
    case "degrees":
    case "div":
    case "exp":
    case "factorial":
    case "floor":
    case "format":
    case "gcd":
    case "initcap":
    case "lcm":
    case "left":
    case "ln":
    case "log":
    case "log10":
    case "lower":
    case "lpad":
    case "ltrim":
    case "max":
    case "md5":
    case "min":
    case "mod":
    case "normalize":
    case "overlay":
    case "power":
    case "quote_ident":
    case "radians":
    case "regexp_replace":
    case "repeat":
    case "replace":
    case "reverse":
    case "right":
    case "round":
    case "rpad":
    case "rtrim":
    case "set_bit":
    case "set_byte":
    case "sha224":
    case "sha256":
    case "sha384":
    case "sha512":
    case "sign":
    case "sin":
    case "sind":
    case "sinh":
    case "split_part":
    case "sqrt":
    case "string_agg":
    case "substr":
    case "substring":
    case "sum":
    case "tan":
    case "tand":
    case "tanh":
    case "to_ascii":
    case "translate":
    case "trim":
    case "trim_scale":
    case "trunc":
    case "unistr":
    case "upper": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: parseExpression(args[0], context).type,
      };
    }

    case "array_append":
    case "array_cat":
    case "array_remove":
    case "array_replace": {
      return {
        nullable: parseExpression(args[0], context).nullable,
        type: parseExpression(args[0], context).type,
      };
    }

    case "date_trunc": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: parseExpression(args[1], context).type,
      };
    }

    case "array_prepend": {
      return {
        nullable: parseExpression(args[1], context).nullable,
        type: parseExpression(args[1], context).type,
      };
    }

    case "format": {
      const { nullable, type } = parseExpression(args[0], context);
      return {
        nullable,
        type,
      };
    }

    case "avg": {
      const { nullable, type } = parseExpression(args[0], context);
      return {
        nullable,
        type: ["interval", "float8"].includes(type)
          ? type
          : type === "float4"
          ? "float8"
          : "numeric",
      };
    }

    case "bool_and":
    case "bool_or":
    case "every":
    case "isfinite":
    case "starts_with": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "bool",
      };
    }

    case "convert_to":
    case "decode": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "bytea",
      };
    }

    case "make_date":
    case "to_date": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "date",
      };
    }

    case "date_part": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "float8",
      };
    }

    case "cume_dist":
    case "percent_rank":
    case "pi":
    case "random": {
      return {
        nullable: false,
        type: "float8",
      };
    }

    case "array_length":
    case "array_lower":
    case "array_ndims":
    case "array_upper":
    case "ascii":
    case "bit_length":
    case "cardinality":
    case "char_length":
    case "character_length":
    case "chr":
    case "get_bit":
    case "get_byte":
    case "length":
    case "min_scale":
    case "ntile":
    case "octet_length":
    case "position":
    case "scale":
    case "strpos":
    case "width_bucket": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "int4",
      };
    }

    case "array_position": {
      return {
        nullable: true,
        type: "int4",
      };
    }

    case "num_nonnulls":
    case "num_nulls": {
      return {
        nullable: false,
        type: "int4",
      };
    }

    case "array_positions": {
      return {
        nullable: parseExpression(args[0], context).nullable,
        type: "int4[]",
      };
    }

    case "bit_count": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "int8",
      };
    }

    case "count":
    case "currval":
    case "dense_rank":
    case "lastval":
    case "nextval":
    case "rank":
    case "row_number":
    case "setval": {
      return {
        nullable: false,
        type: "int8",
      };
    }

    case "age":
    case "justify_days":
    case "justify_hours":
    case "justify_interval":
    case "make_interval": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "interval",
      };
    }

    case "extract":
    case "to_number": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "numeric",
      };
    }

    case "array_dims":
    case "array_to_string":
    case "concat":
    case "concat_ws":
    case "convert_from":
    case "encode":
    case "quote_literal":
    case "quote_nullable":
    case "to_char":
    case "to_hex": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "text",
      };
    }

    case "timeofday": {
      return {
        nullable: false,
        type: "text",
      };
    }

    case "parse_ident":
    case "regexp_match":
    case "regexp_split_to_array": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "text[]",
      };
    }

    case "string_to_array": {
      return {
        nullable: parseExpression(args[0], context).nullable,
        type: "text[]",
      };
    }

    case "make_time": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "time",
      };
    }

    case "date_bin":
    case "make_timestamp": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "timestamp",
      };
    }

    case "make_timestamptz":
    case "to_timestamp": {
      return {
        nullable: args.some((arg) => parseExpression(arg, context).nullable),
        type: "timestamptz",
      };
    }

    case "clock_timestamp":
    case "now":
    case "statement_timestamp":
    case "transaction_timestamp": {
      return {
        nullable: false,
        type: "timestamptz",
      };
    }

    case "gen_random_uuid": {
      return {
        nullable: false,
        type: "uuid",
      };
    }

    case "array_fill": {
      return {
        nullable: false,
        type: `${getElementType(parseExpression(args[0], context).type)}[]`,
      };
    }

    // This function is used internally with SIMILAR TO expressions
    case "similar_to_escape": {
      return {
        nullable: false,
        type: "text",
      };
    }

    default:
      return {
        nullable: true,
        type: "any",
      };
  }
};

const parseList = (
  { List: { items } }: List,
  context: Context
): ParsedExpression => {
  const expressions = items.map((item) => {
    return parseExpression(item, context);
  });

  return {
    nullable: expressions.some((expression) => expression.nullable),
    type: expressions[0].type,
    types: expressions,
  };
};

const parseMinMaxExpr = (
  { MinMaxExpr: { args } }: MinMaxExpr,
  context: Context
): ParsedExpression => {
  const types = args.map((arg) => parseExpression(arg, context));

  return {
    nullable: types.every((type) => type.nullable),
    type: types[0].type,
  };
};

const parseNullTest = (): ParsedExpression => {
  return {
    nullable: false,
    type: "bool",
  };
};

const parseParamRef = (): ParsedExpression => {
  return {
    nullable: true,
    type: "any",
  };
};

const parseSQLValueFunction = ({
  SQLValueFunction: { op },
}: SQLValueFunction) => {
  const nullable = false;
  switch (op) {
    case "SVFOP_CURRENT_DATE":
      return { nullable, type: "date" };
    case "SVFOP_CURRENT_TIME":
    case "SVFOP_CURRENT_TIME_N":
    case "SVFOP_LOCALTIME":
    case "SVFOP_LOCALTIME_N":
      return { nullable, type: "timetz" };
    case "SVFOP_CURRENT_TIMESTAMP":
    case "SVFOP_CURRENT_TIMESTAMP_N":
    case "SVFOP_LOCALTIMESTAMP":
    case "SVFOP_LOCALTIMESTAMP_N":
      return { nullable, type: "timestamptz" };
    case "SVFOP_CURRENT_ROLE":
    case "SVFOP_CURRENT_USER":
    case "SVFOP_USER":
    case "SVFOP_SESSION_USER":
    case "SVFOP_CURRENT_CATALOG":
    case "SVFOP_CURRENT_SCHEMA":
      return { nullable, type: "text" };
  }
};

const parseSubLink = (
  { SubLink: { subLinkType, subselect } }: SubLink,
  context: Context
): ParsedExpression => {
  switch (subLinkType) {
    case "ALL_SUBLINK":
    case "ANY_SUBLINK": {
      return {
        nullable: true,
        type: "bool",
      };
    }

    case "ARRAY_SUBLINK": {
      const { type } = parseStmt(subselect, context)[0];
      return {
        nullable: false,
        type: `${type}[]`,
      };
    }

    case "EXISTS_SUBLINK":
    case "ROWCOMPARE_SUBLINK": {
      return {
        nullable: false,
        type: "bool",
      };
    }

    case "EXPR_SUBLINK": {
      const expression = parseStmt(subselect, context)[0];
      return {
        ...expression,
        nullable: true,
      };
    }

    case "MULTIEXPR_SUBLINK": {
      return {
        nullable: false,
        type: "any",
      };
    }

    default: {
      throw new Error(
        `Parsing sublink of type "${subLinkType}" is not currently supported.`
      );
    }
  }
};

const parseTypeCast = (
  typeCast: TypeCast,
  context: Context
): ParsedExpression => {
  const {
    TypeCast: {
      arg,
      typeName: { arrayBounds, names },
    },
  } = typeCast;

  const { constantValue, nullable } = parseExpression(arg, context);
  // `names` could be undefined, in which case we just use the fallback type
  // See: https://github.com/postgres/postgres/blob/master/src/include/nodes/parsenodes.h#L206
  const type = names?.[names.length - 1].String.str ?? context.fallbackType;

  // Boolean constants are represented as TypeCasts, so we handle them here
  if (
    constantValue &&
    ['"t"', '"f"'].includes(constantValue) &&
    type === "bool"
  ) {
    return {
      constantValue: constantValue === '"t"' ? "true" : "false",
      type: "bool",
      nullable,
    };
  } else if (arrayBounds) {
    return {
      type: `${type}[]`,
      nullable,
    };
  }

  return {
    constantValue,
    nullable,
    type,
  };
};

const parseExpression = (
  expression: Expression,
  context: Context
): ParsedExpression => {
  const nodeType = getFirstKey(expression);
  switch (nodeType) {
    case "A_ArrayExpr":
      return parseAArrayExpr(expression as A_ArrayExpr, context);
    case "A_Const":
      return parseAConst(expression as A_Const);
    case "A_Expr":
      return parseAExpr(expression as A_Expr, context);
    case "A_Indirection":
      return parseAIndirection(expression as A_Indirection, context);
    case "BoolExpr": {
      return parseBoolExpr(expression as BoolExpr, context);
    }
    case "BoolTest": {
      return parseBoolTest();
    }
    case "CaseExpr": {
      return parseCaseExpr(expression as CaseExpr, context);
    }
    case "CoalesceExpr": {
      return parseCoalesceExpr(expression as CoalesceExpr, context);
    }
    case "ColumnRef": {
      return parseColumnRef(expression as ColumnRef, context);
    }
    case "FuncCall": {
      return parseFuncCall(expression as FuncCall, context);
    }
    case "List": {
      return parseList(expression as List, context);
    }
    case "MinMaxExpr": {
      return parseMinMaxExpr(expression as MinMaxExpr, context);
    }
    case "NullTest": {
      return parseNullTest();
    }
    case "ParamRef":
      return parseParamRef();
    case "SQLValueFunction":
      return parseSQLValueFunction(expression as SQLValueFunction);
    case "SubLink":
      return parseSubLink(expression as SubLink, context);
    case "TypeCast":
      return parseTypeCast(expression as TypeCast, context);
    default: {
      throw new Error(
        `Parsing result target of type "${nodeType}" is not currently supported.`
      );
    }
  }
};

const parseTargetList = (
  targetList: ResTarget[],
  context: Context
): ParsedResultTarget[] => {
  const { tables } = context;
  return Array.from(
    targetList
      .reduce((acc, { ResTarget: { name, val } }) => {
        // We expand star expressions (`*` and `customer.*`), replacing them with explicit result
        // targets for each column.

        if ("ColumnRef" in val) {
          const { fields } = val.ColumnRef;
          if ("A_Star" in fields[0]) {
            for (const tableName of Object.keys(tables)) {
              const table = tables[tableName];
              for (const columnName of Object.keys(table.columns)) {
                acc.set(columnName, {
                  ...table.columns[columnName],
                  name: columnName,
                });
              }
            }

            return acc;
          } else if (fields[1] && "A_Star" in fields[1]) {
            const tableName = (val.ColumnRef.fields[0] as String).String.str;
            const table = tables[tableName];

            if (!table) {
              throw new Error(`Unable to find table "${tableName}".`);
            }

            for (const columnName of Object.keys(table.columns)) {
              acc.set(columnName, {
                ...table.columns[columnName],
                name: columnName,
              });
            }

            return acc;
          }
        }

        // All other expressions are parsed normally. A name can be inferred from certain expressions,
        // like column references; in all other cases, we require an explicit alias to be provided since
        // the rules for inferring the name are not well documented and omitting the alias is typically
        // a mistake anyway.
        const parsedExpression = parseExpression(val, context);

        const alias = name ?? parsedExpression.name;
        if (!alias) {
          throw new Error(
            `Alias not provided for result target "${
              deparse([val]) as string
            }".`
          );
        }

        acc.set(alias, {
          ...parsedExpression,
          name: alias,
        });

        return acc;
      }, new Map<string, ParsedResultTarget>())
      .values()
  );
};

const parseJoinExpr = (
  { JoinExpr: { jointype, larg, rarg } }: JoinExpr,
  parsedTables: ParsedTable[],
  context: Context
): void => {
  parseFromItem(larg, parsedTables, context);

  if (["JOIN_RIGHT", "JOIN_FULL"].includes(jointype)) {
    for (const parsedTable of parsedTables) {
      parsedTable.nullable = true;
    }
  }

  parseFromItem(
    rarg,
    parsedTables,
    context,
    ["JOIN_LEFT", "JOIN_FULL"].includes(jointype)
  );
};

const parseRangeSubselect = (
  { RangeSubselect: { alias, subquery } }: RangeSubselect,
  parsedTables: ParsedTable[],
  context: Context,
  nullable: boolean
): void => {
  parsedTables.push({
    alias: alias.aliasname,
    columns: parseSelectStmt(subquery, context).reduce(
      (acc, resultTarget, index) => {
        const columnName =
          alias.colnames?.[index]?.String.str ?? resultTarget.name;
        acc[columnName] = {
          nullable: resultTarget.nullable,
          type: resultTarget.type,
        };
        return acc;
      },
      {} as Record<string, Column>
    ),
    nullable,
  });
};

const parseRangeVar = (
  { RangeVar: { alias, relname, schemaname } }: RangeVar,
  parsedTables: ParsedTable[],
  { defaultSchema, tablesBySchema }: Context,
  nullable: boolean
): void => {
  const table = tablesBySchema[schemaname ?? defaultSchema]?.[relname];
  const name = alias?.aliasname ?? relname;

  if (!table) {
    throw new Error(`Unable to find table "${name}".`);
  }

  parsedTables.push({
    alias: name,
    columns: table.columns,
    nullable,
  });
};

const parseFromItem = (
  fromItem: FromItem,
  parsedTables: ParsedTable[],
  context: Context,
  nullable = false
): ParsedTable[] => {
  const nodeType = getFirstKey(fromItem);
  switch (nodeType) {
    case "JoinExpr": {
      parseJoinExpr(fromItem as JoinExpr, parsedTables, context);
      break;
    }
    case "RangeSubselect": {
      parseRangeSubselect(
        fromItem as RangeSubselect,
        parsedTables,
        context,
        nullable
      );
      break;
    }
    case "RangeVar": {
      parseRangeVar(fromItem as RangeVar, parsedTables, context, nullable);
      break;
    }
    default:
      throw new Error(
        `Parsing from item of type "${nodeType}" is not currently supported.`
      );
  }

  return parsedTables;
};

const parseFromClause = (fromItems: FromItem[], context: Context): Context => {
  // Each FromItem specifies one or more source tables. The nullability of each table's columns may
  // be affected by how the tables are joined (i.e. outer joins cause some of the tables' columns
  // to potentially be null if the join condition is not met). Multiple FromItems may be specified,
  // in which case the result is a cartesian product of all the FromItems. Any changes to the
  // nullability of the columns is specific to each individual FromItem -- because it's a cartesian
  // product, an outer join inside of one FromItem will not affect the nullability of columns inside
  // another From Item.
  const parsedTables: ParsedTable[] = [];
  for (const fromItem of fromItems) {
    parsedTables.push(...parseFromItem(fromItem, [], context));
  }

  const clonedContext = clone(context);

  return {
    ...clonedContext,
    tables: parsedTables.reduce(
      (acc, parsedTable) => {
        acc[parsedTable.alias] = parsedTable.nullable
          ? Object.keys(parsedTable.columns).reduce(
              (acc, columnName) => {
                const column = parsedTable.columns[columnName];
                acc.columns[columnName] = { ...column, nullable: true };
                return acc;
              },
              { columns: {}, nullable: parsedTable.nullable } as Table
            )
          : parsedTable;

        return acc;
      },
      { ...clonedContext.tables }
    ),
  };
};

const parseCommonTableExpr = (
  {
    CommonTableExpr: { aliascolnames = [], ctename, ctequery },
  }: CommonTableExpr,
  context: Context
): void => {
  context.tablesBySchema[context.defaultSchema][ctename] = {
    columns: parseStmt(ctequery, context).reduce((acc, resultTarget, index) => {
      const columnName = aliascolnames[index]?.String.str ?? resultTarget.name;
      acc[columnName] = {
        nullable: resultTarget.nullable,
        type: resultTarget.type,
      };

      return acc;
    }, {} as Record<string, Column>),
    nullable: false,
  };
};

const parseWithClause = ({ ctes }: WithClause, context: Context): Context => {
  let clonedContext = clone(context);
  for (const cte of ctes) {
    parseCommonTableExpr(cte, clonedContext);
  }

  return clonedContext;
};

const parseDeleteStmt = (
  { DeleteStmt: { relation, returningList } }: DeleteStmt,
  context: Context
): ParsedResultTarget[] => {
  const clonedContext = clone(context);
  const schema = relation.schemaname ?? context.defaultSchema;
  const tableName = relation.alias?.aliasname ?? relation.relname;
  const table = context.tablesBySchema[schema][relation.relname];
  clonedContext.tables[tableName] = table;

  return parseTargetList(returningList ?? [], clonedContext);
};

const parseInsertStmt = (
  { InsertStmt: { returningList, relation } }: InsertStmt,
  context: Context
): ParsedResultTarget[] => {
  const clonedContext = clone(context);
  const schema = relation.schemaname ?? context.defaultSchema;
  const tableName = relation.alias?.aliasname ?? relation.relname;
  const table = context.tablesBySchema[schema][relation.relname];
  clonedContext.tables[tableName] = table;

  return parseTargetList(returningList ?? [], clonedContext);
};

const parseSelectStmt = (
  { SelectStmt: stmt }: SelectStmt,
  context: Context
): ParsedResultTarget[] => {
  if ("valuesLists" in stmt) {
    const lists = stmt.valuesLists.map((valuesList) => {
      return valuesList.List.items.map((item) => {
        return parseExpression(item, context);
      });
    });

    return lists[0].map((_, index) => {
      const types = lists.map((list) => list[index]);

      return {
        name: `column${index + 1}`,
        nullable: types.some((type) => type.nullable),
        type: types[0].type,
        types,
      };
    });
  } else if ("larg" in stmt) {
    const larg = parseSelectStmt({ SelectStmt: stmt.larg }, context);
    const rarg = parseSelectStmt({ SelectStmt: stmt.rarg }, context);

    const resultTargets: ParsedResultTarget[] = [];
    for (let index = 0; index < larg.length; index++) {
      const lResult = larg[index];
      const rResult = rarg[index];
      const set: ParsedExpression[] = [];
      if (lResult.set && rResult.set) {
        set.push(...lResult.set, ...rResult.set);
      } else if (lResult.set) {
        set.push(...lResult.set, rResult);
      } else if (rResult.set) {
        set.push(lResult, ...rResult.set);
      } else {
        set.push(lResult, rResult);
      }
      resultTargets.push({
        name: lResult.name,
        nullable: lResult.nullable || rResult.nullable,
        type: lResult.type,
        set,
      });
    }
    return resultTargets;
  } else {
    const { fromClause, targetList, withClause } = stmt;
    const contextWithWith = withClause
      ? parseWithClause(withClause, context)
      : context;
    const contextWithFrom = fromClause
      ? parseFromClause(fromClause, contextWithWith)
      : contextWithWith;

    return parseTargetList(targetList ?? [], contextWithFrom);
  }
};

const parseUpdateStmt = (
  { UpdateStmt: { relation, returningList } }: UpdateStmt,
  context: Context
): ParsedResultTarget[] => {
  const clonedContext = clone(context);
  const schema = relation.schemaname ?? context.defaultSchema;
  const tableName = relation.alias?.aliasname ?? relation.relname;
  const table = context.tablesBySchema[schema][relation.relname];
  clonedContext.tables[tableName] = table;

  return parseTargetList(returningList ?? [], clonedContext);
};

const parseStmt = (stmt: Stmt, context: Context): ParsedResultTarget[] => {
  const nodeType = getFirstKey(stmt);
  switch (nodeType) {
    case "DeleteStmt":
      return parseDeleteStmt(stmt as DeleteStmt, context);
    case "InsertStmt":
      return parseInsertStmt(stmt as InsertStmt, context);
    case "SelectStmt":
      return parseSelectStmt(stmt as SelectStmt, context);
    case "UpdateStmt":
      return parseUpdateStmt(stmt as UpdateStmt, context);
    default: {
      throw new Error(
        `Parsing statement of type ${nodeType} is not currently supported.`
      );
    }
  }
};

const parseRawStmt = (
  { RawStmt: { stmt } }: RawStmt,
  context: Context
): ParsedResultTarget[] => {
  return parseStmt(stmt, context);
};

const parseQuery = (
  query: string,
  context: Context,
  prettierOptions?: PrettierOptions
): { results: string[] } | { error: unknown } => {
  try {
    const rawStmts = parse(query) as RawStmt[];

    return {
      results: rawStmts.map((rawStmt) => {
        return format(parseRawStmt(rawStmt, context), context, {
          ...prettierOptions,
          parser: "typescript",
        });
      }),
    };
  } catch (error) {
    return { error };
  }
};

const formatExpression = (
  { constantValue, name, nullable, type, types }: ParsedExpression,
  { formatFunc, mapType }: Context
): string => {
  const tsTypes = types
    ? types.map(
        (expression) => expression.constantValue ?? mapType(expression.type)
      )
    : [constantValue ?? mapType(type)];

  if (nullable) {
    tsTypes.push("null");
  }

  const tsUnionType = unique(tsTypes).join(" | ");

  return formatFunc(name || "", tsUnionType);
};

const format = (
  resultTargets: ParsedResultTarget[],
  context: Context,
  options?: PrettierOptions
): string => {
  let source = "{[K in any]: never}";

  if (resultTargets.length) {
    if (resultTargets.every(({ set }) => set)) {
      source = resultTargets[0]
        .set!.map((_, index) => {
          return [
            "{",
            ...resultTargets.map(({ set }) => {
              return formatExpression(set![index], context);
            }),
            "}",
          ].join(" ");
        })
        .join(" | ");
    } else {
      source = [
        "{",
        ...resultTargets.map((expression) => {
          return formatExpression(expression, context);
        }),
        "}",
      ].join(" ");
    }
  }

  // Prettier expects valid TypeScript, but we want to explicitly return just type structure, so
  // we append a type name and then remove it after formatting is applied.
  const formatted = prettierFormat("type T = " + source, options);
  return formatted.replace(/^type T\s*=\s*/, "").trim();
};

export const getTablesBySchema = async (
  pool: Pool,
  context: Context
): Promise<TablesBySchema> => {
  const { rows: columnQueryResult } = await pool.query(`
    SELECT
      c.table_schema "schema",
      c.table_name "table",
      c.column_name "column",
      CASE
        WHEN c.data_type = 'ARRAY' THEN c.udt_name::regtype::text
        ELSE c.udt_name
      END "type",
      c.is_nullable = 'YES' nullable
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t ON
      c.table_schema = t.table_schema
      AND c.table_name = t.table_name
    WHERE
      c.table_schema NOT IN ('pg_catalog', 'information_schema')
  `);
  const tablesBySchema = columnQueryResult.reduce<TablesBySchema>(
    (acc, row) => {
      if (!acc[row.schema]) {
        acc[row.schema] = {};
      }
      if (!acc[row.schema][row.table]) {
        acc[row.schema][row.table] = {
          columns: {},
          nullable: false,
        };
      }
      acc[row.schema][row.table].columns[row.column] = {
        nullable: row.nullable,
        type: row.type,
      };

      return acc;
    },
    {}
  );

  // Add views and materialized views
  const { rows: views } = await pool.query(`
    SELECT
      v.schemaname "schema",
      v.viewname "name",
      v.definition
    FROM pg_views v
    WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
    UNION
    SELECT
      mv.schemaname "schema",
      mv.matviewname "name",
      mv.definition
    FROM pg_matviews mv
    WHERE mv.schemaname NOT IN ('pg_catalog', 'information_schema');
  `);
  for (const { schema, name, definition } of views) {
    if (!tablesBySchema[schema]) {
      tablesBySchema[schema] = {};
    }

    const resultTargets = parseRawStmt(parse(definition)[0], {
      ...context,
      tablesBySchema,
    });
    tablesBySchema[schema][name] = {
      columns: resultTargets.reduce((acc, resultTarget) => {
        acc[resultTarget.name] = {
          nullable: resultTarget.nullable,
          type: resultTarget.type,
        };

        return acc;
      }, {} as Record<string, Column>),
      nullable: false,
    };
  }

  // Ensure the map for the default schema exists since this is where we write CTEs to
  if (!tablesBySchema[context.defaultSchema]) {
    tablesBySchema[context.defaultSchema] = {};
  }

  return tablesBySchema;
};

const getTypeMapper = async (
  pool: Pool,
  customTypeMap: Record<string, string>,
  fallbackType: string
): Promise<(pgType: string) => string> => {
  const { rows: enumQueryResult } = await pool.query(`
    SELECT
      typname "pgType",
      array_to_string(array(
        SELECT '"' || enumlabel || '"'
        FROM pg_catalog.pg_enum e
        WHERE e.enumtypid = t.oid
        ORDER BY e.enumsortorder
      ), ' | ') "tsType"
    FROM pg_catalog.pg_type t
    WHERE t.typtype = 'e'
  `);
  const enums = enumQueryResult.reduce((acc, { pgType, tsType }) => {
    acc[pgType] = tsType;

    return acc;
  }, {} as Record<string, string>);

  // Note: the version of libpg_query currently used does not recognize serial types so we have to
  // explicitly define mappings for all aliases (i.e. both serial and serial4).
  return (pgType: string): string => {
    const tsType =
      {
        any: "any",
        bool: "boolean",
        bigserial: "number",
        bit: "string",
        bpchar: "string",
        bytea: "Buffer",
        cidr: "string",
        citext: "string",
        circle: "string",
        date: "string",
        decimal: "number",
        float2: "number",
        float4: "number",
        float8: "number",
        int2: "number",
        int4: "number",
        int8: "number",
        inet: "string",
        interval: "string",
        json: "any",
        jsonb: "any",
        line: "string",
        lseg: "string",
        macaddr: "string",
        macaddr8: "string",
        money: "string",
        null: "null",
        numeric: "number",
        oid: "number",
        path: "string",
        point: "string",
        polygon: "string",
        serial: "number",
        serial2: "number",
        serial4: "number",
        serial8: "number",
        smallserial: "number",
        text: "string",
        time: "string",
        timestamp: "string",
        timestamptz: "string",
        timetz: "string",
        tsquery: "string",
        tsvector: "string",
        unknown: "unknown",
        uuid: "string",
        varbit: "string",
        varchar: "string",
        xml: "string",
        ...enums,
        ...customTypeMap,
      }[getElementType(pgType)] || fallbackType;

    return isArray(pgType) ? `Array<${tsType}>` : tsType;
  };
};

export const createTypeGenerator = async ({
  connectionString,
  defaultSchema = "public",
  fallbackType = "string",
  formatFunc = (name, tsType) => `"${name}": ${tsType},`,
  prettierOptions,
  typeMap = {},
}: CreateTypeGeneratorOptions): Promise<TypeGenerator> => {
  const pool = new Pool({
    connectionString,
  });
  let tablesBySchema, mapType;
  try {
    mapType = await getTypeMapper(pool, typeMap, fallbackType);
    tablesBySchema = await getTablesBySchema(pool, {
      tables: {},
      defaultSchema,
      fallbackType,
      formatFunc,
      mapType,
      tablesBySchema: {},
    });
  } finally {
    await pool.end();
  }
  const context: Context = {
    tables: {},
    defaultSchema,
    fallbackType,
    formatFunc,
    mapType,
    tablesBySchema,
  };

  return {
    generate: (query) => {
      return parseQuery(query, context, prettierOptions);
    },
  };
};
