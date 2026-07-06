import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserByEmail, insertUser } from "./usersRepository.js";

const BCRYPT_ROUNDS = process.env.NODE_ENV === "test" ? 1 : 10;
const JWT_EXPIRY = "24h";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_TAKEN" | "INVALID_CREDENTIALS",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthResult {
  readonly token: string;
  readonly user: {
    readonly id: number;
    readonly email: string;
    readonly name: string;
    readonly createdAt: string;
  };
}

export async function register(
  db: Database.Database,
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();

  if (findUserByEmail(db, normalizedEmail)) {
    throw new AuthError("El email ya está registrado.", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = insertUser(db, normalizedEmail, passwordHash, name);
  const token = jwt.sign({ sub: String(user.id), email: user.email }, config.jwtSecret, {
    expiresIn: JWT_EXPIRY,
  });

  return { token, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
}

export async function login(
  db: Database.Database,
  email: string,
  password: string,
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();
  const user = findUserByEmail(db, normalizedEmail);

  if (!user) {
    throw new AuthError("Credenciales incorrectas.", "INVALID_CREDENTIALS");
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new AuthError("Credenciales incorrectas.", "INVALID_CREDENTIALS");
  }

  const token = jwt.sign({ sub: String(user.id), email: user.email }, config.jwtSecret, {
    expiresIn: JWT_EXPIRY,
  });

  return { token, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
}