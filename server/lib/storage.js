const fs = require("fs/promises");
const path = require("path");

const DB_FILE = path.join(process.cwd(), "data", "db.json");

const EMPTY_DB = {
  orders: [],
  shipments: [],
  returns: [],
  customers: [],
  payments: [],
  settings: {},
  support: [],
  otpAudit: [],
  events: []
};

let mutationQueue = Promise.resolve();

async function ensureDatabase() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(
      DB_FILE,
      JSON.stringify(EMPTY_DB, null, 2),
      "utf8"
    );
  }
}

function normalizeDatabase(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return {
    orders: Array.isArray(source.orders) ? source.orders : [],
    shipments: Array.isArray(source.shipments) ? source.shipments : [],
    returns: Array.isArray(source.returns) ? source.returns : [],
    customers: Array.isArray(source.customers) ? source.customers : [],
    payments: Array.isArray(source.payments) ? source.payments : [],
    settings:
      source.settings &&
      typeof source.settings === "object" &&
      !Array.isArray(source.settings)
        ? source.settings
        : {},
    support: Array.isArray(source.support) ? source.support : [],
    otpAudit: Array.isArray(source.otpAudit) ? source.otpAudit : [],
    events: Array.isArray(source.events) ? source.events : []
  };
}

async function readDatabase() {
  await ensureDatabase();

  try {
    const content = await fs.readFile(DB_FILE, "utf8");
    return normalizeDatabase(JSON.parse(content));
  } catch (error) {
    console.error("Database read failed:", error.message);
    return structuredClone(EMPTY_DB);
  }
}

async function writeDatabase(database) {
  await ensureDatabase();

  const normalized = normalizeDatabase(database);
  const temporaryFile = `${DB_FILE}.${process.pid}.tmp`;

  await fs.writeFile(
    temporaryFile,
    JSON.stringify(normalized, null, 2),
    "utf8"
  );

  await fs.rename(temporaryFile, DB_FILE);

  return normalized;
}

function mutateDatabase(mutator) {
  mutationQueue = mutationQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await readDatabase();
      const result = await mutator(database);
      await writeDatabase(database);
      return result;
    });

  return mutationQueue;
}

function createEvent(type, message, details = {}) {
  return {
    id: `EVT${Date.now()}${Math.floor(100 + Math.random() * 900)}`,
    type,
    message,
    details,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  DB_FILE,
  ensureDatabase,
  readDatabase,
  writeDatabase,
  mutateDatabase,
  createEvent
};
