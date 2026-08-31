import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { logger, setLogLevel } from './lib/logger.js';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    // Bad configuration should stop the deploy, not produce a service that
    // misbehaves quietly once traffic arrives.
    process.stderr.write(
      `Invalid configuration: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
    return;
  }

  setLogLevel(config.logLevel);

  const app = createApp(config);

  // 0.0.0.0 so the container is reachable from outside its network namespace.
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('server listening', {
      port: config.port,
      upstream: config.upstreamBaseUrl,
      timeoutMs: config.upstreamTimeoutMs,
    });
  });

  // Container platforms send SIGTERM before killing the instance; draining
  // in-flight requests avoids handing the caller a truncated response.
  const shutdown = (signal: string): void => {
    logger.info('shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
