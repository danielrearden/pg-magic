import { generate } from "../lib";

const generateOne = async (source: string) => {
  const { query } = await generate({
    connectionString: process.env.POSTGRES_DSN || "",
    queriesByKey: { query: source },
  });

  if ("error" in query) {
    throw query.error;
  }

  return query.results[0];
};

describe("generate", () => {
  beforeAll(async () => {
    if (!process.env.POSTGRES_DSN) {
      throw new Error(
        "Must set POSTGRES_DSN environment variable to run tests"
      );
    }
  });

  test("constant values", async () => {
    expect(
      await generateOne(`
        SELECT
          true a,
          false b,
          null c,
          42 d,
          4.2 e,
          'Lorem ipsum dolor sit amet' f
      `)
    ).toMatchInlineSnapshot(`
      "{
        a: true;
        b: false;
        c: null;
        d: 42;
        e: 4.2;
        f: \\"Lorem ipsum dolor sit amet\\";
      };"
    `);
  });

  test("type casts", async () => {
    expect(
      await generateOne(`
        SELECT
          'abc'::text a,
          cast(42 AS bigint) b
      `)
    ).toMatchInlineSnapshot(`"{ a: \\"abc\\"; b: 42 };"`);
  });

  test("case expression", async () => {
    expect(
      await generateOne(`
        SELECT
          CASE
            WHEN 'z' = 'a' THEN 100
            WHEN 'x' = 'b' THEN 90
            WHEN 'y' = 'c' THEN 80
          END a,
          CASE
            WHEN 'z' = 'a' THEN 100
            WHEN 'x' = 'b' THEN 90
            WHEN 'y' = 'c' THEN 80
            ELSE 70
          END b,
          CASE 'z'
            WHEN 'a' THEN 100
            WHEN 'b' THEN 90
            WHEN 'c' THEN 80
          END c,
          CASE 'z'
            WHEN 'a' THEN 100
            WHEN 'b' THEN 90
            WHEN 'c' THEN 80
            ELSE 70
          END d
      `)
    ).toMatchInlineSnapshot(`
      "{
        a: 100 | 90 | 80 | null;
        b: 100 | 90 | 80 | 70;
        c: 100 | 90 | 80 | null;
        d: 100 | 90 | 80 | 70;
      };"
    `);
  });

  test("boolean expressions", async () => {
    expect(
      await generateOne(`
        SELECT
          true OR false a,
          true AND false b,
          NOT true c,
          ((true AND false) OR true) d
      `)
    ).toMatchInlineSnapshot(
      `"{ a: boolean; b: boolean; c: boolean; d: boolean };"`
    );
  });

  test("parameters", async () => {
    expect(
      await generateOne(`
        SELECT $1 a
      `)
    ).toMatchInlineSnapshot(`"{ a: any | null };"`);
  });

  test("coalesce", async () => {
    expect(
      await generateOne(`
        SELECT
          coalesce(postal_code, address) a,
          coalesce(postal_code, address2) b,
          coalesce(postal_code, 'x', 'y', 'z') c
        FROM address
      `)
    ).toMatchInlineSnapshot(
      `"{ a: string; b: string | null; c: string | \\"x\\" };"`
    );
  });

  test("operators", async () => {
    expect(
      await generateOne(`
        SELECT
          1 + 2 a,
          '12-30-21'::date - 1 b,
          1 / 2 c,
          'a' || 'b' || 'c' d,
          1 = 2 e
      `)
    ).toMatchInlineSnapshot(
      `"{ a: number; b: string; c: number; d: string; e: boolean };"`
    );
  });

  test("functions", async () => {
    expect(
      await generateOne(`
        SELECT
          abs(-1) a,
          ceil(1.2) b,
          floor(1.2) c,
          trunc(1.2) d,
          lower('ABC') e,
          upper('abc') f,
          concat('a', 'b', 'c') g,
          extract(hour from '2002-09-17 19:27:45'::timestamptz) h
      `)
    ).toMatchInlineSnapshot(`
      "{
        a: number;
        b: number;
        c: number;
        d: number;
        e: string;
        f: string;
        g: string;
        h: number;
      };"
    `);
  });

  test("aggregate functions", async () => {
    expect(
      await generateOne(`
        SELECT
          count(*) a,
          sum(length) b,
          min(length) c,
          max(length) d,
          avg(length) e
        FROM film
      `)
    ).toMatchInlineSnapshot(`
      "{
        a: number;
        b: number | null;
        c: number | null;
        d: number | null;
        e: number | null;
      };"
    `);
  });

  test("window functions", async () => {
    expect(
      await generateOne(`
        SELECT
          rank() OVER () a,
          percent_rank() OVER () b
        FROM film
      `)
    ).toMatchInlineSnapshot(`"{ a: number; b: number };"`);
  });

  test("other expressions", async () => {
    expect(
      await generateOne(`
        SELECT
          42 = ANY('{}'::int[]) a,
          42 = ALL('{}'::int[]) b,
          42 IN (1, 2, 3) c,
          42 NOT IN (1, 2, 3) d,
          'abc' LIKE 'xyz' e,
          'abc' NOT LIKE 'xyz' f,
          'abc' ILIKE 'xyz' g,
          'abc' NOT ILIKE 'xyz' h,
          0 IS DISTINCT FROM 1 k,
          0 IS NOT DISTINCT FROM 1 l,
          1 BETWEEN 2 AND 3 m,
          1 NOT BETWEEN 2 AND 3 n,
          NULLIF(0, 1) o,
          GREATEST(0, 1) p,
          LEAST(0, 1) q
      `)
    ).toMatchInlineSnapshot(`
      "{
        a: boolean;
        b: boolean;
        c: boolean;
        d: boolean;
        e: boolean;
        f: boolean;
        g: boolean;
        h: boolean;
        k: boolean;
        l: boolean;
        m: boolean;
        n: boolean;
        o: 0 | null;
        p: number;
        q: number;
      };"
    `);
  });

  test("select from table", async () => {
    expect(
      await generateOne(`
        SELECT
          address_id,
          address,
          address2
        FROM address
      `)
    ).toMatchInlineSnapshot(
      `"{ address_id: number; address: string; address2: string | null };"`
    );
  });

  test("select from view", async () => {
    expect(
      await generateOne(`
        SELECT
          id,
          "name",
          address,
          "zip code",
          phone,
          city,
          country,
          sid
        FROM staff_list
      `)
    ).toMatchInlineSnapshot(`
      "{
        id: number;
        name: string;
        address: string;
        \\"zip code\\": string | null;
        phone: string;
        city: string;
        country: string;
        sid: number;
      };"
    `);
  });

  test("star expression", async () => {
    expect(
      await generateOne(`
        SELECT
          *
        FROM customer c
        LEFT JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        store_id: number;
        address_id: number | null;
        active: number | null;
        customer_id: number;
        activebool: boolean;
        create_date: string;
        last_update: string | null;
        first_name: string;
        last_name: string;
        email: string | null;
        city_id: number | null;
        address: string | null;
        address2: string | null;
        district: string | null;
        postal_code: string | null;
        phone: string | null;
      };"
    `);
  });

  test("star column reference", async () => {
    expect(
      await generateOne(`
        SELECT
          c.*
        FROM customer c
        LEFT JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        store_id: number;
        address_id: number;
        active: number | null;
        customer_id: number;
        activebool: boolean;
        create_date: string;
        last_update: string | null;
        first_name: string;
        last_name: string;
        email: string | null;
      };"
    `);
  });

  test("aliases", async () => {
    expect(
      await generateOne(`
        SELECT
          address_id id,
          address addr,
          address2 addr2
        FROM address a1
      `)
    ).toMatchInlineSnapshot(
      `"{ id: number; addr: string; addr2: string | null };"`
    );
  });

  test("inner join", async () => {
    expect(
      await generateOne(`
        SELECT
          c.first_name,
          c.last_name,
          c.email,
          a.address,
          a.address2
        FROM customer c
        INNER JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        first_name: string;
        last_name: string;
        email: string | null;
        address: string;
        address2: string | null;
      };"
    `);
  });

  test("left join", async () => {
    expect(
      await generateOne(`
        SELECT
          c.first_name,
          c.last_name,
          c.email,
          a.address,
          a.address2
        FROM customer c
        LEFT JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        first_name: string;
        last_name: string;
        email: string | null;
        address: string | null;
        address2: string | null;
      };"
    `);
  });

  test("right join", async () => {
    expect(
      await generateOne(`
        SELECT
          c.first_name,
          c.last_name,
          c.email,
          a.address,
          a.address2
        FROM customer c
        RIGHT JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        address: string;
        address2: string | null;
      };"
    `);
  });

  test("full join", async () => {
    expect(
      await generateOne(`
        SELECT
          c.first_name,
          c.last_name,
          c.email,
          a.address,
          a.address2
        FROM customer c
        FULL JOIN address a ON c.address_id = a.address_id
      `)
    ).toMatchInlineSnapshot(`
      "{
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        address: string | null;
        address2: string | null;
      };"
    `);
  });

  test("multiple from items", async () => {
    expect(
      await generateOne(`
        SELECT
          c.first_name,
          c.last_name,
          c.email,
          a.address,
          a.address2
        FROM customer c, address a
      `)
    ).toMatchInlineSnapshot(`
      "{
        first_name: string;
        last_name: string;
        email: string | null;
        address: string;
        address2: string | null;
      };"
    `);
  });

  test("common table expressions", async () => {
    expect(
      await generateOne(`
        WITH person AS (
          SELECT
            c.first_name,
            c.last_name,
            c.email
          FROM customer c
        )
        SELECT
          p.*
        FROM person p
      `)
    ).toMatchInlineSnapshot(
      `"{ first_name: string; last_name: string; email: string | null };"`
    );
  });

  test("subqueries", async () => {
    expect(
      await generateOne(`
        SELECT
          1 = ANY(SELECT customer_id FROM customer) a,
          1 = ALL(SELECT customer_id FROM customer) b,
          EXISTS(SELECT * FROM customer) c,
          (SELECT customer_id FROM customer LIMIT 1) d
      `)
    ).toMatchInlineSnapshot(
      `"{ a: boolean | null; b: boolean | null; c: boolean; d: number | null };"`
    );
  });

  test("unions", async () => {
    expect(
      await generateOne(`
        SELECT
          'a' kind,
          42 count
        UNION
        SELECT
          'b' kind,
          null::int count
        UNION
        SELECT
          'c' kind,
          99 count
      `)
    ).toMatchInlineSnapshot(`
      "| { kind: \\"a\\"; count: 42 }
        | { kind: \\"b\\"; count: number | null }
        | { kind: \\"c\\"; count: 99 };"
    `);
  });

  test("values", async () => {
    expect(
      await generateOne(`
        VALUES ('foo', 1), ('bar', 2), (null::text, null::int4)
      `)
    ).toMatchInlineSnapshot(`
      "{
        column1: \\"foo\\" | \\"bar\\" | string | null;
        column2: 1 | 2 | number | null;
      };"
    `);
  });

  test("insert statement", async () => {
    expect(
      await generateOne(`
        INSERT INTO country AS c (country)
        VALUES ('nowhere')
        RETURNING c.*
      `)
    ).toMatchInlineSnapshot(
      `"{ country_id: number; last_update: string; country: string };"`
    );
  });

  test("update statement", async () => {
    expect(
      await generateOne(`
        UPDATE country
        SET country = 'nowhere'
        RETURNING country_id updated_id
      `)
    ).toMatchInlineSnapshot(`"{ updated_id: number };"`);
  });

  test("delete statement", async () => {
    expect(
      await generateOne(`
        DELETE FROM country
        RETURNING *
      `)
    ).toMatchInlineSnapshot(
      `"{ country_id: number; last_update: string; country: string };"`
    );
  });

  test("enums", async () => {
    expect(
      await generateOne(`
        SELECT
          rating,
          $1::mpaa_rating rating2
        FROM film
      `)
    ).toMatchInlineSnapshot(`
      "{
        rating: \\"G\\" | \\"PG\\" | \\"PG-13\\" | \\"R\\" | \\"NC-17\\" | null;
        rating2: \\"G\\" | \\"PG\\" | \\"PG-13\\" | \\"R\\" | \\"NC-17\\" | null;
      };"
    `);
  });

  test("arrays", async () => {
    expect(
      await generateOne(`
        SELECT
          '{}'::int4[] a,
          ARRAY[true, false] b,
          special_features c
        FROM film
      `)
    ).toMatchInlineSnapshot(
      `"{ a: Array<number>; b: Array<boolean>; c: Array<string> | null };"`
    );
  });

  test("array access", async () => {
    expect(
      await generateOne(`
        SELECT
          special_features[42] a,
          special_features[1:2] b,
          special_features[1:null] c
        FROM film
      `)
    ).toMatchInlineSnapshot(
      `"{ a: string | null; b: Array<string> | null; c: Array<string> | null };"`
    );
  });
});
