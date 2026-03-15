const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction ? undefined : { target: 'pino/file', options: { destination: 1 } },
});

function wrap(level) {
  return (msg, meta) => {
    if (meta) {
      logger[level](meta, msg);
    } else {
      logger[level](msg);
    }
  };
}

module.exports = {
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
  debug: wrap('debug'),
};
