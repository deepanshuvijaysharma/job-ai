import { app } from './app';
import { prisma } from '@jobhunter/database';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 JobHunter AI API Server listening on port ${PORT}`);
});

// Graceful Shutdown Handlers for Container Terminations
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful server shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('PostgreSQL database connection closed gracefully.');
    } catch (err) {
      console.warn('Error disconnecting database:', (err as Error).message);
    }
    process.exit(0);
  });

  // Force exit if connections do not drain within 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
