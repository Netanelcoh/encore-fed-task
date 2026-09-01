import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { logger, setLogLevel } from './lib/logger.js';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    process.stderr.write(
      `Invalid configuration: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
    return;
  }

  setLogLevel(config.logLevel);

  const app = createApp(config);

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('server listening', {
      port: config.port,
      upstream: config.upstreamBaseUrl,
      timeoutMs: config.upstreamTimeoutMs,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info('shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
