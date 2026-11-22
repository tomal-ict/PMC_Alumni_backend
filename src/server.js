import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { cryptoMiddleware } from './middleware/cryptoMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import alumniRoutes from './routes/alumniRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware: Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin like curl or mobile apps
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Dev flexible
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Encrypted', 'X-Encrypted']
}));

// Rate Limiting Protection Against DDoS and Brute Force Attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', globalLimiter);

// Specific Auth Brute Force Limiter
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 10 minutes before trying again.'
  }
});
app.use('/api/v2/auth/login', authLimiter);

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logger (Development)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Payload Encryption & Decryption Middleware
app.use(cryptoMiddleware);

// Static Uploads & Media Serving
const publicDir = path.join(__dirname, '../public');
app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
app.use('/org-committee', express.static(path.join(publicDir, 'org-committee')));

// API Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/public', publicRoutes);
app.use('/api/v2/alumni', alumniRoutes);
app.use('/api/v2/admin', adminRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'PMC Alumni High-Performance React/Node Backend',
    database: process.env.DB_NAME,
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`
  });
});

// Centralized Secure Error Handler (No sensitive leaks)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected security-verified error occurred.' 
      : err.message
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PMC Alumni Backend Server Running on Port ${PORT}`);
  console.log(`🔒 End-to-End Payload Encryption: ENABLED`);
  console.log(`🛡️ Rate Limiting & Helmet Security: ACTIVE`);
  console.log(`💾 Connected Database: ${process.env.DB_NAME || 'alumn_main_db_v2'}`);
  console.log(`====================================================`);
});
