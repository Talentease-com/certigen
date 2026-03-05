import { createRemoteJWKSet, jwtVerify } from "jose";

const SHOO_BASE_URL = "https://shoo.dev";
const SHOO_ISSUER = "https://shoo.dev";

const jwks = createRemoteJWKSet(
  new URL("/.well-known/jwks.json", SHOO_BASE_URL),
);

export interface ShooUser {
  pairwiseSub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyShooToken(idToken: string): Promise<ShooUser> {
  const appOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
  const audience = `origin:${new URL(appOrigin).origin}`;

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: SHOO_ISSUER,
    audience,
  });

  if (typeof payload.pairwise_sub !== "string") {
    throw new Error("Invalid Shoo token: missing pairwise_sub");
  }

  return {
    pairwiseSub: payload.pairwise_sub as string,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}

export function isAdmin(pairwiseSub: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(pairwiseSub);
}

export async function requireAdmin(idToken: string): Promise<ShooUser> {
  const user = await verifyShooToken(idToken);
  if (!isAdmin(user.pairwiseSub)) {
    console.error(
      `Admin access denied for user: ${user.pairwiseSub} (${user.email || "no email"})`,
    );
    throw new Error("Unauthorized: not an admin");
  }
  return user;
}
