// Vitest setup: stub env vars needed at module-load time so tests of pure
// helpers can import modules that transitively reach `lib/db.ts`. No real
// connection is opened — `pg.Pool` is lazy and tests inject their own deps.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.AUTH_SECRET ??= 'test-secret-do-not-use-in-prod';
