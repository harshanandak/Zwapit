import type { AuthConfig } from "convex/server";

type AuthConfigEnv = {
  issuerDomain?: string;
};

export function buildAuthConfig(env: AuthConfigEnv): AuthConfig {
  const issuerDomain = env.issuerDomain?.trim();
  if (!issuerDomain) return { providers: [] };

  return {
    providers: [
      {
        domain: issuerDomain,
        applicationID: "convex",
      },
    ],
  };
}

export default buildAuthConfig({
  issuerDomain: process.env.CLERK_JWT_ISSUER_DOMAIN,
});
