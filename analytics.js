/*
  First-party visitor analytics for Exhibition Radar. No cookies, no
  third-party scripts. Events are queued and sent in small batches to our
  own /api/events, which turns the request's IP into a place and a
  once-a-day visitor hash and then discards it (backend/analytics.py).

  Each page sets data-page on this script's tag; the page view is sent
  automatically. Pages report interactions with:

      window.erTrack("show_open", { exhibition_id: 12, target: "list" })
      window.erTrack("search", { target: "hockney", props: { results: 3 } })
*/
(function () {
  const script = document.currentScript;
  const page = (script && script.dataset.page) || "home";
  const API_BASE = "https://exhibitionradar.com";
  const ENDPOINT = `${API_BASE}/api/events`;

  // One id per tab, gone when the tab closes (sessionStorage, not a cookie).
  let session = "";
  try {
    session = sessionStorage.getItem("er_sid") || "";
    if (!session) {
      session = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("er_sid", session);
    }
  } catch { session = ""; }
  let landing = false;
  try {
    landing = !sessionStorage.getItem("er_landed");
    sessionStorage.setItem("er_landed", "1");
  } catch { /* storage blocked: every page view counts as a landing */ }

  const params = new URLSearchParams(location.search);
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const touch = navigator.maxTouchPoints > 0;
  const context = {
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || params.get("ref") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    language: navigator.language || "",
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })(),
    viewport_w: width,
    device: touch && width <= 760 ? "phone" : touch && width <= 1180 ? "tablet" : "desktop",
  };

  let queue = [];
  let timer = null;

  function send(useBeacon) {
    if (!queue.length) return;
    const body = JSON.stringify({ page, session, context, events: queue.splice(0, 50) });
    if (useBeacon && navigator.sendBeacon) {
      // text/plain keeps the beacon a "simple" request (no CORS preflight).
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
    }
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
    if (queue.length) send(useBeacon);
  }

  function track(name, data) {
    data = data || {};
    const event = { name };
    if (data.exhibition_id != null) event.exhibition_id = data.exhibition_id;
    if (data.target != null && data.target !== "") event.target = String(data.target).slice(0, 300);
    if (data.props) event.props = data.props;
    queue.push(event);
    if (queue.length >= 20) { clearTimeout(timer); timer = null; send(false); return; }
    if (!timer) timer = setTimeout(() => { timer = null; send(false); }, 3000);
  }

  // Time actually spent looking at the page (visible tab only), sent when
  // the visitor leaves or switches away.
  let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  let engagedMs = 0;
  let reported = false;
  const startedAt = Date.now();
  let maxScroll = 0;
  addEventListener("scroll", () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - innerHeight;
    if (scrollable > 0) maxScroll = Math.max(maxScroll, Math.round(scrollY / scrollable * 100));
  }, { passive: true });
  window.erReportScroll = (pct) => { maxScroll = Math.max(maxScroll, pct); };

  function flushEngagement() {
    if (visibleSince != null) { engagedMs += Date.now() - visibleSince; visibleSince = null; }
    if (engagedMs >= 1000 || !reported) {
      track("engagement", { props: { seconds: Math.round(engagedMs / 1000), total_seconds: Math.round((Date.now() - startedAt) / 1000), max_scroll_pct: maxScroll } });
      reported = true;
      engagedMs = 0;
    }
    clearTimeout(timer); timer = null;
    send(true);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEngagement();
    else visibleSince = Date.now();
  });
  addEventListener("pagehide", flushEngagement);

  // Any click on a link that leaves the site.
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a[href]");
    if (!a || a.hasAttribute("data-no-track")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.protocol === "mailto:") { track("outbound_click", { target: "email", props: { href: url.href.slice(0, 200) } }); return; }
    if (!/^https?:$/.test(url.protocol) || url.host === location.host) return;
    const detail = (window.erLinkContext && window.erLinkContext(a)) || {};
    track("outbound_click", {
      exhibition_id: detail.exhibition_id,
      target: detail.kind || "link",
      props: { host: url.host.replace(/^www\./, ""), label: (a.textContent || "").trim().slice(0, 60), ...(detail.props || {}) },
    });
  }, true);

  window.erTrack = track;
  track("page_view", {
    target: location.pathname,
    props: { landing, path: location.pathname, query: location.search.slice(0, 200), title: document.title.slice(0, 120), screen_w: screen.width, screen_h: screen.height, dpr: devicePixelRatio || 1, dark: matchMedia("(prefers-color-scheme: dark)").matches },
  });
})();
