export interface Config {
  readonly port: number;
  readonly nodeEnv: string;
  readonly dbName: string;
  readonly baseUrl: string;
  readonly jwtSecret: string;
  readonly corsOrigin: string;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port)) {
    throw new Error(`Variable de entorno PORT inválida: "${value}". Debe ser un número entero.`);
  }

  return port;
}

function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const port = parsePort(process.env.PORT);
  const dbName = process.env.DB_NAME?.trim() || "snap.db";

  const baseUrlFromEnv = process.env.BASE_URL?.trim();
  if (!baseUrlFromEnv && nodeEnv === "production") {
    throw new Error(
      "Falta la variable de entorno obligatoria BASE_URL en producción: define la URL pública " +
        "desde la que se sirven los enlaces cortos (por ejemplo, https://snap.example.com).",
    );
  }

  const baseUrl = baseUrlFromEnv || `http://localhost:${port}`;

  const jwtSecretFromEnv = process.env.JWT_SECRET?.trim();
  if (!jwtSecretFromEnv && nodeEnv === "production") {
    throw new Error(
      "Falta la variable de entorno obligatoria JWT_SECRET en producción.",
    );
  }
  const jwtSecret = jwtSecretFromEnv || "dev-secret-not-for-production";

  const corsOrigin = process.env.CORS_ORIGIN?.trim() || "http://localhost:5173";

  return { port, nodeEnv, dbName, baseUrl, jwtSecret, corsOrigin };
}

export const config: Config = loadConfig();