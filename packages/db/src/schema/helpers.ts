import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * Điều kiện CHECK "cột nằm trong tập giá trị cố định". Dùng thay cho pg enum vì thêm giá trị mới
 * vào CHECK chỉ cần một migration nhỏ, còn đổi pg enum thì rườm rà hơn nhiều.
 * Giá trị đến từ hằng số trong code (không phải input người dùng) nên nhúng thẳng là an toàn.
 */
export function oneOf(column: AnyColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => sql.raw(`'${value.replaceAll("'", "''")}'`));
  return sql`${column} in (${sql.join(literals, sql`, `)})`;
}
