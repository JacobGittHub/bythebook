// Where a beta key or a reset code is asked for. The address comes from the environment so
// it stays out of the public repository; without it the links are not shown.
export const betaContactEmail = process.env.NEXT_PUBLIC_BETA_CONTACT_EMAIL ?? null;

function mailto(subject: string): string | null {
  return betaContactEmail
    ? `mailto:${betaContactEmail}?subject=${encodeURIComponent(subject)}`
    : null;
}

export const betaKeyMailto = mailto("ByTheBook beta key");
export const resetRequestMailto = mailto("ByTheBook password reset");
