'use client';
// [engine141] Tek robot motoru: QUANTEX sekmesi açık değilse TradeDesk motoru gizli iframe'de çalıştırır.
// Kilit: localStorage qx_engine_lock_v1 {id,ts} — yalnız lider sekme tarar/işlem açar.
import { useEffect, useState } from 'react';

function lockFresh() {
  try { const L = JSON.parse(localStorage.getItem('qx_engine_lock_v1') || 'null'); return !!L && Date.now() - L.ts < 30000; } catch { return false; }
}
function robotOn() {
  try {
    const a = JSON.parse(localStorage.getItem('qxbot_state_v1') || '{}');
    const b = JSON.parse(localStorage.getItem('qxbot_bist_v1') || '{}');
    return !!(a.running || b.running);
  } catch { return false; }
}
export default function EngineHost() {
  const [host, setHost] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || /quantex/.test(location.pathname)) return;
    const chk = () => { if (localStorage.getItem('qx_engine_off') === '1') { setHost(false); return; }
      if (!lockFresh() && robotOn()) setHost(true); };
    const t0 = setTimeout(chk, 8000), t = setInterval(chk, 30000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, []);
  if (!host) return null;
  return <iframe src="/quantex.html?engine=1" title="robot-engine" aria-hidden
    style={{ position: 'fixed', width: 1, height: 1, left: -10, top: -10, opacity: 0, border: 0, pointerEvents: 'none' }} />;
}
