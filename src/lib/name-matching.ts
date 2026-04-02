function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCoreTokens(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => token.length > 1);
}

function isAliasMatch(candidate: string, canonical: string) {
  const candidateTokens = getCoreTokens(candidate);
  const canonicalTokens = getCoreTokens(canonical);

  if (!candidateTokens.length || !canonicalTokens.length) {
    return false;
  }

  const candidateJoined = candidateTokens.join(" ");
  const canonicalJoined = canonicalTokens.join(" ");
  if (candidateJoined === canonicalJoined) {
    return true;
  }

  const candidateFirst = candidateTokens[0];
  const candidateLast = candidateTokens[candidateTokens.length - 1];
  const canonicalFirst = canonicalTokens[0];
  const canonicalLast = canonicalTokens[canonicalTokens.length - 1];

  if (candidateLast !== canonicalLast) {
    return false;
  }

  const firstNameCompatible =
    candidateFirst === canonicalFirst ||
    candidateFirst.startsWith(canonicalFirst) ||
    canonicalFirst.startsWith(candidateFirst) ||
    candidateFirst[0] === canonicalFirst[0];

  if (!firstNameCompatible) {
    return false;
  }

  const candidateSet = new Set(candidateTokens);
  const canonicalSet = new Set(canonicalTokens);
  const candidateSubset = candidateTokens.every((token) => canonicalSet.has(token));
  const canonicalSubset = canonicalTokens.every((token) => candidateSet.has(token));

  return candidateSubset || canonicalSubset;
}

export function resolveCanonicalManagerName(
  candidate: string | null | undefined,
  canonicalNames: string[],
) {
  if (!candidate) {
    return candidate ?? null;
  }

  const trimmed = candidate.trim();
  const exact = canonicalNames.find(
    (canonical) => normalizeName(canonical) === normalizeName(trimmed),
  );
  if (exact) {
    return exact;
  }

  const alias = canonicalNames.find((canonical) => isAliasMatch(trimmed, canonical));
  return alias ?? trimmed;
}

export function resolveCanonicalPersonName(
  candidate: string | null | undefined,
  canonicalNames: string[],
) {
  if (!candidate) {
    return candidate ?? null;
  }

  const trimmed = candidate.trim();
  const exact = canonicalNames.find(
    (canonical) => normalizeName(canonical) === normalizeName(trimmed),
  );
  if (exact) {
    return exact;
  }

  const alias = canonicalNames.find((canonical) => isAliasMatch(trimmed, canonical));
  return alias ?? trimmed;
}
