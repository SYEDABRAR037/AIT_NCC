#!/usr/bin/env node
/**
 * NCC AIT — Local-Only Runner for Render Schema Inspection
 * 
 * Safety guarantees:
 * - Reads DATABASE_URL strictly in memory from backend/.env.
 * - Never prints or logs connection strings, passwords, hostnames, usernames, or database names.
 * - Confirms SQL file exists, begins with 'BEGIN READ ONLY;', and ends with 'ROLLBACK;'.
 * - Executes strictly via `psql -X -v ON_ERROR_STOP=1`.
 * - Writes query output to Git-ignored backend/render_inspection_output.log.
 * - Never writes raw stderr or connection error messages to disk.
 * - Prints only generic success or 'INSPECTION_FAILED' with a numeric exit status.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawnSync } = require('child_process');

function run() {
  // 1. Path-agnostic resolution (works from repository root OR backend directory)
  const inBackend = fs.existsSync(path.resolve('.env')) && fs.existsSync(path.resolve('prisma'));
  const projectRoot = inBackend ? path.resolve('..') : path.resolve('.');
  const envPath = path.resolve(projectRoot, 'backend/.env');
  const sqlPath = path.resolve(projectRoot, 'backend/prisma/inspect_schema_and_migrations_final.sql');
  const outputPath = path.resolve(projectRoot, 'backend/render_inspection_output.log');

  // 2. Validate prerequisites
  if (!fs.existsSync(envPath)) {
    console.error('INSPECTION_FAILED: Environment file missing');
    process.exit(1);
  }

  if (!fs.existsSync(sqlPath)) {
    console.error('INSPECTION_FAILED: SQL inspection script missing');
    process.exit(1);
  }

  // 3. Inspect SQL file content for strict transaction boundaries
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const normalizedSql = sqlContent.replace(/--.*$/gm, '').trim();

  if (!normalizedSql.startsWith('BEGIN READ ONLY;')) {
    console.error('INSPECTION_FAILED: SQL file does not begin with BEGIN READ ONLY;');
    process.exit(1);
  }

  if (!normalizedSql.endsWith('ROLLBACK;')) {
    console.error('INSPECTION_FAILED: SQL file does not end with ROLLBACK;');
    process.exit(1);
  }

  // 4. In-memory read of DATABASE_URL (never logged or printed)
  const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  const rawDatabaseUrl = envConfig.DATABASE_URL;

  if (!rawDatabaseUrl) {
    console.error('INSPECTION_FAILED: DATABASE_URL not configured');
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawDatabaseUrl);
  } catch {
    console.error('INSPECTION_FAILED: Invalid database connection format');
    process.exit(1);
  }

  if (!['postgresql:', 'postgres:'].includes(parsedUrl.protocol)) {
    console.error('INSPECTION_FAILED: Protocol must be postgresql');
    process.exit(1);
  }

  // 5. Build in-memory libpq environment (prevents credentials in ps aux / CLI args)
  const psqlEnv = {
    ...process.env,
    PGHOST: parsedUrl.hostname,
    PGPORT: parsedUrl.port || '5432',
    PGDATABASE: parsedUrl.pathname.replace(/^\//, ''),
    PGUSER: decodeURIComponent(parsedUrl.username || ''),
    PGPASSWORD: decodeURIComponent(parsedUrl.password || ''),
    PGSSLMODE: parsedUrl.searchParams.get('sslmode') || 'require',
  };

  // 6. Execute psql with fail-stop ON_ERROR_STOP=1
  const execution = spawnSync('psql', [
    '-X',
    '-v', 'ON_ERROR_STOP=1',
    '-f', sqlPath
  ], {
    env: psqlEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // 7. Handle output: save stdout to Git-ignored output file
  if (execution.stdout && execution.stdout.length > 0) {
    fs.writeFileSync(outputPath, execution.stdout);
  }

  // 8. Error classification: classify in memory without exposing raw stderr or credentials
  function classifyError(stderrStr) {
    if (!stderrStr || stderrStr.trim().length === 0) return 'NO_STDERR_CAPTURED';
    const lower = stderrStr.toLowerCase();
    
    if (lower.includes('timed out') || lower.includes('timeout')) {
      return 'CONNECTION_TIMEOUT (server unreachable, firewalled, or instance suspended)';
    }
    if (lower.includes('connection refused')) {
      return 'CONNECTION_REFUSED (server not listening on port 5432 or service stopped)';
    }
    if (lower.includes('could not translate host name') || lower.includes('nodename nor servname provided')) {
      return 'DNS_RESOLUTION_FAILURE (hostname resolution failed)';
    }
    if (lower.includes('password authentication failed')) {
      return 'AUTHENTICATION_FAILURE (invalid credentials)';
    }
    if (lower.includes('does not exist') && lower.includes('database')) {
      return 'DATABASE_NOT_FOUND (database does not exist on target)';
    }
    if (lower.includes('role') && lower.includes('does not exist')) {
      return 'USER_ROLE_NOT_FOUND (user role does not exist on target)';
    }
    if (lower.includes('ssl') || lower.includes('tls') || lower.includes('handshake')) {
      return 'SSL_HANDSHAKE_FAILURE (SSL negotiation error)';
    }
    if (lower.includes('server closed the connection unexpectedly') || lower.includes('connection reset')) {
      return 'SERVER_CLOSED_CONNECTION (server closed connection; possibly expired or suspended instance)';
    }
    if (lower.includes('no route to host') || lower.includes('network is unreachable')) {
      return 'NETWORK_UNREACHABLE (routing or network interface error)';
    }
    return 'GENERIC_CONNECTION_FAILURE (psql exit code 2: connection could not be established)';
  }

  // 9. Process completion & diagnostic handling
  if (execution.status === 0) {
    console.log('INSPECTION_COMPLETED_SUCCESSFULLY');
    console.log('Results written to: backend/render_inspection_output.log');
    process.exit(0);
  } else {
    // Never write raw stderr to disk or print connection details
    console.error(`INSPECTION_FAILED: Exit code ${execution.status !== null ? execution.status : 'UNKNOWN'}`);
    
    const isDiagnose = process.argv.includes('--diagnose');
    const rawStderr = execution.stderr ? execution.stderr.toString('utf8') : '';
    const category = classifyError(rawStderr);
    
    // Always print safe category if in diagnostic mode or upon connection failure (code 2)
    if (isDiagnose || execution.status === 2) {
      console.error(`DIAGNOSTIC_CATEGORY: ${category}`);
    }
    
    process.exit(execution.status || 1);
  }
}

run();
