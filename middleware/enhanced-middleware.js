const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const onFinished = require('on-finished');

/**
 * A smart caching middleware that uses the central cacheManager.
 * It is aware of the special key format for the daily attendance endpoint.
 */
const smartCache = (options = {}) => {
  const { ttl = 60, keyGenerator } = options;
  return (req, res, next) => {
    // Retrieve the singleton cacheManager instance from the app context
    const cacheManager = req.app.get('cacheManager');

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    let cacheKey;
    if (keyGenerator) {
      cacheKey = keyGenerator(req);
    } else {
      // Default key generation
      cacheKey = `${req.method}:${req.originalUrl}`;
    }

    // Special key generation for the daily attendance overview endpoint
    if (req.originalUrl.includes('/api/attendance/grade-sections/daily')) {
        const today = new Date().toISOString().split('T')[0];
        const userKey = cacheManager.userKey(req.user.id, req.originalUrl);
        cacheKey = cacheManager.dateKey(today, userKey);
    }

    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      console.log(`🎯 Smart Cache HIT: ${cacheKey}`);
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    console.log(`❌ Smart Cache MISS: ${cacheKey}`);
    res.set('X-Cache', 'MISS');

    // Intercept the response to cache it
    const originalJson = res.json;
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cacheManager.set(cacheKey, body, ttl);
        console.log(`💾 Smart Cached: ${cacheKey} (TTL: ${ttl}s)`);
      }
      return originalJson.call(res, body);
    };

    next();
  };
};

/**
 * Standard CORS configuration for the application.
 */
const enhancedCORS = cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
});

/**
 * Standard rate limiting configuration.
 */
const stormRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Detailed request/response logging middleware.
 */
const enhancedLogging = (req, res, next) => {
    const start = Date.now();
    onFinished(res, () => {
        const duration = Date.now() - start;
        const cacheStatus = res.get('X-Cache') || 'NO-CACHE';
        console.log(`🌐 ${req.method} ${req.originalUrl} [${res.statusCode}] ${res.get('Content-Length') || 0}b ${duration}ms User:${req.user?.id} Role:${req.user?.role} Cache:${cacheStatus} IP:${req.ip}`);
    });
    next();
};

/**
 * Performance monitoring middleware to log response times.
 */
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const time = diff[0] * 1e3 + diff[1] * 1e-6;
    const route = req.route ? req.route.path : req.originalUrl;
    console.log(`📊 ${req.method} ${route} - ${time.toFixed(3)}ms - Cache: ${res.get('X-Cache') || 'N/A'}`);
  });
  next();
};

/**
 * Standard compression middleware.
 */
const compressionHints = compression();

/**
 * Complete storm endpoint middleware stack.
 * NOTE: The faulty etagMiddleware has been removed from this stack.
 */
const stormEndpointMiddleware = [
  enhancedCORS,
  stormRateLimit,
  performanceMonitor,
  compressionHints
];

/**
 * Complete normal endpoint middleware stack.
 */
const normalEndpointMiddleware = [
  enhancedCORS,
  stormRateLimit,
  enhancedLogging,
  compression()
];

/**
 * Static data endpoint middleware (longer cache, no ETag)
 */
const staticEndpointMiddleware = [
  enhancedCORS,
  stormRateLimit,
  smartCache({ ttl: 300 }),
  compressionHints
];

module.exports = {
  smartCache,
  enhancedCORS,
  stormRateLimit,
  enhancedLogging,
  performanceMonitor,
  compressionHints,
  stormEndpointMiddleware,
  normalEndpointMiddleware,
  staticEndpointMiddleware
};
