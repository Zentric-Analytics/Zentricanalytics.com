import type { Prisma } from "@prisma/client";

type UserReference = {
  tableName: string;
  columnName: string;
  isNullable: "YES" | "NO";
  deleteRule: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
};

export type UserReferenceRelease = {
  detached: number;
  reassigned: number;
};

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error("Unsafe database identifier.");
  }
  return `"${identifier}"`;
}

/**
 * Leaves CASCADE and SET NULL relationships to PostgreSQL. Restrictive,
 * optional links are detached and mandatory ownership links are transferred
 * to the acting primary administrator before the physical user-row deletion.
 */
export async function releaseHrUserReferencesForDeletion(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  primaryAdminId: string,
): Promise<UserReferenceRelease> {
  const references = await tx.$queryRaw<UserReference[]>`
    SELECT
      tc.table_name AS "tableName",
      kcu.column_name AS "columnName",
      cols.is_nullable AS "isNullable",
      rc.delete_rule AS "deleteRule"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.constraint_schema = ccu.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = tc.table_schema
      AND cols.table_name = tc.table_name
      AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'HrUser'
      AND ccu.column_name = 'id'
      AND rc.delete_rule NOT IN ('CASCADE', 'SET NULL')
  `;

  let detached = 0;
  let reassigned = 0;

  for (const reference of references) {
    const table = quoteIdentifier(reference.tableName);
    const column = quoteIdentifier(reference.columnName);
    if (reference.isNullable === "YES") {
      detached += await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`,
        targetUserId,
      );
    } else {
      reassigned += await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
        primaryAdminId,
        targetUserId,
      );
    }
  }

  return { detached, reassigned };
}
