import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './src/config/db.js';
import dishRoutes from './src/routes/dishRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root & Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Nosh Dish Dashboard API with Optimistic Concurrency Control',
    endpoints: {
      getDishes: 'GET /dishes or GET /api/dishes',
      updateDish: 'PATCH /dishes/:dishId or PATCH /api/dishes/:dishId'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount dish routes on both /dishes and /api/dishes for flexible reviewer testing
app.use('/dishes', dishRoutes);
app.use('/api/dishes', dishRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload. Please verify request body syntax.' });
  }
  console.error('[Unhandled Error]:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Connect to DB and start listening
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Server] Running successfully on port ${PORT}`);
      console.log(`[Server] Accessible at http://localhost:${PORT}/dishes`);
    });
  } catch (err) {
    console.error('[Server Startup Failed]:', err);
    process.exit(1);
  }
};

startServer();
