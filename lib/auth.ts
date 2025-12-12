// lib/auth.ts
import jwt from "jsonwebtoken";

export type AuthPayload = {
  userId: number;
  tier?: string;
  isAdmin?: boolean;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * Sign a JWT for a user
 */
export function signUserToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Verify a JWT string and return payload or null
 */
export function verifyUserToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded?.userId) return null;

    return {
      userId: Number(decoded.userId),
      tier: decoded.tier,
      isAdmin: decoded.isAdmin,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from "Authorization: Bearer <token>" and verify it.
 * Accepts string | null because req.headers.get(...) can return null.
 * Returns AuthPayload | null (SYNC) to avoid Promise-type issues in routes.
 */
export function getUserFromAuthHeader(
  authHeader: string | null,
): AuthPayload | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  const token =
    parts.length === 2 && parts[0].toLowerCase() === "bearer" ? parts[1] : null;

  if (!token) return null;
  return verifyUserToken(token);
}
