# Migration strategy

## Additive release sequence

1. Add enums and new dimension/version/approval/import tables.
2. Add nullable organizational foreign keys and FTE fields to existing department, team, position, and assignment records.
3. Seed one default legal entity, business unit, location, cost center, job family, job profile, and grade per organization.
4. Backfill existing structures and assignments into those defaults using deterministic codes.
5. Map existing active positions to `APPROVED`/`OPEN`/`FILLED` according to effective occupancy.
6. Create position-occupancy rows or derive them from assignment history and validate reconciliation.
7. Deploy compatibility reads/writes that support legacy and enriched records.
8. Validate null counts, organization consistency, hierarchy cycles, date overlaps, and capacity.
9. Add constraints only after staging and production backfills pass.

No legacy table or column is removed in this delivery unit.

## Proposed data model

New models:

- `HrLegalEntity`
- `HrBusinessUnit`
- `HrDivision`
- `HrLocation`
- `HrCostCenter`
- `HrJobFamily`
- `HrJobProfile`
- `HrGrade`
- `HrPositionApproval`
- `HrPositionOccupancy`
- `HrOrganizationChange`
- `HrOrganizationImportBatch` and row/error records

Expanded models:

- Department: division, parent department, manager position, cost center, effective interval.
- Team: parent team, manager position, effective interval.
- Position: all organization dimensions, job profile, grade, reporting position, state, headcount/FTE/budget, effective interval, optimistic version.
- Employee assignment: organization dimensions, primary flag, FTE, immutable placement snapshot, optimistic version.

For records whose identity must survive revisions, introduce a stable business identity plus version rows rather than updating effective-dated attributes in place.

## Constraints and indexes

- Organization-qualified unique codes.
- Effective-date and status indexes for every dimension.
- Organization-qualified relation validation in commands; use composite database relationships where practical.
- Check constraints for positive headcount, `0 < FTE <= configured maximum`, valid salary ranges, and `effectiveTo > effectiveFrom`.
- Serializable capacity checks and optimistic version columns.
- PostgreSQL exclusion constraints for non-overlapping effective intervals where Prisma migrations can safely express them as reviewed SQL.

## Migration verification

The migration test must start from the pre-Unit-2 schema with representative legacy organizations, active/ended assignments, empty organizations, archived structures, and occupied positions. It must apply the migration and verify counts, stable IDs, default mappings, position status, occupancy reconciliation, organization isolation, and rollback compatibility.
