/**
 * Validates host parameter
 * @param {string} host - Hostname or IP address
 * @returns {object} { valid: boolean, error?: string }
 */
function validateHost(host) {
  // Check if empty
  if (!host || typeof host !== 'string' || host.trim().length === 0) {
    return { valid: false, error: 'Host cannot be empty' };
  }

  // Check length
  if (host.length > 255) {
    return { valid: false, error: 'Host cannot exceed 255 characters' };
  }

  // Check if valid IPv4 (no capture groups to prevent ReDoS)
  const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const ipv4Match = host.match(ipv4Regex);
  if (ipv4Match) {
    const octets = host.split('.').map(Number);
    if (octets.every(octet => octet >= 0 && octet <= 255)) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid IPv4 address' };
  }

  // Check if valid domain (requires 2+ char TLD) or localhost
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$/;
  if (domainRegex.test(host)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid host: must be IP address or domain name' };
}

module.exports = {
  validateHost,
};
