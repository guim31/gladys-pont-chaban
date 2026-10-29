// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys
// in the tests) and returns the service, so index.js stays a few lines and the
// tests drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { upcoming } from './closures.js';
import { normalizeConfig } from './config.js';
import { CHECK_TEXT, INIT_FAILED } from './i18n.js';
import { createOpenData } from './opendata.js';
import { SCENE_ACTIONS, nextSentence } from './scenes.js';
import { BridgeService } from './service.js';
import { createStore } from './store.js';
import { formatDateTime } from './time.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'chaban-app' });

export const CHECK_ACTION = 'check';

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, api, now, timeZone, timers
 */
export function registerHandlers(gladys, options = {}) {
  const service = new BridgeService({
    gladys,
    store: options.store ?? createStore(),
    api: options.api ?? createOpenData(),
    now: options.now,
    timeZone: options.timeZone,
    timers: options.timers ?? true,
  });

  // Resolved once the service has started; every handler waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        await service.resync(config);
        return;
      }
      started = true;
      await service.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      // The handlers keep answering, with the defaults if need be.
      service.config ??= normalizeConfig({});
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
      // The next status report replaces this one.
      service.statusKey = undefined;
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => service.publishDevices()));

  gladys.onDeviceCreated(whenReady(() => service.deviceCreated()));

  // The widget is titled with the device name: follow renames and deletions.
  gladys.onDeviceUpdated(whenReady(() => service.refreshWidget()));
  gladys.onDeviceDeleted(whenReady(() => service.refreshWidget()));

  gladys.onConfigUpdated(whenReady((config) => service.reconfigure(normalizeConfig(config))));

  gladys.onAction(
    CHECK_ACTION,
    whenReady(async () => {
      logger.info('Action "check": reading the closures again');
      await service.check();
      return checkMessage(service);
    }),
  );

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(service, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(service, request)),
    );
  }

  return { service, ready, stop: () => service.stop() };
}

/** The report of "Check", one text per language. */
export function checkMessage(service) {
  return Object.fromEntries(
    Object.entries(CHECK_TEXT).map(([language, text]) => {
      const lines = [];
      const closures = service.closures();
      if (closures) {
        lines.push(text.read(upcoming(closures, service.now()).length));
        lines.push(nextSentence(service, language));
        if (service.modified) {
          lines.push(text.updated(formatDateTime(service.modified, language, service.timeZone)));
        }
      }
      lines.push('', service.apiError ? text.stale(service.apiError) : text.fresh);
      return [language, lines.join('\n')];
    }),
  );
}
