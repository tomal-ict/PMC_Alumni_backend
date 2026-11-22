import { encryptPayload, decryptPayload } from '../services/cryptoService.js';

export const cryptoMiddleware = (req, res, next) => {
  // Check if incoming body is encrypted
  if (req.body && req.body.encryptedData) {
    try {
      const decrypted = decryptPayload(req.body.encryptedData);
      req.body = decrypted;
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Security Alert: Failed to decrypt request payload.'
      });
    }
  }

  // Intercept response to optionally encrypt data if client asked or if enabled
  const originalJson = res.json.bind(res);
  const clientWantsEncryption = req.headers['x-client-encrypted'] === 'true' || process.env.ENABLE_PAYLOAD_ENCRYPTION === 'true';

  res.encryptJson = (data) => {
    try {
      const encrypted = encryptPayload(data);
      res.setHeader('X-Encrypted', 'true');
      return originalJson({
        encrypted: true,
        data: encrypted
      });
    } catch (error) {
      return originalJson({
        success: false,
        message: 'Security Alert: Encryption response error'
      });
    }
  };

  res.secureJson = (data) => {
    // If client requested encrypted or global encryption is enabled, send encrypted payload
    if (clientWantsEncryption && !req.query.raw) {
      return res.encryptJson(data);
    }
    return originalJson(data);
  };

  next();
};
