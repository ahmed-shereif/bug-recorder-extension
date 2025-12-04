# Sensitive Data Masking

The Bug Recorder extension now automatically masks sensitive data in generated reports to protect user privacy and security.

## What Gets Masked

The masking utility detects and masks the following types of sensitive data:

### Field Names
- Passwords: `password`, `passwd`, `pwd`, `pass`
- Tokens: `token`, `auth`, `authorization`, `bearer`, `jwt`
- API Keys: `apikey`, `api_key`, `secret`, `api_secret`
- Credit Cards: `creditcard`, `cardnumber`
- SSN: `ssn`, `social_security`
- PINs: `pin`, `cvv`, `cvc`
- Private Keys: `privatekey`
- Session IDs: `sessionid`

### Value Patterns
- **Passwords**: Any value in a password field
- **Tokens**: Bearer tokens, JWT tokens, authorization headers
- **API Keys**: Long alphanumeric strings in API key fields
- **Email Addresses**: `user@example.com` → `u***@example.com`
- **Credit Cards**: `1234 5678 9012 3456` → `**** **** **** 3456`
- **SSN**: `123-45-6789` → `***-**-6789`
- **Phone Numbers**: `(555) 123-4567` → `****1234`
- **IP Addresses**: `192.168.1.1` → `192.168.1.***`
- **URLs**: Full URLs are masked to show only domain

## How Masking Works

### Text Values
- **Short values** (≤4 chars): Replaced with `****`
- **Emails**: Show first character + domain
- **Credit cards**: Show last 4 digits
- **Tokens/Keys**: Show first 4 and last 4 characters
- **URLs**: Show protocol and domain only
- **Default**: Show first and last character with asterisks

### Objects and Arrays
Recursively masks all sensitive fields within nested objects and arrays.

### Network Requests
- Request bodies are masked before display
- Response bodies are masked before display
- Field mappings show masked values
- URLs with sensitive query parameters are masked

## Where Masking is Applied

1. **Text Reports** (`textGenerator.js`)
   - All step descriptions
   - Field values
   - Request/response bodies
   - Error messages

2. **HTML Reports** (`htmlGenerator.js`)
   - Step descriptions
   - Field values
   - All details

3. **Network Cards** (`networkCard.js`)
   - Request bodies
   - Response bodies
   - Field mappings
   - URLs with sensitive parameters

## Implementation

The masking is implemented in `src/shared/sensitiveDataMasker.js` with the following main functions:

```javascript
// Mask sensitive data in any object
maskSensitiveData(data, fieldName)

// Mask a complete step object
maskStepData(step)

// Mask text content
maskTextContent(text)
```

## Example

### Before Masking
```
STEP 1: INPUT
Field: password
Value: MySecurePassword123!
```

### After Masking
```
STEP 1: INPUT
Field: password
Value: M***3!
```

## Security Notes

- Masking is applied at report generation time
- Original data in the extension is not modified
- Masking is applied to both HTML and text exports
- Sensitive field detection is case-insensitive
- Nested objects are recursively masked

## Customization

To add more sensitive field names or patterns, edit `src/shared/sensitiveDataMasker.js`:

```javascript
const SENSITIVE_FIELD_NAMES = [
  // Add your custom field names here
];

const SENSITIVE_PATTERNS = {
  // Add your custom regex patterns here
};
```
