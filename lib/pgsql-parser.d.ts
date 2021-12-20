declare module "pgsql-parser" {
  export type A_ArrayExpr = {
    A_ArrayExpr: {
      elements: Expression[];
    };
  };

  export type A_Const = {
    A_Const: {
      val: Integer | Float | Null | String;
    };
  };

  export type A_Expr = {
    A_Expr: {
      kind: A_Expr_Kind;
      lexpr: Expression;
      name: String[];
      rexpr: Expression;
    };
  };

  export type A_Expr_Kind =
    | "AEXPR_OP"
    | "AEXPR_OP_ANY"
    | "AEXPR_OP_ALL"
    | "AEXPR_IN"
    | "AEXPR_DISTINCT"
    | "AEXPR_NOT_DISTINCT"
    | "AEXPR_NULLIF"
    | "AEXPR_LIKE"
    | "AEXPR_ILIKE"
    | "AEXPR_SIMILAR"
    | "AEXPR_BETWEEN"
    | "AEXPR_NOT_BETWEEN"
    | "AEXPR_BETWEEN_SYM"
    | "AEXPR_NOT_BETWEEN_SYM";

  export type A_Indices = {
    A_Indices: {
      is_slice?: true;
      lidx?: Expression;
      uidx?: Expression;
    };
  };

  export type A_Indirection = {
    A_Indirection: {
      arg: Expression;
      indirection: A_Indices[];
    };
  };

  export type A_Star = {
    A_Star: {};
  };

  export type Alias = {
    aliasname: string;
    colnames?: String[];
  };

  export type BoolExpr = {
    BoolExpr: {
      args: Expression[];
      boolop: BoolExprType;
    };
  };

  export type BoolExprType = "AND_EXPR" | "OR_EXPR" | "NOT_EXPR";

  export type BoolTest = {
    BoolTest: {
      arg: Expression;
      booltesttype: BoolTestType;
    };
  };

  export type BoolTestType =
    | "IS_TRUE"
    | "IS_NOT_TRUE"
    | "IS_FALSE"
    | "IS_NOT_FALSE"
    | "IS_UNKNOWN"
    | "IS_NOT_UNKNOWN";

  export type CaseExpr = {
    CaseExpr: {
      args: CaseWhen[];
      defresult?: Expression;
    };
  };

  export type CaseWhen = {
    CaseWhen: {
      expr: Expression;
      result: Expression;
    };
  };

  export type CoalesceExpr = {
    CoalesceExpr: {
      args: Expression[];
    };
  };

  export type ColumnRef = {
    ColumnRef: {
      fields: [A_Star] | [String] | [String, String] | [String, A_Star];
    };
  };

  export type CommonTableExpr = {
    CommonTableExpr: {
      ctename: string;
      aliascolnames?: String[];
      ctequery: DeleteStmt | InsertStmt | SelectStmt | UpdateStmt;
    };
  };

  export type DeleteStmt = {
    DeleteStmt: {
      relation: RangeVar["RangeVar"];
      returningList?: ResTarget[];
    };
  };

  export type Expression =
    | A_ArrayExpr
    | A_Const
    | A_Expr
    | A_Indirection
    | BoolExpr
    | BoolTest
    | CaseExpr
    | CoalesceExpr
    | ColumnRef
    | FuncCall
    | List
    | MinMaxExpr
    | NullTest
    | ParamRef
    | SQLValueFunction
    | SubLink
    | TypeCast;

  export type Float = {
    Float: {
      str: string;
    };
  };

  export type FromItem = JoinExpr | RangeVar | RangeSubselect;

  export type FuncCall = {
    FuncCall: {
      funcname: String[];
      args: Expression[];
      agg_star?: true;
    };
  };

  export type InsertStmt = {
    InsertStmt: {
      relation: RangeVar["RangeVar"];
      onConflictClause?: OnConflictClause;
      returningList?: ResTarget[];
    };
  };

  export type Integer = {
    Integer: {
      ival: number;
    };
  };

  export type JoinExpr = {
    JoinExpr: {
      jointype: JoinType;
      larg: FromItem;
      rarg: FromItem;
    };
  };

  export type JoinType =
    | "JOIN_INNER"
    | "JOIN_LEFT"
    | "JOIN_FULL"
    | "JOIN_RIGHT";

  export type List = {
    List: {
      items: Expression[];
    };
  };

  export type MinMaxExpr = {
    MinMaxExpr: {
      op: MinMaxOp;
      args: Expression[];
    };
  };

  export type MinMaxOp = "IS_GREATEST" | "IS_LEAST";

  export type Null = {
    Null: {
      [K in any]: never;
    };
  };

  export type NullTest = {
    NullTest: {
      arg: Expression;
      nulltesttype: NullTestType;
    };
  };

  export type NullTestType = "IS_NULL" | "IS_NOT_NULL";

  export type OnConflictAction =
    | "ONCONFLICT_NONE"
    | "ONCONFLICT_NOTHING"
    | "ONCONFLICT_UPDATE";

  export type OnConflictClause = {
    action: OnConflictAction;
  };

  export type ParamRef = {
    ParamRef: {
      number: number;
    };
  };

  export type ResTarget = {
    ResTarget: {
      name?: string;
      location: number;
      val: Expression;
    };
  };

  export type RangeSubselect = {
    RangeSubselect: {
      alias: Alias;
      subquery: SelectStmt;
    };
  };

  export type RangeVar = {
    RangeVar: {
      alias?: Alias;
      relname: string;
      schemaname?: string;
    };
  };

  export type RawStmt = {
    RawStmt: {
      stmt: Stmt;
    };
  };

  export type SelectStmt = {
    SelectStmt:
      | {
          targetList?: ResTarget[];
          fromClause?: FromItem[];
          withClause?: WithClause;
        }
      | { larg: SelectStmt["SelectStmt"]; rarg: SelectStmt["SelectStmt"] }
      | { valuesLists: List[] };
  };

  export type SQLValueFunction = {
    SQLValueFunction: {
      op: SQLValueFunctionOp;
    };
  };

  export type SQLValueFunctionOp =
    | "SVFOP_CURRENT_DATE"
    | "SVFOP_CURRENT_TIME"
    | "SVFOP_CURRENT_TIME_N"
    | "SVFOP_CURRENT_TIMESTAMP"
    | "SVFOP_CURRENT_TIMESTAMP_N"
    | "SVFOP_LOCALTIME"
    | "SVFOP_LOCALTIME_N"
    | "SVFOP_LOCALTIMESTAMP"
    | "SVFOP_LOCALTIMESTAMP_N"
    | "SVFOP_CURRENT_ROLE"
    | "SVFOP_CURRENT_USER"
    | "SVFOP_USER"
    | "SVFOP_SESSION_USER"
    | "SVFOP_CURRENT_CATALOG"
    | "SVFOP_CURRENT_SCHEMA";

  export type String = {
    String: {
      str: string;
    };
  };

  export type Stmt = DeleteStmt | InsertStmt | SelectStmt | UpdateStmt;

  export type SubLink = {
    SubLink: {
      subLinkType: SubLinkType;
      subselect: SelectStmt;
      testexpr?: Expression;
      operName?: String[];
    };
  };

  export type SubLinkType =
    | "EXISTS_SUBLINK"
    | "ALL_SUBLINK"
    | "ANY_SUBLINK"
    | "ROWCOMPARE_SUBLINK"
    | "EXPR_SUBLINK"
    | "MULTIEXPR_SUBLINK"
    | "ARRAY_SUBLINK";

  export type TypeCast = {
    TypeCast: {
      arg: Expression;
      typeName: TypeName;
    };
  };

  export type TypeName = {
    arrayBounds?: Integer[];
    names?: String[];
  };

  export type UpdateStmt = {
    UpdateStmt: {
      relation: RangeVar["RangeVar"];
      returningList?: ResTarget[];
    };
  };

  export type WithClause = {
    ctes: CommonTableExpr[];
  };

  export function deparse(source: any): string;

  export function parse(source: string): RawStmt[];
}
