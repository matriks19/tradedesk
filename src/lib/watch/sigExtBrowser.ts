/** Tarayıcı paketi: bun build src/lib/watch/sigExtBrowser.ts --outfile public/sig-ext.js --minify --target browser --format iife */
import { hybridMacdPump, kdcMacdSignals, ikiliSignals, kdc, macdPd, to4h } from "./sigExt";
import { umutSignals } from "./umut";
(globalThis as unknown as { QXSigExt: unknown }).QXSigExt = { hybridMacdPump, kdcMacdSignals, ikiliSignals, kdc, macdPd, to4h, umutSignals, v: 1 };
