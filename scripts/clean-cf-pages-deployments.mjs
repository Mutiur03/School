#!/usr/bin/env node

import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_KEEP = 10;
const DEFAULT_MIN_AGE_DAYS = 7;

function printHelp() {
  console.log(`Clean up old and failed Cloudflare Pages deployments without deleting the live production deployment.

Usage:
  pnpm clean:cf --project <name> [options]
  pnpm clean:cf:all [options]

Options:
  --all                    Clean every Pages project in the account
  --yes                    Delete deployments (otherwise this is a dry run)
  --project <name>         Pages project name
  --keep <count>           Keep at least the newest deployments (default: ${DEFAULT_KEEP})
  --older-than <days>      Only delete deployments at least this old (default: ${DEFAULT_MIN_AGE_DAYS})
  --help                   Show this help

Failed and canceled deployments are selected regardless of --keep and --older-than.
The live production deployment and branch-aliased deployments are never deleted.

Environment variables:
  CLOUDFLARE_API_TOKEN     Required API token with Pages:Edit
  CLOUDFLARE_ACCOUNT_ID    Required account ID
  CF_PAGES_PROJECT         Project name (unless passed with --project)

The root .env file is loaded automatically.

Examples:
  pnpm clean:cf -- --project school-superadmin
  pnpm clean:cf -- --project lbp-dashboard --keep 5 --older-than 2 --yes
  pnpm clean:cf:all
  pnpm clean:cf:all -- --yes`);
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
    project: process.env.CF_PAGES_PROJECT,
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

async function cfRequest(path, token, init = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    const message = body?.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`Cloudflare API ${response.status}: ${message}`);
  }

  return body;
}

async function listPaged(path, token, perPage) {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const separator = path.includes('?') ? '&' : '?';
    const body = await cfRequest(`${path}${separator}page=${page}&per_page=${perPage}`, token);
    items.push(...(body.result ?? []));
    totalPages = body.result_info?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return items;
}

const deploymentState = (deployment) => deployment.latest_stage?.status ?? 'unknown';

function formatDeployment(deployment) {
  const branch = deployment.deployment_trigger?.metadata?.branch ?? '-';
  return `${deployment.id}  ${deployment.environment.padEnd(10)}  ${deploymentState(deployment).padEnd(9)}  ${deployment.created_on}  ${branch.padEnd(12)}  ${deployment.url}`;
}

async function cleanProject(name, options, { account, token }) {
  const base = `/accounts/${account}/pages/projects/${encodeURIComponent(name)}`;
  const project = (await cfRequest(base, token)).result;
  const deployments = (await listPaged(`${base}/deployments`, token, 25)).sort(
    (left, right) => Date.parse(right.created_on) - Date.parse(left.created_on),
  );

  const protectedIds = new Set();
  if (project.canonical_deployment?.id) protectedIds.add(project.canonical_deployment.id);
  for (const deployment of deployments) {
    if (deployment.aliases?.length > 0) protectedIds.add(deployment.id);
  }

  const recentIds = new Set(deployments.slice(0, options.keep).map(({ id }) => id));
  const failedStates = new Set(['failure', 'canceled']);
  const cutoff = Date.now() - options.minAgeDays * 24 * 60 * 60 * 1000;
  const candidates = deployments.filter(
    (deployment) =>
      !protectedIds.has(deployment.id) &&
      (failedStates.has(deploymentState(deployment)) ||
        (!recentIds.has(deployment.id) && Date.parse(deployment.created_on) <= cutoff)),
  );

  console.log(`\nProject: ${name}`);
  console.log(
    `Found ${deployments.length} deployment(s); failed/canceled deployments are always selected, while successful deployments keep the ${options.keep} newest and those newer than ${options.minAgeDays} day(s).`,
  );

  if (candidates.length === 0) {
    console.log('No deployments match the cleanup criteria.');
    return 0;
  }

  console.log(
    `${options.confirm ? 'Deleting' : 'Would delete'} ${candidates.length} deployment(s) matching the cleanup criteria:`,
  );
  for (const deployment of candidates) console.log(`  ${formatDeployment(deployment)}`);

  if (!options.confirm) return 0;

  let failures = 0;
  for (const deployment of candidates) {
    try {
      await cfRequest(`${base}/deployments/${deployment.id}`, token, { method: 'DELETE' });
      console.log(`Deleted ${deployment.id}`);
    } catch (error) {
      failures += 1;
      console.error(`Failed to delete ${deployment.id}: ${error.message}`);
    }
  }

  return failures;
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

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !account) {
    fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
    return;
  }

  let projects;
  try {
    projects = options.all
      ? (await listPaged(`/accounts/${account}/pages/projects`, token, 10)).map(({ name }) => name)
      : [options.project];
  } catch (error) {
    fail(error.message);
    return;
  }

  if (!projects[0]) {
    fail('pass --project, set CF_PAGES_PROJECT, or use --all');
    return;
  }

  let failures = 0;
  for (const name of projects) {
    try {
      failures += await cleanProject(name, options, { account, token });
    } catch (error) {
      failures += 1;
      console.error(`Failed to clean ${name}: ${error.message}`);
    }
  }

  if (!options.confirm) {
    console.log('\nDry run only. Re-run with --yes to delete the deployments listed above.');
    return;
  }

  if (failures > 0) {
    fail(`${failures} deployment(s) or project(s) could not be cleaned`);
    return;
  }

  console.log('\nCleanup complete.');
}

await main();
