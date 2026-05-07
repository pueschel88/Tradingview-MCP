/**
 * Typed error classes. Every thrown error in this package extends one of these,
 * so callers can match error.name or instanceof and know exactly what failed.
 */

export class TradingViewMcpError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TradingViewMcpError';
  }
}

export class ConnectionError extends TradingViewMcpError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ConnectionError';
  }
}

export class TradingViewNotRunningError extends ConnectionError {
  constructor(port: number) {
    super(
      `TradingView Desktop not reachable on debug port ${port}. ` +
        `Make sure TradingView is running and was launched with --remote-debugging-port=${port}. ` +
        `Run \`tradingview-mcp doctor\` for diagnostic help.`,
    );
    this.name = 'TradingViewNotRunningError';
  }
}

export class ToolExecutionError extends TradingViewMcpError {
  constructor(
    public readonly tool: string,
    message: string,
    cause?: unknown,
  ) {
    super(`[${tool}] ${message}`, cause);
    this.name = 'ToolExecutionError';
  }
}

export class InvalidInputError extends TradingViewMcpError {
  constructor(
    public readonly tool: string,
    message: string,
  ) {
    super(`[${tool}] invalid input — ${message}`);
    this.name = 'InvalidInputError';
  }
}

export class ChartStateError extends TradingViewMcpError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ChartStateError';
  }
}
