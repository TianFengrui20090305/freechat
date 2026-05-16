import { verifyToken, type JWTPayload } from "./auth";

export async function isValidSession(
  authHeader: string | undefined,
  jwtSigningKey: string,
): Promise<JWTPayload | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return await verifyToken(token, jwtSigningKey);
}
