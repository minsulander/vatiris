import dotenv from "dotenv"

// .env.local holds local secrets and is gitignored, .env holds shared defaults.
// Imported first from server.ts so the environment is populated before any
// other module (e.g. the postgres pool in db.ts) reads it.
dotenv.config({ path: [".env.local", ".env"] })
