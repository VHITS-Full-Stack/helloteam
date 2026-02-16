import { createServer } from 'http';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import { initializeSocket } from './socket';
import { initializeJobs } from './jobs';

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Create HTTP server and attach Socket.io
    const httpServer = createServer(app);
    const io = initializeSocket(httpServer);

    // Store io on app so controllers can emit events
    app.set('io', io);

    // Initialize cron jobs (auto-approval, invoice generation)
    initializeJobs(io);

    // Start the server
    httpServer.listen(config.port, () => {
      console.log(`
========================================
  Hello Team Workforce Hub API
========================================
  Environment: ${config.env}
  Port: ${config.port}
  URL: http://localhost:${config.port}
  API: http://localhost:${config.port}/api
  Health: http://localhost:${config.port}/api/health
  Socket.io: enabled
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
