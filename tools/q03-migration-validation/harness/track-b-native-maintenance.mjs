const owner = 'q03_replacement_owner';
const target = 'q03_replacement_track_b';

/**
 * Fixed psql program for a separately authorized host supervisor. It must be
 * sent to one local maintenance session with ON_ERROR_STOP and exclusive
 * durable host reservation. The runner never receives this program or identity.
 */
export function nativeMaintenanceCreationProgram(clusterId) {
  if (typeof clusterId !== 'string' || !/^[0-9]{16,24}$/.test(clusterId)) {
    throw Error('NATIVE_MAINTENANCE_CLUSTER_REJECTED');
  }
  return `SET statement_timeout = '20s';
SET lock_timeout = '12s';
SELECT (current_database() = 'postgres'
  AND session_user = 'postgres' AND current_user = session_user
  AND inet_server_addr() IS NULL AND inet_client_addr() IS NULL
  AND current_setting('server_version_num') = '180006'
  AND (SELECT system_identifier::text FROM pg_control_system()) = '${clusterId}'
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${owner}'
    AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls)
  AND pg_try_advisory_lock(196014713, 13)
  AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${target}')) IS TRUE AS approved_create \\gset
\\if :approved_create
CREATE DATABASE "${target}" OWNER "${owner}" TEMPLATE template0;
\\else
SELECT 1/0;
\\endif
SELECT (EXISTS (SELECT 1 FROM pg_database WHERE datname = '${target}'
  AND pg_get_userbyid(datdba) = '${owner}')) AS verified_create \\gset
\\if :verified_create
\\else
SELECT 1/0;
\\endif
`;
}
