class Logger {
  constructor() {
    this.levels = ['debug', 'info', 'warn', 'error'];
    this.colors = {
      debug: '\x1b[90m',
      info: '\x1b[94m',
      warn: '\x1b[93m',
      error: '\x1b[91m',
      reset: '\x1b[0m',
    };
    this.minLogLevel = process.env.LOG_LEVEL || 'debug';
  }

  setMinLogLevel(level) {
    if (this.levels.includes(level)) {
      this.minLogLevel = level;
    } else {
      console.error('Invalid log level. Allowed levels: debug, info, warn, error');
    }
  }

  log(level, message, data) {
    const levelIndex = this.levels.indexOf(level);
    const minLogLevelIndex = this.levels.indexOf(this.minLogLevel);

    if (levelIndex >= minLogLevelIndex) {
      const colorCode = this.colors[level] || this.colors.reset;
      const callingInfo = this.getCallingInfo();
      const formattedMessage = this.formatMessage(level, callingInfo, message, data);
      console.log(`${colorCode}${formattedMessage}${this.colors.reset}`);
    }
  }

  getCallingInfo() {
    const stack = new Error().stack.split('\n');
    const callingLine = stack[4].trim();
    if (callingLine.startsWith('at ')) {
      const callingInfoMatch = callingLine.match(/at (.+) \((.+):(\d+):(\d+)\)/);
      if (callingInfoMatch) {
        const [, callingFunction, filename, line] = callingInfoMatch;
        return { callingFunction, filename, line };
      }
    }
    return { callingFunction: 'Unknown', filename: 'Unknown', line: 'Unknown' };
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  formatMessage(level, callingInfo, message, data) {
    const timestamp = new Date().toISOString();
    const formattedData = data ? JSON.stringify(data) : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${callingInfo.callingFunction} - ${callingInfo.filename}:${callingInfo.line}] ${message} ${formattedData}`;
  }
}

module.exports = new Logger();

