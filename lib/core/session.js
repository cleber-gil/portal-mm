import { SignJWT, jwtVerify } from "jose";

// usado também no middleware (edge): só jose, sem banco
export const SESSION_COOKIE = "mm_session";
export const SESSION_HOURS = 12;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mín. 32 caracteres).");
  return new TextEncoder().encode(secret);
}

export async function signSession(userId) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}
