import dotenv from "dotenv";

dotenv.config();

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.argv[2] 
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`;

const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

const assertConfig = () => {
  const missing = [];
  if (!ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!API_TOKEN) missing.push("CLOUDFLARE_API_TOKEN");

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
};

async function getAllDeployments() {
  let page = 1;
  let allDeployments = [];

  while (true) {
    const res = await fetch(`${BASE_URL}?page=${page}&per_page=25`, {
      headers,
    });
    const data = await res.json();

    if (!res.ok || data.success === false) {
      throw new Error(
        `List deployments failed (status ${res.status}): ${JSON.stringify(data.errors || data)}`,
      );
    }

    const deployments = data.result || [];
    allDeployments.push(...deployments);

    console.log(`Fetched page ${page}, got ${deployments.length} deployments`);

    if (deployments.length < 25) break; // no more pages
    page++;
  }

  return allDeployments;
}

async function deleteDeployment(deploymentId) {
  const res = await fetch(`${BASE_URL}/${deploymentId}?force=true`, {
    method: "DELETE",
    headers,
  });

  if (res.ok) {
    console.log(`✅ Deleted: ${deploymentId}`);
  } else {
    const err = await res.json();
    console.error(`❌ Failed: ${deploymentId}`, err.errors);
  }
}

async function main() {
  assertConfig();

  console.log("Fetching all deployments...");
  const deployments = await getAllDeployments();
  console.log(`\nTotal deployments found: ${deployments.length}\n`);

  await Promise.all(
    deployments.map((d) => deleteDeployment(d.id))
  );

  console.log("\nDone! Now try deleting the project.");
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exitCode = 1;
});
