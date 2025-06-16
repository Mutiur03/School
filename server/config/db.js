import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false, 
    require: true,
  },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 60000,
  max: 20,
});

pool.on("error", (err) => {
  console.error("Database pool error:", err.message, err.stack);
});

async function testConnection(retries = 5, delay = 2000) {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    console.log("Successfully connected to PostgreSQL database");
    return true;
  } catch (err) {
    console.error(
      `Connection attempt failed (${retries} retries left):`,
      err.message
    );
    if (retries <= 0) {
      console.error("Maximum connection retries reached");
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return testConnection(retries - 1, delay * 1.5);
  } finally {
    if (client) client.release();
  }
}

process.on("SIGINT", async () => {
  console.log("Closing database pool...");
  await pool.end();
  process.exit(0);
});

(async () => {
  const connected = await testConnection();
  if (!connected) {
    console.error("Fatal: Could not establish database connection");
    process.exit(1);
  }
})();

