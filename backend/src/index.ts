import app from './app';
import { config } from './config';
import prisma from './config/database';

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Start the server
    app.listen(config.port, () => {
      console.log(`
========================================
  Hello Team Workforce Hub API
========================================
  Environment: ${config.env}
  Port: ${config.port}
  URL: http://localhost:${config.port}
  API: http://localhost:${config.port}/api
  Health: http://localhost:${config.port}/api/health
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
