import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Request logging
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hello Team Workforce Hub API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
