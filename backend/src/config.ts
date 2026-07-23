import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://activtrak:activtrak@localhost:5432/activtrak",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
