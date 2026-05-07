/**
 * Chrome DevTools Protocol client. Wraps `chrome-remote-interface` with a
 * narrow, type-safe surface focused on the operations this MCP needs:
 *
 *   - locate the TradingView Desktop page among open targets
 *   - evaluate JS expressions in the page context
 *   - capture screenshots of the chart region
 *
 * No browser is launched here — TradingView Desktop must already be running
 * with `--remote-debugging-port=<port>`. This is the explicit user-opt-in
 * boundary that makes the integration safe.
 */

import CDP from 'chrome-remote-interface';
import {
  ConnectionError,
  TradingViewNotRunningError,
} from '../errors.js';
import type { CdpConnectOptions } from '../types.js';

/** A subset of CDP target metadata we care about. */
interface CdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export class CdpClient {
  private client: CDP.Client | null = null;
  private readonly host: string;
  private readonly port: number;
  private readonly preferredTargetId?: string;

  constructor(options: CdpConnectOptions) {
    this.host = options.host;
    this.port = options.port;
    this.preferredTargetId = options.targetId;
  }

  /**
   * Locate the TradingView page among the running Chromium/Electron targets.
   * Falls back to any Electron/Chromium target with "tradingview" in the URL.
   */
  async findTradingViewTarget(): Promise<CdpTarget> {
    let targets: CdpTarget[];
    try {
      targets = (await CDP.List({
        host: this.host,
        port: this.port,
      })) as unknown as CdpTarget[];
    } catch (cause) {
      throw new TradingViewNotRunningError(this.port);
    }

    if (this.preferredTargetId) {
      const explicit = targets.find((t) => t.id === this.preferredTargetId);
      if (!explicit) {
        throw new ConnectionError(
          `No CDP target found with id "${this.preferredTargetId}".`,
        );
      }
      return explicit;
    }

    const tvTarget = targets.find(
      (t) =>
        t.type === 'page' &&
        (t.url.includes('tradingview.com') ||
          t.title.toLowerCase().includes('tradingview')),
    );

    if (!tvTarget) {
      throw new ConnectionError(
        `Found ${targets.length} CDP target(s) on ${this.host}:${this.port}, but ` +
          `none look like TradingView. Targets: ${targets
            .map((t) => `${t.type}:${t.title || t.url}`)
            .slice(0, 5)
            .join(', ')}`,
      );
    }

    return tvTarget;
  }

  /** Connect to the located TradingView target. Idempotent. */
  async connect(): Promise<void> {
    if (this.client) return;

    const target = await this.findTradingViewTarget();
    try {
      this.client = await CDP({
        host: this.host,
        port: this.port,
        target: target.id,
      });
      await this.client.Runtime.enable();
      await this.client.Page.enable();
    } catch (cause) {
      throw new ConnectionError(
        `Failed to attach to TradingView target ${target.id}.`,
        cause,
      );
    }
  }

  /** Close the underlying CDP socket. Safe to call multiple times. */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Evaluate a JS expression in the TradingView page context and return the
   * result as a typed value. The expression should be self-contained and
   * synchronous; for async work, wrap in `(async () => { ... })()`.
   */
  async evaluate<T>(expression: string): Promise<T> {
    await this.connect();
    if (!this.client) {
      throw new ConnectionError('CDP client unexpectedly null after connect()');
    }
    const result = await this.client.Runtime.evaluate({
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new ConnectionError(
        `Page-side evaluation failed: ${result.exceptionDetails.text}`,
        result.exceptionDetails,
      );
    }
    return result.result.value as T;
  }

  /** Capture a screenshot of the entire viewport as a base64 PNG. */
  async screenshot(): Promise<string> {
    await this.connect();
    if (!this.client) {
      throw new ConnectionError('CDP client unexpectedly null after connect()');
    }
    const { data } = await this.client.Page.captureScreenshot({
      format: 'png',
      fromSurface: true,
    });
    return data;
  }
}
