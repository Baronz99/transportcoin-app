import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-transportcoin-secret-change-me";

export type AuthPayload = {
  userId: number;
  role: "user" | "admin";
};

export function getUserFromAuthHeader(authHeader?: string | null): AuthPayload | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function signUserToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
