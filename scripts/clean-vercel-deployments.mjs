#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = 'https://api.vercel.com';
const DEFAULT_KEEP = 10;
const DEFAULT_MIN_AGE_DAYS = 7;

function printHelp() {
  console.log(`Clean up old and failed Vercel deployments without deleting the current production deployment.

Usage:
  pnpm clean:vercel [options]
  pnpm clean:vercel:all [options]

Options:
  --all                    Clean every project in the account/team scope
  --yes                    Delete deployments (otherwise this is a dry run)
  --project <id-or-name>   Vercel project ID or name
  --team <id>              Vercel team ID (optional for personal projects)
  --keep <count>           Keep at least the newest deployments (default: ${DEFAULT_KEEP})
  --older-than <days>      Only delete deployments at least this old (default: ${DEFAULT_MIN_AGE_DAYS})
  --help                   Show this help

ERROR and CANCELED deployments are selected regardless of --keep and --older-than.

Environment variables:
  VERCEL_TOKEN             Required Vercel access token
  VERCEL_PROJECT_ID        Project ID or name (unless passed with --project)
  VERCEL_TEAM_ID           Team ID (unless passed with --team)

The root .env file is loaded automatically. If present, .vercel/project.json
supplies projectId and orgId automatically.

Examples:
  pnpm clean:vercel
  pnpm clean:vercel -- --keep 5 --older-than 2
  pnpm clean:vercel -- --keep 5 --older-than 2 --yes
  pnpm clean:vercel:all
  pnpm clean:vercel:all -- --yes`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function loadEnvironment() {
  try {
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`could not load .env: ${error.message}`);
    }
  }
}

function readNonNegativeInteger(value, option) {
  if (!/^\d+$/.test(value ?? '')) {
    throw new Error(`${option} must be a non-negative integer`);
  }

  return Number(value);
}

function parseArgs(argv) {
  const options = {
    all: false,
    confirm: false,
    help: false,
    keep: DEFAULT_KEEP,
    minAgeDays: DEFAULT_MIN_AGE_DAYS,
    project: process.env.VERCEL_PROJECT_ID,
    team: process.env.VERCEL_TEAM_ID,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--':
        break;
      case '--all':
        options.all = true;
        break;
      case '--yes':
        options.confirm = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--project':
        options.project = argv[++index];
        if (!options.project) throw new Error('--project requires a value');
        break;
      case '--team':
        options.team = argv[++index];
        if (!options.team) throw new Error('--team requires a value');
        break;
      case '--keep':
        options.keep = readNonNegativeInteger(argv[++index], '--keep');
        break;
      case '--older-than':
        options.minAgeDays = readNonNegativeInteger(argv[++index], '--older-than');
        break;
      default:
        throw new Error(`unknown option: ${argument}`);
    }
  }

  return options;
}

async function readLinkedProject() {
  try {
    return JSON.parse(await readFile(new URL('../.vercel/project.json', import.meta.url), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`could not read .vercel/project.json: ${error.message}`);
  }
}

async function vercelRequest(path, token, init = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? response.statusText;
    throw new Error(`Vercel API ${response.status}: ${message}`);
  }

  return body;
}

function withScope(params, team) {
  if (team) params.set('teamId', team);
  return params;
}

async function listDeployments({ project, team, token }) {
  const deployments = [];
  let until;

  do {
    const params = withScope(new URLSearchParams({ projectId: project, limit: '100' }), team);
    if (until) params.set('until', String(until));

    const page = await vercelRequest(`/v6/deployments?${params}`, token);
    deployments.push(...(page.deployments ?? []));
    until = page.pagination?.next;
  } while (until);

  return deployments.sort((left, right) => right.created - left.created);
}

function formatDeployment(deployment) {
  const created = new Date(deployment.created).toISOString();
  const environment = deployment.target ?? 'preview';
  const state = deployment.state ?? 'UNKNOWN';
  return `${deployment.uid}  ${environment.padEnd(10)}  ${state.padEnd(10)}  ${created}  ${deployment.url}`;
}

async function deleteDeployment(deployment, { team, token }) {
  const params = withScope(new URLSearchParams(), team);
  const query = params.size ? `?${params}` : '';
  await vercelRequest(`/v13/deployments/${encodeURIComponent(deployment.uid)}${query}`, token, {
    method: 'DELETE',
  });
}

async function main() {
  try {
    loadEnvironment();
  } catch (error) {
    fail(error.message);
    return;
  }

  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    printHelp();
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!process.env.VERCEL_TOKEN) {
    fail('VERCEL_TOKEN is required. Create an access token in your Vercel account settings.');
    return;
  }

  let linkedProject;
  try {
    linkedProject = await readLinkedProject();
  } catch (error) {
    fail(error.message);
    return;
  }

  const project = options.project ?? linkedProject.projectId;
  const team = options.team ?? linkedProject.orgId;

  if (!project) {
    fail('pass --project, set VERCEL_PROJECT_ID, or run `vercel link` first');
    return;
  }

  let deployments;
  try {
    deployments = await listDeployments({
      project,
      team,
      token: process.env.VERCEL_TOKEN,
    });
  } catch (error) {
    fail(error.message);
    return;
  }

  const newestProduction = deployments.find(
    (deployment) => deployment.target === 'production' && deployment.state === 'READY',
  );
  const protectedIds = new Set();
  if (newestProduction) protectedIds.add(newestProduction.uid);
  for (const deployment of deployments) {
    if (deployment.alias?.length > 0) protectedIds.add(deployment.uid);
  }

  const recentIds = new Set(deployments.slice(0, options.keep).map(({ uid }) => uid));
  const failedStates = new Set(['ERROR', 'CANCELED', 'CANCELLED']);
  const cutoff = Date.now() - options.minAgeDays * 24 * 60 * 60 * 1000;
  const candidates = deployments.filter(
    (deployment) =>
      !protectedIds.has(deployment.uid) &&
      (failedStates.has(deployment.state) ||
        (!recentIds.has(deployment.uid) && deployment.created <= cutoff)),
  );

  console.log(`Project: ${project}${team ? ` (team ${team})` : ''}`);
  console.log(
    `Found ${deployments.length} deployment(s); failed/canceled deployments are always selected, while successful deployments keep the ${options.keep} newest and those newer than ${options.minAgeDays} day(s).`,
  );

  if (candidates.length === 0) {
    console.log('No deployments match the cleanup criteria.');
    return;
  }

  console.log(
    `\n${options.confirm ? 'Deleting' : 'Would delete'} ${candidates.length} deployment(s) matching the cleanup criteria:`,
  );
  for (const deployment of candidates) console.log(`  ${formatDeployment(deployment)}`);

  if (!options.confirm) {
    console.log('\nDry run only. Re-run with --yes to delete the deployments listed above.');
    return;
  }

  let failures = 0;
  for (const deployment of candidates) {
    try {
      await deleteDeployment(deployment, {
        team,
        token: process.env.VERCEL_TOKEN,
      });
      console.log(`Deleted ${deployment.uid}`);
    } catch (error) {
      failures += 1;
      console.error(`Failed to delete ${deployment.uid}: ${error.message}`);
    }
  }

  if (failures > 0) {
    fail(`${failures} deployment(s) could not be deleted`);
    return;
  }

  console.log(`Cleanup complete: deleted ${candidates.length} deployment(s).`);
}

await main();
