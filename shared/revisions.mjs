export const revisionTag = (domain, id, version) =>
  `W/"${domain}-${id}-${version}"`;

// Accept our exact weak validator. Other valid HTTP validators simply receive
// a full 200 response. Never interpret a tag for another domain or resource.
export function versionFromTag(value, domain, id) {
  const prefix = `W/"${domain}-${id}-`;
  if (
    typeof value !== "string" ||
    !value.startsWith(prefix) ||
    !value.endsWith('"')
  )
    return undefined;
  const number = value.slice(prefix.length, -1);
  if (!/^(0|[1-9]\d*)$/.test(number)) return undefined;
  const version = Number(number);
  return Number.isSafeInteger(version) ? version : undefined;
}
