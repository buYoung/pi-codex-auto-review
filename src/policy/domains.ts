/** Shared with the native configuration so policy and transport agree on subdomains. */
export function matchesDomain(host: string, pattern: string): boolean {
  const value = host.toLowerCase().replace(/\.$/, ''), rule = pattern.toLowerCase().replace(/\.$/, '');
  return rule.startsWith('*.') ? value.endsWith(rule.slice(1)) && value !== rule.slice(2) : value === rule;
}
