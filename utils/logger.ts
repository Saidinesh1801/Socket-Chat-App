import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
});

type LogMeta = Record<string, unknown> | undefined;

function wrap(level: 'info' | 'warn' | 'error' | 'debug') {
  return (msg: string, meta?: LogMeta) => {
    if (meta) {
      logger[level](meta, msg);
    } else {
      logger[level](msg);
    }
  };
}

export default {
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
  debug: wrap('debug'),
};
