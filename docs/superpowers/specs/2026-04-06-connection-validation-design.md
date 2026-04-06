# Connection Validation Enhancement

**Date:** 2026-04-06  
**Author:** Architect (Claude Team)  
**Project:** DataSphereExplorer  
**Status:** Design Approved

---

## Problem Statement

The `/connect` endpoint in `server/routes/connection.js` has minimal input validation. Currently only checks if fields exist, but lacks:
- Port number range validation (should be 1-65535)
- Host format validation (IP address or domain)
- Credential length/format constraints
- Whitespace trimming on string inputs
- Comprehensive error messaging

This creates security and usability issues.

---

## Scope

**In Scope:**
- Add validation to `/connect` endpoint only
- Create reusable `validationService.js`
- Return structured error responses

**Out of Scope:**
- Validate `/status` or `/disconnect` endpoints
- Add request rate limiting
- Add SQL injection protection (handled by HANA driver)

---

## Design

### Validation Rules

| Field | Rules | Notes |
|-------|-------|-------|
| **host** | Non-empty string, max 255 chars, valid IP or domain | Must be either IPv4/IPv6 or valid domain name |
| **port** | Integer, 1-65535 range | Standard TCP port range |
| **user** | Non-empty string, max 255 chars, trimmed | Common database credential size |
| **password** | Non-empty string, max 255 chars, trimmed | Allow any characters for password |

### Architecture

**New File: `server/services/validationService.js`**

Exports:
```javascript
validateHost(host)           // Returns { valid: bool, error?: string }
validatePort(port)           // Returns { valid: bool, error?: string }
validateCredentials(user, password)  // Returns { valid: bool, errors?: object }
validateConnection(body)     // Returns { valid: bool, errors?: object }
```

**Modified File: `server/routes/connection.js`**

Updated `/connect` route:
```javascript
router.post('/connect', async (req, res, next) => {
  const validation = validationService.validateConnection(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }
  
  const { host, port, user, password } = req.body;
  const result = await hanaService.connect({ host, port, user, password });
  res.json(result);
});
```

### Error Response Format

Success case (unchanged):
```json
{ "success": true, ... }
```

Validation failure:
```json
{
  "success": false,
  "errors": {
    "host": "Invalid host: must be IP address or domain name",
    "port": "Invalid port: must be 1-65535",
    "user": "User cannot be empty",
    "password": "Password cannot exceed 255 characters"
  }
}
```

### Implementation Details

**Host Validation:**
- Check if matches IPv4 pattern: `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}`
- Check if matches domain pattern: alphanumeric + dots/hyphens + TLD
- Accept both localhost and 127.0.0.1

**Port Validation:**
- Parse to integer with `parseInt()`
- Check `>= 1 && <= 65535`
- Reject non-numeric strings

**Credential Validation:**
- Trim whitespace with `.trim()`
- Check length `> 0 && <= 255`
- No character restrictions (passwords can contain anything)

**Error Aggregation:**
- Collect ALL validation errors, not just first one
- Return as object with field names as keys
- Helps frontend show all issues at once

---

## Testing Strategy

**Unit Tests:** `server/services/__tests__/validationService.test.js`
- Test each validator function in isolation
- Test edge cases (boundary values, special characters)
- Test error messages

**Integration Tests:** `server/routes/__tests__/connection.test.js`
- Test `/connect` with invalid inputs
- Test `/connect` with valid inputs
- Verify error response format

---

## Dependencies

- Node.js built-in `net` or regex for IP/domain validation
- No new npm packages required

---

## Success Criteria

✅ All validation errors caught before calling hanaService  
✅ Multiple errors returned in single response  
✅ Error messages clear and actionable  
✅ No performance degradation  
✅ Backward compatible with valid requests  

---

## Timeline

- **Design:** Approved
- **Implementation:** Next phase (writing-plans skill)
- **Testing:** Included in implementation
- **Review:** Code review phase
