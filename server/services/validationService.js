/**
 * Validates host parameter (IPv4, IPv6, domain, localhost)
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

  // Check if valid IPv4
  const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const ipv4Match = host.match(ipv4Regex);
  if (ipv4Match) {
    const octets = host.split('.').map(Number);
    if (octets.every(octet => octet >= 0 && octet <= 255)) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid IPv4 address' };
  }

  // Check if valid IPv6
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::1|::)$/;
  if (ipv6Regex.test(host)) {
    return { valid: true };
  }

  // Check if valid domain (requires 2+ char TLD) or localhost
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$/;
  if (domainRegex.test(host)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid host: must be IPv4, IPv6, domain, or localhost' };
}

/**
 * Validates column data type
 * @param {string} type - SQL data type (e.g., NVARCHAR(255), INTEGER)
 * @returns {object} { valid: boolean, error?: string }
 */
function validateColumnType(type) {
  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Type is required' };
  }

  // Allowlist of safe HANA types
  const allowedTypes = [
    'TINYINT', 'SMALLINT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'REAL', 'DOUBLE',
    'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR',
    'DATE', 'TIME', 'TIMESTAMP', 'DAYDATE',
    'BLOB', 'CLOB', 'NCLOB',
    'BOOLEAN'
  ];

  const typeUpper = type.toUpperCase().trim();

  // Check if type starts with an allowed base type
  const baseType = typeUpper.split('(')[0].trim();
  if (!allowedTypes.includes(baseType)) {
    return { valid: false, error: `Invalid type: ${type}` };
  }

  // Check for parameter injection (only allow digits, commas, spaces in parentheses)
  if (typeUpper.includes('(')) {
    if (!/^\w+\(\d+(?:,\s*\d+)?\)$/i.test(typeUpper)) {
      return { valid: false, error: 'Invalid type parameters' };
    }
  }

  return { valid: true };
}

module.exports = {
  validateHost,
  validateColumnType,
};
