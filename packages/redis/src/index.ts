import { Redis, type RedisOptions } from "ioredis";

let connection: Redis | null = null;

export type ConnectionMode = "shared" | "worker";

export function createConnection(url: string, mode: ConnectionMode = "shared"): Redis {
  const options: RedisOptions = {
    maxRetriesPerRequest: mode === "worker" ? null : 3,
    enableReadyCheck: false,
    lazyConnect: false,
  };
  return new Redis(url, options);
}

export function getSharedConnection(url: string): Redis {
  if (!connection) connection = createConnection(url, "shared");
  return connection;
}

export async function closeSharedConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

export type { Redis } from "ioredis";
