// ---- The app (html.is-app; the App design, Oct 2026) ----------------------
// Inside the iPhone app (app/, Capacitor appends ExhibitionRadarApp to its
// user agent; ?app=1 previews it in a browser) the phone layout takes the
// App design's shape. This file is the app's own code; app.css is its look.
// Both are loaded by index.html's head script in app mode only, and this is
// a classic script, so everything index.html's script declares at top level
// (state, render(), swapTab(), the pins' PIN_INK, the hooks appFilter,
// appPinShape and appMapFly) is in scope here. Nothing below touches them
// until the page's script has run (appInit, on DOMContentLoaded).
//
// The map tab (phase A, 26 Oct 2026, from the handoff of that day): three
// drop-down pills under the search, location / type / when (the 10 Oct
// entries); the date sets as three round pin buttons over the tab bar (10
// and 12 Oct); the city round with a globe, a press-and-hold quick list of
// your cities, and a city change that flies the map (9 Oct); Settings,
// pushed from the profile tab (8 and 9 Oct); the chrome tokens and the
// colourblind palette (9 Oct).
//
// Discover and the profile's pages (phase B, 26 Oct 2026, the same handoff):
// Discover is a reel of the shows with pictures, one a screen, that opens a
// show in place (the 9 Oct entries); the profile is the top-down list
// (Plan a Gallery Night, Communities, Following, Settings) over the dish
// and "Hi <name>" (8 and 9 Oct); and the partner pages open inside the app
// from the way in (8 Oct).

const app = { tab: "radar", radarView: null, drop: null, menu: null, sub: null, quick: false, held: false, cols: 2,
  authMode: "signup", authStep: "email", homePick: "", seen: null, status: "",
  loc: ["near"], // the location pill's picks: "near", or "city:<name>"s; [] is all cities
  // Discover: the open show (its id), whether it has gone fullscreen, the
  // rows drawn (as a key), the reel's scroll, the shows whose pictures have
  // been swiped (their dots show), each picture's proportion, and where a
  // "see it on the map" left off (the show and the search), restored on
  // the way back (the App design, 9 Oct 2026).
  disc: { open: null, full: false, key: "", scroll: 0, swiped: new Set(), asp: new Map(), back: null, loading: false },
  focus: null,     // a venue the map is to fly to and open once it's built: { key, until }
  night: { when: "tonight", who: [], note: "", route: null },
  comm: { plans: null, busy: false },
  follow: { shown: null },
  partner: { page: null, form: null },
};
// The cities listed under "nearest" in the city drop-down, and offered as
// a home city at signup.
const APP_HUBS = ["New York", "London", "Paris", "Los Angeles", "Berlin", "Hong Kong", "Seoul", "Tokyo", "Basel", "Venice", "Mexico City", "São Paulo"];
const APP_TABS = ["radar", "discover", "profile"];
const APP_NEAR_KM = 3; // "near me": within this of where you are (the App design)
const APP_FLY_MS = 1800; // a city change flies the map there (the App design, 9 Oct 2026)

// ---- Kept on the device ----------------------------------------------------
// The design's own keys where it had them (er-pinned-cities, er-my-cities,
// er-bigtext, er-cvd), so a device that ran the prototype keeps its picks.
// No account is needed for any of these; the home city is also sent to the
// account's preferences when there is one.
// er-my-list is Discover's "add to my list" (the design's key, 9 Oct 2026):
// show keys, which outlive a show's id across scrapes; er-night-when and
// er-joined-plans hold what the backend has no row for yet (the night's
// day, the shared plans you said you're going to).
const APP_KEYS = { pinned: "er-pinned-cities", recents: "er-my-cities", notifs: "er-notifs", bigText: "er-bigtext", cvd: "er-cvd", theme: "er_app_theme", home: "er-home-city",
  list: "er-my-list", nightWhen: "er-night-when", joined: "er-joined-plans" };
function appRead(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function appWrite(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: the pick lasts the visit */ }
}
const prefs = {
  pinned: appRead(APP_KEYS.pinned, []),   // "My cities" in Settings: names as the catalogue spells them
  recents: appRead(APP_KEYS.recents, []), // the last cities flown to, newest first
  notifs: appRead(APP_KEYS.notifs, {}),   // { newShows, openings, friends }: switches only, no backend sends anything yet
  bigText: String(appRead(APP_KEYS.bigText, 0)) === "1",
  cvd: String(appRead(APP_KEYS.cvd, 0)) === "1",
  theme: (() => { const t = appRead(APP_KEYS.theme, ""); return ["auto", "light", "dark"].includes(t) ? t : ""; })(),
  home: appRead(APP_KEYS.home, ""),
  list: appRead(APP_KEYS.list, []),       // Discover's "my list": show keys, newest first
  joined: appRead(APP_KEYS.joined, []),   // friends' shared plans you're going to: "<handle>" strings
};
if (!Array.isArray(prefs.pinned)) prefs.pinned = [];
if (!Array.isArray(prefs.recents)) prefs.recents = [];
if (!prefs.notifs || typeof prefs.notifs !== "object") prefs.notifs = {};
if (!Array.isArray(prefs.list)) prefs.list = [];
if (!Array.isArray(prefs.joined)) prefs.joined = [];
app.night.when = String(appRead(APP_KEYS.nightWhen, "tonight") || "tonight");

// ---- Pins: colour and shape -----------------------------------------------
// The app's upcoming blue is #3545d6 (the App design, 9 Oct 2026; links stay
// #0000ff). Colourblind mode is the Okabe-Ito palette, and single-show pins
// are told apart by shape as well: a dot on view, a ring this week, a square
// upcoming. index.html's drawPinImage asks appPinShape for the shape, and
// PIN_INK is its colours; a change redraws the pictures the map already holds.
const APP_PIN_INK = {
  plain: { "": "#cc2200", opening: "#00852a", soon: "#3545d6" },
  cvd: { "": "#d55e00", opening: "#009e73", soon: "#0072b2" },
};
function appPinShape(kind) {
  if (!prefs.cvd) return "dot";
  return kind === "opening" ? "ring" : kind === "soon" ? "square" : "dot";
}
function appPaintPins() {
  Object.assign(PIN_INK, prefs.cvd ? APP_PIN_INK.cvd : APP_PIN_INK.plain);
  document.documentElement.toggleAttribute("data-cvd", prefs.cvd);
  for (const id of [...pinImageCache.keys()]) {
    const drawn = drawPinImage(id);
    pinImageCache.set(id, drawn);
    if (map && map.hasImage(id)) map.updateImage(id, drawn.image);
  }
  if (map) map.triggerRepaint();
}

// ---- Cities ------------------------------------------------------------------
let appNamesFrom = null, appNamesMap = new Map();
// Every city in the catalogue, by its lowercase name, spelt as the data spells it.
function appCityNames() {
  if (appNamesFrom !== state.data.current) {
    appNamesFrom = state.data.current;
    appNamesMap = new Map();
    for (const e of [...state.data.current, ...state.data.upcoming]) if (e.city && !appNamesMap.has(e.city.toLowerCase())) appNamesMap.set(e.city.toLowerCase(), e.city);
  }
  return appNamesMap;
}
const appNamed = (n) => appCityNames().get(String(n || "").toLowerCase()) || "";
function appHomeName() {
  return appNamed(prefs.home || radar.prefs?.home_city || currentUser?.preferences?.home_city || state.homeCity);
}
// Your cities, in the order the design lists them: home, the ones pinned
// in Settings, the city showing, then recent picks. Only cities with shows.
function appMyCities() {
  const out = [];
  for (const n of [appHomeName(), ...prefs.pinned, state.city, ...prefs.recents]) {
    const name = appNamed(n);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}
function appRemember(city) {
  prefs.recents = [city, ...prefs.recents.filter(x => x.toLowerCase() !== city.toLowerCase())].slice(0, 6);
  appWrite(APP_KEYS.recents, prefs.recents);
}
function appCityCentres() {
  const sums = new Map();
  for (const e of [...state.data.current, ...state.data.upcoming]) {
    if (!e.city || e.latitude == null || e.longitude == null) continue;
    const v = sums.get(e.city) || [0, 0, 0];
    v[0] += +e.latitude; v[1] += +e.longitude; v[2]++;
    sums.set(e.city, v);
  }
  return new Map([...sums].map(([k, v]) => [k, [v[0] / v[2], v[1] / v[2]]]));
}
function appKm(a, b) {
  const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
// Where you are, if this visit knows: the "closest" grant or the locate dot.
function appHere() {
  const h = userLocation || hereDot.current;
  return h && h.lat != null ? [+h.lat, +h.lng] : null;
}
// Going to a city: the map flies (syncMap sees the city change and calls
// appMapFly), the location pill reads it, and it joins the recents.
function appGoCity(city) {
  state.city = city;
  mapAutoCity = "";
  app.loc = city ? ["city:" + city] : [];
  if (city) appRemember(city);
  track("city_filter", { target: city || "all cities", props: { tab: state.tab, view: state.view, app: true } });
  render();
}

// ---- The filters: location, type, when -------------------------------------
// Type and when are the site's own boxes (state.kinds, matchesKinds in
// index.html), under the design's names, plus "spaces I track" (the
// galleries you follow). Location is the app's: near me (within 3 km of
// where you are), all cities, or any of your cities. appFilter, read by
// visibleRows, carries what the site's boxes don't.
const APP_TYPE = [["gallery", "galleries"], ["museum", "museums / foundations / centers"], ["solo", "solo exhibitions"], ["group", "group exhibitions"], ["tracked", "spaces I track"]];
const APP_WHEN = [["open", "open now"], ["closing", "closing soon"], ["tonight", "opening tonight"]];
function appLocOptions() {
  const home = appHomeName();
  return [["all", "all cities"], ["near", "near me"], ...appMyCities().map(c => ["city:" + c, c === home ? `${c} · home` : c])];
}
function appPass(e) {
  if (state.kinds.includes("tracked") && !radar.favorites.has(e.gallery_key)) return false;
  const here = appHere();
  // Near me with nowhere to measure from (location not allowed, or not in
  // yet) asks for nothing: the map homes on its own city as it does anyway.
  const keys = app.loc.filter(k => k !== "near" || here);
  if (!keys.length) return true;
  for (const k of keys) {
    if (k === "near") { if (hasCoords(e) && appKm(here, [+e.latitude, +e.longitude]) <= APP_NEAR_KM) return true; }
    else if (e.city === k.slice(5)) return true;
  }
  return false;
}
function appMenuItems(menu) {
  if (menu === "loc") return appLocOptions().map(([k, label]) => [k, label, k === "all" ? !app.loc.length : app.loc.includes(k)]);
  const list = menu === "type" ? APP_TYPE : APP_WHEN;
  return list.map(([k, label]) => [k, label, state.kinds.includes(k)]);
}
function appPillWord(menu) {
  if (menu === "loc") {
    if (!app.loc.length) return "all cities";
    const first = app.loc[0] === "near" ? "near me" : app.loc[0].slice(5);
    return app.loc.length > 1 ? `${first} +${app.loc.length - 1}` : first;
  }
  const list = menu === "type" ? APP_TYPE : APP_WHEN;
  const on = list.filter(([k]) => state.kinds.includes(k));
  if (!on.length) return menu;
  return on.length > 1 ? `${on[0][1]} +${on.length - 1}` : on[0][1];
}
function renderAppFilters() {
  const row = $("app-filters");
  if (row.hidden) return;
  for (const btn of row.querySelectorAll(".app-pill")) {
    const menu = btn.dataset.appMenu;
    const items = appMenuItems(menu);
    const any = menu === "loc" ? app.loc.length > 0 : items.some(i => i[2]);
    btn.classList.toggle("on", any);
    btn.classList.toggle("open", app.menu === menu);
    btn.setAttribute("aria-expanded", String(app.menu === menu));
    btn.querySelector("span").textContent = appPillWord(menu);
    const box = btn.nextElementSibling;
    box.hidden = app.menu !== menu;
    if (box.hidden) continue;
    box.innerHTML = items.map(([k, label, on]) => `<button type="button" role="option" data-app-opt="${escAttr(k)}" aria-selected="${on}"><span>${esc(label)}</span><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7"/></svg></button>`).join("")
      + (any ? `<button type="button" class="app-menu-clear" data-app-clear="${menu}">clear</button>` : "");
  }
  $("app-catch").hidden = !app.menu && !app.quick;
}
function appOpenMenu(menu) {
  if (app.menu === menu) return appCloseMenu();
  appCloseDrop(); appCloseQuick(); closeSheet();
  app.menu = menu;
  renderAppFilters();
}
function appCloseMenu() {
  if (!app.menu) return;
  app.menu = null;
  renderAppFilters();
}
function appPickOption(menu, key) {
  if (menu === "loc") {
    const before = state.city;
    if (key === "all") app.loc = [];
    else app.loc = app.loc.includes(key) ? app.loc.filter(k => k !== key) : [...app.loc, key];
    // One city picked frames that city (and the city round names it);
    // several, or near me, frame whatever passes.
    const cities = app.loc.filter(k => k.startsWith("city:")).map(k => k.slice(5));
    state.city = cities.length === 1 && !app.loc.includes("near") ? cities[0] : "";
    mapAutoCity = "";
    if (state.city) appRemember(state.city);
    track("city_filter", { target: state.city || (app.loc.includes("near") ? "near me" : "all cities"), props: { tab: state.tab, view: state.view, app: true, picks: app.loc.length } });
    render();
    // The frame follows the picks even when the city didn't change (near
    // me, or a second city): syncMap only reframes on a new city.
    if (map && state.city === before) appMapFly();
    return;
  }
  state.kinds = state.kinds.includes(key) ? state.kinds.filter(x => x !== key) : [...state.kinds, key];
  track("type_filter", { target: key, props: { on: state.kinds.includes(key), view: state.view, app: true } });
  render();
}
function appClearMenu(menu) {
  if (menu === "loc") { app.loc = []; state.city = ""; mapAutoCity = ""; render(); if (map) appMapFly(); return; }
  const keys = (menu === "type" ? APP_TYPE : APP_WHEN).map(([k]) => k);
  state.kinds = state.kinds.filter(k => !keys.includes(k));
  render();
}

// A city change in the app flies the map there (about 1.8 s, out and back
// in) with the pins already in place, instead of fading to the loader
// (the App design, 9 Oct 2026). syncMap calls this where the site calls
// mapTransition; the location picks call it too, since their frame can
// change with the city staying put.
function appMapFly() {
  if (state.view !== "map" || !map) return;
  if (state.mapPoint) closeVenuePanel();
  drawPins();
  const groups = venueGroups();
  if (!groups.length) return;
  const { bounds, fitBoundsOptions } = mapFrame(groups);
  map.fitBounds(bounds, { ...fitBoundsOptions, duration: reducedMotion.matches ? 0 : APP_FLY_MS, essential: true });
}

// ---- The chrome ---------------------------------------------------------------
function syncAppChrome() {
  if (!isApp) return;
  document.body.dataset.appOn = app.tab;
  document.documentElement.dataset.cols = String(app.cols);
  const tabs = $("app-tabs");
  tabs.style.setProperty("--app-tab-i", String(APP_TABS.indexOf(app.tab)));
  tabs.querySelectorAll("[data-app-tab]").forEach(b => {
    if (b.dataset.appTab === app.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  const radarBtn = tabs.querySelector('[data-app-tab="radar"]');
  radarBtn.dataset.view = app.tab === "radar" ? state.view : (app.radarView || state.view);
  radarBtn.setAttribute("aria-label", app.tab === "radar" ? `the radar, ${state.view}: tap for the ${state.view === "grid" ? "map" : "grid"}` : "the radar");
  tabs.querySelector('[data-app-tab="profile"]').setAttribute("aria-label", currentUser ? "profile" : "log in");
  const onRadar = app.tab === "radar";
  const grid = onRadar && state.view === "grid";
  $("app-cols-btn").classList.toggle("shown", grid);
  $("app-filters").classList.toggle("with-cols", grid);
  $("app-cols-btn").setAttribute("aria-label", `grid: ${app.cols} across, tap to change`);
  $("app-city-btn").setAttribute("aria-label", `city: ${state.city || "all cities"}`);
  $("app-city-btn").setAttribute("aria-expanded", String(app.drop === "cities" || app.quick));
  // The filter round and its clear are the pills' now; the date sets are
  // the pin buttons over the tab bar, on the map only.
  $("app-clear-btn").hidden = true;
  $("app-clear-string").setAttribute("hidden", "");
  // The pills serve the map and Discover alike (the App design, 10 Oct 2026).
  const onDisc = app.tab === "discover";
  $("app-filters").hidden = !onRadar && !onDisc;
  const pins = $("app-pins");
  pins.hidden = !(onRadar && state.view === "map");
  if (!pins.hidden) renderAppPins();
  renderAppFilters();
  if (app.drop) renderAppDrop();
  $("app-disc").hidden = !onDisc;
  document.body.classList.toggle("app-disc-open", onDisc && app.disc.open != null);
  document.body.classList.toggle("app-disc-full", onDisc && app.disc.open != null && app.disc.full);
  $("app-disc-back").hidden = !(onDisc && app.disc.open != null);
  if (onDisc) renderAppDisc();
  syncPhoneTop();
}

// ---- The pin buttons --------------------------------------------------------
// The three date sets as round buttons above the tab bar, one over each
// tab: filled with the pin's colour when on, black at 60% when off, each
// with the white pin and its coloured centre (the App design, 10 and 12
// Oct 2026). They replace the date-set pills along the top.
const APP_PIN_TILT = { current: -5, opening: 4, upcoming: -2 };
function appPinSVG(set, w = 17, h = 23) {
  const shape = appPinShape(PIN_KIND[set]);
  const centre = shape === "ring" ? `<circle cx="11" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>`
    : shape === "square" ? `<rect x="8.2" y="8.2" width="5.6" height="5.6" fill="currentColor" stroke="none"/>`
    : `<circle cx="11" cy="11" r="3.2" fill="currentColor" stroke="none"/>`;
  return `<svg class="app-pin" width="${w}" height="${h}" viewBox="0 0 22 30" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(${APP_PIN_TILT[set]}deg)"><path d="M11 29 C11 22 4 17.5 4 11 A7 7 0 1 1 18 11 C18 17.5 11 22 11 29Z" stroke="#ffffff" fill="#ffffff"/>${centre}</svg>`;
}
function renderAppPins() {
  const on = tabSets();
  const box = $("app-pins");
  const key = `${on.join("+")}|${prefs.cvd ? 1 : 0}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.innerHTML = TAB_ORDER.map(set => `<button type="button" data-app-set="${set}" aria-pressed="${on.includes(set)}" aria-label="${escAttr(TAB_LABELS[set])}" title="${escAttr(TAB_LABELS[set])}">${appPinSVG(set)}</button>`).join("");
}
function appToggleSet(set) {
  const on = tabSets();
  const next = on.includes(set) ? on.filter(t => t !== set) : [...on, set];
  // The last set can't be cleared: an empty radar isn't a view anyone is
  // asking for (as the site's date-set boxes).
  if (!next.length) return;
  track("tab_change", { target: `${TAB_LABELS[set]} ${on.includes(set) ? "off" : "on"}`, props: { sets: tabKey(next), app: true } });
  swapTab(tabKey(next));
  showTabSets(next);
  for (const b of $("app-pins").querySelectorAll("[data-app-set]")) b.setAttribute("aria-pressed", String(next.includes(b.dataset.appSet)));
  $("app-pins").dataset.key = "";
}

// ---- The city round: the drop-down, and press-and-hold for your cities ------
// The city drop-down: your cities (home and the ones pinned in Settings),
// "nearest" (to where you are, if this visit already knows, else to your
// home city, marked "home"), then the main cities. Only cities with shows.
function appCitiesHTML() {
  const centres = appCityCentres();
  const named = appNamed;
  const home = appHomeName();
  const here = appHere();
  const origin = here ? here : home ? centres.get(home) : null;
  const mine = appMyCities().filter(n => n === home || prefs.pinned.some(p => p.toLowerCase() === n.toLowerCase()));
  let near = [];
  if (origin) {
    near = [...centres.keys()].sort((a, b) => appKm(origin, centres.get(a)) - appKm(origin, centres.get(b))).slice(0, 5);
    if (!here && home) near = [home, ...near.filter(n => n !== home)].slice(0, 5);
  }
  near = near.filter(n => !mine.includes(n));
  const hubs = APP_HUBS.map(named).filter(n => n && !near.includes(n) && !mine.includes(n));
  const row = (n) => `<button type="button" data-city="${escAttr(n)}" class="${state.city === n ? "on" : ""}" aria-pressed="${state.city === n}"><span>${esc(n)}</span>${n === home ? `<span class="home">home</span>` : ""}</button>`;
  const section = (label, list, ruled) => list.length ? `<div class="${ruled ? "ruled" : ""}">${label ? `<div class="drop-label">${label}</div>` : ""}<div class="drop-grid">${list.map(row).join("")}</div></div>` : "";
  return `<div class="app-cities">${section("my cities", mine, false)}${section("nearest", near, mine.length > 0)}${section("", hubs, mine.length + near.length > 0)}</div>`;
}
function renderAppDrop() {
  $("app-drop-body").innerHTML = appCitiesHTML();
}
let appDropTimer = null;
function appToggleDrop(kind) {
  if (app.drop === kind) return appCloseDrop();
  closeSheet(); appCloseMenu(); appCloseQuick();
  clearTimeout(appDropTimer);
  const fresh = !app.drop;
  app.drop = kind;
  renderAppDrop();
  for (const id of ["app-drop", "app-scrim"]) { $(id).classList.remove("closing"); $(id).hidden = false; }
  if (fresh) $("app-drop-body").scrollTop = 0;
  syncAppChrome();
}
function appCloseDrop() {
  if (!app.drop) return;
  app.drop = null;
  for (const id of ["app-drop", "app-scrim"]) $(id).classList.add("closing");
  clearTimeout(appDropTimer);
  appDropTimer = setTimeout(() => { if (!app.drop) $("app-drop").hidden = $("app-scrim").hidden = true; }, reducedMotion.matches ? 0 : 160);
  syncAppChrome();
}
// Press and hold the city round (about half a second, with a light buzz
// where the device gives one): your cities, right under it. Tap one to fly
// there; tap anywhere else to dismiss. A plain tap still opens the full
// drop-down (the App design, 9 Oct 2026).
function appOpenQuick() {
  appCloseDrop(); appCloseMenu(); closeSheet();
  const counts = new Map(cityCentroids().map(c => [c.city, c.n]));
  const home = appHomeName();
  const names = appMyCities();
  if (!names.length) return;
  const box = $("app-quick");
  box.innerHTML = `<div class="app-quick-label">my cities</div><div class="app-quick-chips">` + names.map(n =>
    `<button type="button" data-app-quick="${escAttr(n)}" aria-pressed="${state.city === n}"><span>${esc(n)}</span>${n === home ? `<small>home</small>` : `<small>${counts.get(n) || 0}</small>`}</button>`).join("") + `</div>`;
  const r = $("app-city-btn").getBoundingClientRect();
  box.style.top = `${Math.round(r.bottom + 8)}px`;
  box.style.right = `${Math.round(document.documentElement.clientWidth - r.right)}px`;
  app.quick = true;
  box.hidden = false;
  $("app-catch").hidden = false;
  syncAppChrome();
}
function appCloseQuick() {
  if (!app.quick) return;
  app.quick = false;
  $("app-quick").hidden = true;
  $("app-catch").hidden = !app.menu;
  syncAppChrome();
}

// ---- Tabs ------------------------------------------------------------------
// A change of tab: blur the old screen out, switch while it's soft, sharpen
// the new one in.
let appFxTimer = null;
function appFx(fn) {
  if (reducedMotion.matches) { fn(); return; }
  clearTimeout(appFxTimer);
  document.body.classList.add("app-fx");
  appFxTimer = setTimeout(() => { fn(); requestAnimationFrame(() => document.body.classList.remove("app-fx")); }, 130);
}
function appGo(tab) {
  appCloseDrop(); appCloseMenu(); appCloseQuick();
  closeSheet();
  closeVenuePanel();
  // An open show gives way too: the tab goes straight where it says.
  if (!$("phone-detail").hidden && typeof closePhoneDetail === "function") closePhoneDetail(false);
  if (tab === app.tab) {
    if (tab === "radar") swapView(state.view === "grid" ? "map" : "grid");
    // The discover tab, with a show open, closes it back to the reel (the
    // App design, 9 Oct 2026).
    else if (tab === "discover" && app.disc.open != null) appDiscClose();
    // A pushed page (Settings, a gallery night) pops back to the profile.
    else if (tab === "profile" && app.sub) appPopSub();
    return;
  }
  appFx(() => {
    const was = app.tab;
    app.tab = tab;
    app.sub = null; // tapping map or discover from a pushed page dismisses it (the App design, 9 Oct 2026)
    appNightMapDrop();
    if (was === "radar") app.radarView = state.view;
    if (was === "discover") app.disc.scroll = $("app-reel").scrollTop;
    // Under the reel the radar rests as the grid (the map is let go, as the
    // site's own grid lets it go), and comes back as it was left.
    if (tab === "discover" && state.view !== "grid") swapView("grid");
    if (tab === "radar" && app.radarView && app.radarView !== state.view) swapView(app.radarView);
    if (tab === "profile") { app.status = ""; renderAppPage(); loadAppProfile(); }
    $("app-page").hidden = tab !== "profile";
    if (tab !== "profile") window.scrollTo(0, 0);
    syncAppChrome();
    if (tab === "discover") appDiscReturn();
  });
}

// ---- Discover ------------------------------------------------------------------
// A reel of the shows with pictures (every city, both date sets), one a
// screen, under the same search and pills as the map. One swipe moves one
// show; a tap opens the show in place, the picture gliding to the top half
// with the details below; a tap on the picture goes fullscreen; back, or
// the discover tab, closes it. Only shows with a real picture of their own
// are in it, and one whose picture fails to load drops out (the App
// design, 9 Oct 2026).
const APP_REEL_W = 800; // the picture is asked for at 800px (1600 on a sharp screen)
function appRealImage(e) {
  const img = showImage(e);
  if (!img || !/^https?:\/\//i.test(img.url) || /og-image\.png|placeholder|no[-_]?image/i.test(img.url)) return null;
  return img;
}
function appDiscRows() {
  const seen = new Set(), rows = [];
  for (const e of [...state.data.current, ...state.data.upcoming]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (!appRealImage(e) || !matchesSearch(e) || !matchesKinds(e) || !appPass(e)) continue;
    rows.push(e);
  }
  return rows;
}
// Which date set a show belongs to: on view (red), opening this week
// (green) or upcoming (blue), as the map colours it.
function appSetOf(e) {
  const onView = state.data.current.some(x => x.id === e.id);
  if (onView) return openingToday(e) ? "opening" : "current";
  return opensThisWeek(e) ? "opening" : "upcoming";
}
const appMonthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
// "Sep 10 – Nov 7", as the design writes the reel's dates (the grid's
// capitals would shout over a picture).
function appDates(start, end) {
  const f = (iso) => appMonthDay.format(parseISODate(iso));
  if (!start && !end) return "dates to be confirmed";
  if (!start) return `until ${f(end)}`;
  if (!end) return `from ${f(start)}`;
  return `${f(start)} – ${f(end)}`;
}
function appArtistsLine(e, max = 3) {
  const names = (e.artists || []).map(a => a.trim()).filter(Boolean);
  return names.length > max ? `${names.slice(0, max).join(", ")} + ${names.length - max} more` : names.join(", ");
}
// A show's installation shots, when the data carries them (no field does
// yet; the strip swipes once one does).
const appShots = (e) => (e.installation_images || e.images || []).filter(u => u && /^https?:\/\//i.test(u) && u !== e.image_url && u !== e.display_image_url);
const appInList = (e) => prefs.list.includes(e.show_key);
const APP_SVG = {
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6s1.2-6.2 3.6-8.6z"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9"/></svg>`,
  tick: `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7"/></svg>`,
  share: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10.5V2"/><path d="M5 4.8L8 1.8l3 3"/><path d="M3.5 7.5v6h9v-6"/></svg>`,
  out: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l5-5"/><path d="M4.5 3.5h4v4"/></svg>`,
  chevron: `<svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5 7.5 7.5 1.5 13.5"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
};
function appDiscItemHTML(e) {
  const img = appRealImage(e);
  const c = gridCaption(e);
  const artists = appArtistsLine(e);
  const shots = appShots(e);
  const n = 1 + shots.length;
  if (img.w && img.h) app.disc.asp.set(e.id, img.h / img.w);
  const open = app.disc.open === e.id;
  const dates = appDates(e.start_date, e.end_date);
  const opening = openingLine(e);
  const inList = appInList(e);
  const place = [e.neighborhood, e.city].filter(Boolean).join(", ").toLowerCase();
  // The press text, in full, when the data has it and the site shows it
  // (PRESS_TEXT_SHOWN, index.html: off since 13 Oct 2026, the owner); a
  // null description keeps the link to the venue's page and shows no text.
  const press = PRESS_TEXT_SHOWN && e.description ? `<div class="app-press-text">${esc(e.description.trim())}</div>` : "";
  return `<div class="app-reel-item${open ? " open" : ""}" data-id="${e.id}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${escAttr(`open ${c.title || e.venue}`)}">
    <div class="app-strip" data-n="${n}">
      <img ${imgSrcHTML(img.url, APP_REEL_W, "100vw")} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-key="${escAttr(img.url)}">
      ${shots.map(u => `<img src="${escAttr(u)}" alt="installation view" loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join("")}
    </div>
    ${n > 1 ? `<div class="app-dots" aria-hidden="true"${app.disc.swiped.has(e.id) ? "" : " hidden"}>${Array.from({ length: n }, (_, i) => `<span${i === 0 ? ' class="on"' : ""}></span>`).join("")}</div>` : ""}
    <div class="app-cap-shade" aria-hidden="true"></div>
    <div class="app-cap">
      ${artists ? `<div class="app-cap-artists">${esc(artists)}</div>` : ""}
      ${c.title ? `<div class="app-cap-title">${c.titleHTML}</div>` : ""}
      <div class="app-cap-meta">${esc(e.venue)}${e.city ? `, ${esc(e.city.toLowerCase())}` : ""}</div>
      <div class="app-cap-meta">${esc(dates)}</div>
    </div>
    <div class="app-info">
      ${artists ? `<div class="app-info-artists">${esc(artists)}</div>` : ""}
      ${c.title ? `<div class="app-info-title">${c.titleHTML}</div>` : ""}
      <div class="app-info-meta">
        <div class="v">${esc(e.venue)}</div>
        ${place ? `<div>${esc(place)}</div>` : ""}
        <div>${esc(dates)}</div>
        ${opening ? `<div class="opening">${esc(opening)}</div>` : ""}
      </div>
      <div class="app-info-acts">
        ${e.source_url ? `<a class="app-press-link" href="${escAttr(e.source_url)}" target="_blank" rel="noopener"><span>press release</span>${APP_SVG.out}</a>` : ""}
        <div class="app-info-btns">
          ${hasCoords(e) ? `<button type="button" data-disc-act="map" aria-label="see it on the map" title="see it on the map">${APP_SVG.globe}</button>` : ""}
          <button type="button" data-disc-act="list" aria-pressed="${inList}" aria-label="${inList ? "on my list" : "add to my list"}" title="${inList ? "on my list" : "add to my list"}">${inList ? APP_SVG.tick : APP_SVG.plus}</button>
          <button type="button" data-disc-act="share" aria-label="share" title="share">${APP_SVG.share}</button>
        </div>
      </div>
      ${press}
      <div class="app-share-note" role="status" hidden>link copied</div>
    </div>
  </div>`;
}
function renderAppDisc() {
  const box = $("app-disc");
  if (box.hidden) return;
  const rows = appDiscRows();
  const key = rows.map(e => e.id).join(",");
  const reel = $("app-reel");
  if (key !== app.disc.key) {
    app.disc.key = key;
    if (app.disc.open != null && !rows.some(e => e.id === app.disc.open)) { app.disc.open = null; app.disc.full = false; }
    reel.innerHTML = rows.map(appDiscItemHTML).join("");
    // A new set starts at its top, unless a show is open: then at that show.
    const item = app.disc.open != null ? reel.querySelector(`.app-reel-item[data-id="${app.disc.open}"]`) : null;
    if (item) { appDiscLayout(item); reel.scrollTop = item.offsetTop; } else reel.scrollTop = 0;
    app.disc.scroll = reel.scrollTop;
  }
  $("app-disc-empty").hidden = !(state.loaded && rows.length === 0);
  box.classList.toggle("open", app.disc.open != null);
  box.classList.toggle("full", app.disc.open != null && app.disc.full);
}
// The open show's geometry: the picture, at its own proportions, fills the
// width or up to about 64% of the screen's height under the back button,
// and the details start right under it. One transform on the strip, so the
// picture glides rather than re-fits (the App design, 9 Oct 2026).
function appDiscLayout(item) {
  const reel = $("app-reel");
  const W = reel.clientWidth, H = reel.clientHeight;
  if (!W || !H) return;
  const asp = app.disc.asp.get(+item.dataset.id) || 1.25;
  const pad = parseFloat(getComputedStyle($("phone-top")).paddingTop) || 10;
  const top = pad + 48; // under the back button
  const cW = Math.min(W, H / asp), cH = Math.min(H, W * asp), maxH = H * 0.64 - top;
  const s = Math.min(W / cW, maxH / cH), dH = cH * s;
  const y = Math.round(top + dH / 2 - H / 2);
  item.style.setProperty("--img-t", `translateY(${y}px) scale(${s.toFixed(3)})`);
  item.style.setProperty("--info-top", `${Math.round(top + dH + 6)}px`);
  item.style.setProperty("--dots-open", `${Math.round(top + dH - 18)}px`);
}
function appDiscItem(id) { return $("app-reel").querySelector(`.app-reel-item[data-id="${id}"]`); }
function appDiscShow(id) { return [...state.data.current, ...state.data.upcoming].find(e => e.id === id) || null; }
function appDiscOpen(id) {
  const item = appDiscItem(id);
  if (!item) return;
  appCloseMenu();
  const e = appDiscShow(id);
  if (e) track("show_open", { exhibition_id: id, target: "discover", props: showProps(e) });
  app.disc.open = id;
  app.disc.full = false;
  appDiscLayout(item);
  item.classList.add("open");
  item.setAttribute("aria-expanded", "true");
  $("app-reel").scrollTop = item.offsetTop; // squared up on the show, so the glide starts from where it sits
  syncAppChrome();
}
function appDiscClose() {
  const item = app.disc.open != null ? appDiscItem(app.disc.open) : null;
  app.disc.open = null;
  app.disc.full = false;
  app.disc.back = null;
  if (item) { item.classList.remove("open", "full"); item.setAttribute("aria-expanded", "false"); }
  syncAppChrome();
}
function appDiscFull(on) {
  const item = app.disc.open != null ? appDiscItem(app.disc.open) : null;
  if (!item) return;
  app.disc.full = on;
  item.classList.toggle("full", on);
  syncAppChrome();
}
// Back into Discover: the reel where it was left, and after "see it on the
// map" the same show still open with the search restored.
function appDiscReturn() {
  const back = app.disc.back;
  if (back) {
    app.disc.back = null;
    if (back.q !== state.q) { $("search").value = back.q; state.q = back.q; updateSearchChrome(); render(); }
    app.disc.open = back.id;
    app.disc.full = false;
    const item = appDiscItem(back.id);
    if (item) { appDiscLayout(item); item.classList.add("open"); item.setAttribute("aria-expanded", "true"); $("app-reel").scrollTop = item.offsetTop; }
    else app.disc.open = null;
    syncAppChrome();
    return;
  }
  requestAnimationFrame(() => { $("app-reel").scrollTop = app.disc.scroll; });
}
// A swipe moves at most one page from where it began: the scroll is
// clamped to the neighbours and re-anchored once it settles, on top of the
// snap (the App design, 9 Oct 2026).
function appOneStep(el, axis) {
  const size = axis === "x" ? el.clientWidth : el.clientHeight;
  if (!size) return;
  const pos = axis === "x" ? el.scrollLeft : el.scrollTop;
  if (el._anchor == null) el._anchor = Math.round(pos / size);
  const lo = (el._anchor - 1) * size, hi = (el._anchor + 1) * size;
  if (pos > hi + 1 || pos < lo - 1) { const v = Math.max(lo, Math.min(hi, pos)); if (axis === "x") el.scrollLeft = v; else el.scrollTop = v; }
  clearTimeout(el._settle);
  el._settle = setTimeout(() => { const p = axis === "x" ? el.scrollLeft : el.scrollTop; el._anchor = Math.round(p / size); }, 140);
}
function appDiscSwipe(strip) {
  appOneStep(strip, "x");
  const item = strip.closest(".app-reel-item");
  const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
  const dots = item.querySelector(".app-dots");
  if (!dots) return;
  const id = +item.dataset.id;
  // The dots stay hidden until the first swipe of this show's pictures.
  if (!app.disc.swiped.has(id)) { if (i === 0) return; app.disc.swiped.add(id); dots.hidden = false; }
  dots.querySelectorAll("span").forEach((d, k) => d.classList.toggle("on", k === i));
}
function appDiscToggleList(e, btn) {
  const on = !appInList(e);
  prefs.list = on ? [e.show_key, ...prefs.list.filter(k => k !== e.show_key)] : prefs.list.filter(k => k !== e.show_key);
  appWrite(APP_KEYS.list, prefs.list);
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", on ? "on my list" : "add to my list");
  btn.title = on ? "on my list" : "add to my list";
  btn.innerHTML = on ? APP_SVG.tick : APP_SVG.plus;
}
// Share a show: the phone's sheet with its exhibitionradar.com page, else
// the link copied and "link copied" said (the same routes as the site's
// Share, shareLink in index.html).
async function appDiscShare(e, btn) {
  const name = shareName(e);
  const url = e.public_id ? `https://exhibitionradar.com/show/${e.public_id}.html?via=share` : `https://exhibitionradar.com/?via=share`;
  const text = `${name} at ${e.venue}. Seen on Exhibition Radar.`;
  const info = btn.closest(".app-info");
  const method = await shareLink({ title: `${name} · Exhibition Radar`, text, url }, {
    failed: (why) => track("share_show_failed", { exhibition_id: e.id, target: why }),
    row: info.querySelector(".app-info-acts"), label: "Link to this show",
  });
  if (!method) return;
  track("share_show", { exhibition_id: e.id, props: { method, app: true } });
  if (method !== "copy") return;
  const note = info.querySelector(".app-share-note");
  note.hidden = false;
  clearTimeout(note._t);
  note._t = setTimeout(() => { note.hidden = true; }, 1600);
}
// "See it on the map": the map tab, the show's city, no search or type
// filters, its date set on, then a flight to the venue and its pin open
// (the App design, 9 Oct 2026). Discover keeps the show and the search for
// the way back.
function appDiscToMap(e) {
  const set = appSetOf(e);
  const on = tabSets();
  const next = on.includes(set) ? on : [...on, set];
  app.disc.back = { id: e.id, q: state.q };
  app.disc.scroll = $("app-reel").scrollTop;
  app.focus = { key: `${(+e.latitude).toFixed(5)},${(+e.longitude).toFixed(5)}`, until: Date.now() + 15000 };
  const city = appNamed(e.city) || "";
  appFx(() => {
    app.tab = "radar";
    app.radarView = "map";
    app.sub = null;
    $("search").value = "";
    state.q = "";
    updateSearchChrome();
    const keys = [...APP_TYPE, ...APP_WHEN].map(([k]) => k);
    swapTo("map", tabKey(next), () => {
      state.kinds = state.kinds.filter(k => !keys.includes(k));
      state.city = city;
      mapAutoCity = "";
      app.loc = city ? ["city:" + city] : [];
      if (city) appRemember(city);
    });
    showTabSets(next);
    $("app-pins").dataset.key = "";
    window.scrollTo(0, 0);
    syncAppChrome();
    appAwaitFocus();
  });
}
// Once the map is built and the venue's pin drawn: fly in (zoom about 15)
// and open it. Asked again every 120 ms until then, for 15 s at most.
function appAwaitFocus() {
  const f = app.focus;
  if (!f) return;
  if (Date.now() > f.until || app.tab !== "radar") { app.focus = null; return; }
  // The view swaps after its fade (swapTo): until then there's no map to ask.
  const g = state.view === "map" && map && map.isStyleLoaded() ? pinGroups.get(f.key) : null;
  if (!g) { setTimeout(appAwaitFocus, 120); return; }
  app.focus = null;
  if (state.mapPoint) closeVenuePanel();
  map.once("moveend", () => { if (app.tab === "radar" && state.view === "map") pinTapped(g); });
  map.flyTo({ center: [g.lng, g.lat], zoom: Math.max(map.getZoom(), 15), duration: reducedMotion.matches ? 0 : 1400, essential: true });
}
// "reset filters" under No Results: type, when and the search cleared,
// and location back to near me (or all cities when nothing is near).
function appDiscReset() {
  const keys = [...APP_TYPE, ...APP_WHEN].map(([k]) => k);
  state.kinds = state.kinds.filter(k => !keys.includes(k));
  $("search").value = "";
  state.q = "";
  updateSearchChrome();
  const here = appHere();
  const nearOk = !!here && [...state.data.current, ...state.data.upcoming].some(e => appRealImage(e) && hasCoords(e) && appKm(here, [+e.latitude, +e.longitude]) <= APP_NEAR_KM);
  app.loc = nearOk ? ["near"] : [];
  state.city = "";
  mapAutoCity = "";
  render();
}

// ---- The profile, the way in, and Settings ----------------------------------
// The pushed pages (app.sub): Settings, Plan a Gallery Night, Communities,
// Following, the profile as friends see it, and the partner page and its
// request form from the way in. Each slides in from the right the first
// time it's drawn; a redraw in place (a toggle, a reorder) doesn't.
const APP_SUBS = {
  settings: () => appSettingsHTML(), night: () => appNightHTML(), communities: () => appCommHTML(),
  following: () => appFollowHTML(), view: () => appViewHTML(), partner: () => appPartnerHTML(), request: () => appRequestHTML(),
};
let appSubDrawn = null;
function renderAppPage() {
  const page = $("app-page");
  const sub = app.sub && APP_SUBS[app.sub] ? app.sub : null;
  page.classList.toggle("auth", !currentUser && !sub);
  page.classList.toggle("sub", !!sub);
  page.dataset.sub = sub || "";
  if (sub !== "night") appNightMapDrop();
  page.innerHTML = sub ? APP_SUBS[sub]() : currentUser ? appProfileHTML() : app.authStep === "city" ? appHomeHTML() : appAuthHTML();
  const fresh = sub !== appSubDrawn;
  if (sub && fresh && !reducedMotion.matches) {
    page.classList.remove("app-push");
    void page.offsetWidth;
    page.classList.add("app-push");
  }
  appSubDrawn = sub;
  if (fresh || !sub) page.scrollTop = 0;
  if (sub === "night") appNightMap();
  if (sub === "communities" && app.comm.plans == null) appLoadComm();
  if (sub === "partner" && !app.partner.page) appLoadPartner();
  if (sub === "request" && !app.partner.form) appLoadRequest();
}
function appPushSub(sub) {
  app.sub = sub;
  if (sub !== "following") app.follow.shown = null;
  renderAppPage();
  $("app-page").scrollTop = 0;
}
// Back: the request form to the partner page, that to the way in, the
// rest to the profile.
function appPopSub() {
  app.sub = app.sub === "request" ? "partner" : null;
  app.follow.shown = null;
  app.night.note = "";
  appSubDrawn = app.sub === "partner" ? "partner" : null;
  renderAppPage();
  $("app-page").scrollTop = 0;
}
function appBackHTML(label) {
  return `<button type="button" class="app-back" data-app-act="back">${APP_SVG.back}<span>${esc(label)}</span></button>`;
}
function appAuthHTML() {
  const signup = app.authMode === "signup";
  return `<img class="app-logo" src="logo-stand-app.png" alt="Exhibition Radar">
    <div><h1 class="app-h">${signup ? "make an account" : "welcome back"}</h1>
      <p class="app-sub">${signup ? "Save shows, follow galleries and plan gallery nights with friends." : "Log in to see your saved shows and galleries."}</p></div>
    <form class="app-form" id="app-auth-form" novalidate>
      <label class="app-field"><input id="app-email" type="email" placeholder="email" aria-label="email" autocomplete="email" autocapitalize="none" spellcheck="false"></label>
      <label class="app-field"><input id="app-password" type="password" placeholder="password" aria-label="password" autocomplete="${signup ? "new-password" : "current-password"}"></label>
      <button class="app-btn" type="submit">${signup ? "sign up" : "log in"}</button>
    </form>
    <p class="app-status" role="status">${esc(app.status)}</p>
    <div class="app-or">or</div>
    <div class="app-form">
      <button class="app-btn" type="button" data-app-sso="apple"><svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true" style="margin-top:-2px"><path fill="#ffffff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>continue with Apple</button>
      <button class="app-btn" type="button" data-app-sso="google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>continue with Google</button>
    </div>
    <div class="app-switch"><span>${signup ? "have an account?" : "new here?"}</span><button type="button" data-app-act="switch">${signup ? "log in" : "sign up"}</button></div>
    <div class="app-switch"><span>gallery or institution?</span><button type="button" data-app-act="sub-partner">create a partner account</button></div>
    <div class="app-site-out"><button type="button" data-app-site="add-show-link">add your exhibition</button><button type="button" data-app-site="feedback-link">leave feedback</button><button type="button" data-app-act="settings">settings</button></div>`;
}
function appHomeHTML() {
  const cities = new Set([...state.data.current, ...state.data.upcoming].map(e => e.city));
  const hubs = APP_HUBS.filter(n => !state.loaded || cities.has(n));
  return `<div><h1 class="app-h">what's your home city?</h1>
      <p class="app-sub">We'll show its shows first when we can't find your location. You can change it later.</p></div>
    <div class="app-homes">${hubs.map(n => `<button type="button" data-app-home="${escAttr(n)}" aria-pressed="${app.homePick === n}">${esc(n)}</button>`).join("")}</div>
    <p class="app-status" role="status">${esc(app.status)}</p>
    <button class="app-btn" type="button" data-app-act="home-done"${app.homePick ? "" : " disabled"}>done</button>`;
}
// The profile (the App design, 8 and 9 Oct 2026): the dish over "Hi
// <name>" in the hand, then the top-down list, each row pushing its page:
// Plan a Gallery Night under its small map, Communities, Following,
// Settings. Serif titles, grey subtitles, rules and chevrons.
const appFirstName = () => (friendsData?.me?.handle || (currentUser?.details?.name || "").trim().split(/\s+/)[0] || "there");
// The map illustration in the map's palette: cream ground, faint blocks, a
// park, water along the foot, grey streets, four pins (three on view, one
// opening this week) joined by a dotted walk (the App design, 9 Oct 2026).
// The pins take the pin tokens, so colourblind mode recolours them.
function appNightArtSVG() {
  const pin = (x, y, tilt, tone) => `<g transform="translate(${x} ${y}) rotate(${tilt} 11 30)" style="color:var(--pin-${tone})"><path d="M11 29 C11 22 4 17.5 4 11 A7 7 0 1 1 18 11 C18 17.5 11 22 11 29Z" fill="#ffffff" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.4 28.4 C10.6 21.6 4.6 17.8 4.6 11.2" fill="none" stroke="currentColor" stroke-width="1" opacity="0.55" stroke-linecap="round"/><circle cx="11" cy="11" r="2.6" fill="currentColor"/></g>`;
  return `<svg class="app-night-art" viewBox="0 0 360 150" width="100%" height="150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="geometricPrecision">
    <g fill="none" stroke="#9e9e9e" stroke-width="0.8" opacity="0.3">
      <rect x="14" y="12" width="46" height="26"/><rect x="68" y="12" width="40" height="26"/><rect x="116" y="12" width="52" height="26"/><rect x="176" y="12" width="44" height="26"/><rect x="228" y="12" width="56" height="26"/><rect x="292" y="12" width="56" height="26"/>
      <rect x="14" y="50" width="46" height="34"/><rect x="68" y="50" width="40" height="34"/><rect x="116" y="50" width="52" height="34"/><rect x="176" y="50" width="44" height="34"/><rect x="228" y="50" width="56" height="34"/><rect x="292" y="50" width="56" height="34"/>
      <rect x="14" y="96" width="46" height="30"/><rect x="68" y="96" width="40" height="30"/><rect x="116" y="96" width="52" height="30"/><rect x="176" y="96" width="44" height="30"/>
    </g>
    <rect x="228" y="96" width="120" height="54" fill="#d3e4c1" opacity="0.85"/>
    <path d="M228 96 H348 V150 H228 Z" fill="none" stroke="#a9bf95" stroke-width="0.8" opacity="0.6"/>
    <path d="M-4 134 C40 126 70 140 112 134 S170 124 200 134 L200 154 L-4 154Z" fill="#b9d2ee"/>
    <path d="M-4 134 C40 126 70 140 112 134 S170 124 200 134" fill="none" stroke="#93b3da" stroke-width="1" opacity="0.75"/>
    <g fill="none" stroke="#9e9e9e" stroke-width="0.6" stroke-linecap="round" opacity="0.7"><path d="M64 0V150"/><path d="M112 0V150"/><path d="M172 0V150"/><path d="M224 0V150"/><path d="M288 0V150"/><path d="M0 44H360"/><path d="M0 90H360"/></g>
    <g fill="none" stroke="#5a5a5a" stroke-width="1.1" stroke-linecap="round" opacity="0.7"><path d="M0 6H360"/><path d="M8 0V150"/></g>
    <path d="M40 72 L140 72 L140 118 L200 118 L200 60 L312 60" fill="none" stroke="#111111" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pin(29, 42, -5, "current")}${pin(129, 42, 4, "current")}${pin(189, 88, -2, "opening")}${pin(301, 30, 3, "current")}
  </svg>`;
}
function appProfileHTML() {
  const stops = orderedStops();
  const when = app.night.when === "tonight" ? "tonight" : app.night.when;
  const nightSub = stops.length ? `${when} · ${[...new Set(stops.map(s => s.venue))].join(", ")}` : "Pick shows and a route";
  const row = (act, title, sub, art = "") => `<button type="button" class="app-list-row" data-app-act="${act}">${art}<span class="app-list-text"><span class="app-list-main"><span class="t">${esc(title)}</span><span class="s">${esc(sub)}</span></span>${APP_SVG.chevron}</span></button>`;
  return `<div class="app-hi">
      <img class="app-dish" src="exhibition-radar-dish-stand.png" alt="Exhibition Radar">
      <div class="app-hi-name">Hi ${esc(appFirstName())}</div>
      <div class="app-hi-mail">${esc(currentUser.email || "")}</div>
    </div>
    <div class="app-list">
      ${row("sub-night", "Plan a Gallery Night", nightSub, appNightArtSVG())}
      ${row("sub-communities", "Communities", "Friends and the plans they share with you")}
      ${row("sub-following", "Following", "What's on at the galleries you follow")}
      ${row("sub-settings", "Settings", "Home city, notifications, appearance, account")}
    </div>
    <button type="button" class="app-text-link" data-app-act="sub-view">how friends see you</button>
    <div class="app-site"><button type="button" data-app-site="add-show-link">add your exhibition</button><button type="button" data-app-site="feedback-link">leave feedback</button><button type="button" data-app-act="logout">log out</button></div>`;
}
// The profile as friends see it (the App design, 8 Oct 2026): handle, home
// city, then Seen, Want to see and Following. The friends API shares only
// the handle and, when switched on, the gallery night; the rest is drawn
// from your own lists until the backend offers friends a profile.
function appViewHTML() {
  const me = friendsData?.me || {};
  const handle = me.handle ? `@${me.handle}` : "";
  const initial = (me.handle || currentUser.details?.name || currentUser.email || "?").trim().charAt(0).toUpperCase();
  const caption = (s) => { const c = gridCaption(s); return esc(c.title || c.artists || s.title || ""); };
  const seen = (app.seen || []).filter(s => s.image_url).slice(0, 12);
  const follows = [...radar.favorites.values()];
  return `${appBackHTML("profile")}
    <div class="app-me"><div class="app-avatar">${esc(initial)}</div>
      <div class="app-me-text">${handle ? `<div class="app-handle">${esc(handle)}</div>` : `<div class="app-handle">no name yet</div>`}<div class="app-email">${esc((appHomeName() || "").toLowerCase())}</div></div>
      <button class="app-pill-btn" type="button" data-app-act="friends">edit</button></div>
    <p class="app-quiet" style="margin-top:14px">This is what your friends see.</p>
    <div class="app-sec"><h2>Seen</h2>${app.seen == null ? `<p class="app-quiet">Loading…</p>` : seen.length
      ? `<div class="app-seen">${seen.map(s => `<span><img src="${escAttr(s.image_url)}" alt="${escAttr(s.title || "")}" loading="lazy" referrerpolicy="no-referrer"></span>`).join("")}</div>`
      : `<p class="app-quiet">Open a show you've been to and choose mark as seen.</p>`}</div>
    <div class="app-sec"><h2>Want to see</h2>${radar.want.length
      ? radar.want.map(s => `<div class="app-want"><span class="t">${caption(s)}</span><span class="v">${esc(s.venue || "")} · ${esc(appDates(s.start_date, s.end_date))}</span></div>`).join("")
      : `<p class="app-quiet">Open a show and choose want to see.</p>`}</div>
    <div class="app-sec"><h2>Following</h2>${follows.length ? `<div class="app-follows">${follows.map(n => `<span>${esc(n)}</span>`).join("")}</div>` : `<p class="app-quiet">Open a show and choose follow gallery.</p>`}</div>`;
}

// Settings (the App design, 8 and 9 Oct 2026): home city; my cities;
// three notification switches; appearance; account. Pushed from the
// profile tab (or the way in: appearance works signed out too) with a
// "‹ profile" back button, the tab bar still showing.
const APP_NOTIFS = [["newShows", "New shows", "At galleries you follow"], ["openings", "Openings this week", "Receptions near your home city"], ["friends", "Friends' plans", "When someone invites you to a gallery night"]];
function appSwitchHTML(attr, on, label, sub) {
  return `<button type="button" class="app-switch-row" ${attr} role="switch" aria-checked="${on}"><span class="app-switch-text"><span>${esc(label)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span><span class="app-sw"><span class="app-knob"></span></span></button>`;
}
function appSettingsHTML() {
  const cities = [...appCityNames().values()].sort((a, b) => a.localeCompare(b));
  const home = appHomeName();
  const pinned = prefs.pinned.map(appNamed).filter(Boolean);
  const addable = cities.filter(c => c !== home && !pinned.includes(c));
  const option = (c, on) => `<option value="${escAttr(c)}"${on ? " selected" : ""}>${esc(c.toLowerCase())}</option>`;
  const themeNow = prefs.theme || "auto";
  const chevron = `<svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5 7.5 7.5 1.5 13.5"/></svg>`;
  const account = currentUser
    ? `<div class="app-rows">
        <div class="app-row"><span>Email</span><span class="meta">${esc(currentUser.email || "")}</span></div>
        <button type="button" class="app-row" disabled title="soon"><span>Change password</span><span class="meta">soon</span></button>
        <button type="button" class="app-row" data-app-act="logout"><span>Log out</span></button>
        <button type="button" class="app-row danger" disabled title="soon"><span>Delete account</span><span class="meta">soon</span></button>
      </div>`
    : `<div class="app-rows"><button type="button" class="app-row" data-app-act="to-auth"><span>Log in or sign up</span>${chevron}</button></div>`;
  return `<button type="button" class="app-back" data-app-act="back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>profile</span></button>
    <h1 class="app-hand">Settings</h1>
    <div class="app-label">Home city</div>
    <label class="app-row app-select-row"><select id="app-home-select" aria-label="home city">${home ? "" : `<option value="">choose a city</option>`}${cities.map(c => option(c, c === home)).join("")}</select>${chevron}</label>
    <div class="app-label">My cities</div>
    <div class="app-rows">
      ${pinned.map(c => `<div class="app-row"><span class="lc">${esc(c)}</span><button type="button" class="app-x" data-app-unpin="${escAttr(c)}" aria-label="remove ${escAttr(c)}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button></div>`).join("")}
      <label class="app-row app-add"><span aria-hidden="true">+</span><span>add a city</span><select id="app-add-city" aria-label="add a city"><option value="">add a city</option>${addable.map(c => option(c, false)).join("")}</select></label>
    </div>
    <div class="app-label">Notifications</div>
    <div class="app-rows">${APP_NOTIFS.map(([k, label, sub]) => appSwitchHTML(`data-app-notif="${k}"`, !!prefs.notifs[k], label, sub)).join("")}</div>
    <div class="app-label">Appearance</div>
    <div class="app-seg" role="group" aria-label="appearance">${["auto", "light", "dark"].map(t => `<button type="button" data-app-theme="${t}" aria-pressed="${t === themeNow}">${t}</button>`).join("")}</div>
    <div class="app-rows">${appSwitchHTML(`data-app-pref="cvd"`, prefs.cvd, "Colorblind mode", "")}${appSwitchHTML(`data-app-pref="bigText"`, prefs.bigText, "Big text", "")}</div>
    <div class="app-label">Account</div>
    ${account}`;
}
// ---- Plan a Gallery Night ---------------------------------------------------
// The site's own plan (planStops / orderedStops in index.html: the
// account's stops, or this device's as a guest) under the design's page:
// day chips, a small map of the stops, the walk between them, the stops in
// order with move up / down and remove, "add from saved" (my list and want
// to see), who's coming, and send (the App design, 8 Oct 2026).
const APP_WALK_KMH = 4.8;
const APP_WALK_MAX_KM = 12; // a leg past this isn't a walk (the site's own walk stops at a like distance)
function appNightDays() {
  // Tonight, then the coming Thursday, Saturday and Sunday by name.
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = new Date().getDay();
  const ahead = (d) => names[d] && ((d - today + 7) % 7 || 7) > 0 ? names[d] : "";
  return ["tonight", ...[4, 6, 0].map(ahead).filter(n => n && names.indexOf(n) !== today)];
}
const appLiveByKey = () => new Map([...state.data.current, ...state.data.upcoming].map(e => [e.show_key, e]));
// What you've saved and not yet planned: my list (Discover) and want to see.
function appSavedShows() {
  const live = appLiveByKey();
  const planned = new Set(planStops().map(s => s.show_key));
  const out = [], seen = new Set();
  for (const s of [...prefs.list.map(k => live.get(k)).filter(Boolean), ...radar.want]) {
    if (!s || !s.show_key || seen.has(s.show_key) || planned.has(s.show_key)) continue;
    seen.add(s.show_key);
    out.push(s);
  }
  return out;
}
function appWalkEstimate(stops) {
  const placed = stops.filter(hasCoords);
  if (placed.length < 2) return "";
  let km = 0, far = false;
  for (let i = 1; i < placed.length; i++) {
    const leg = distanceKm(placed[i - 1].latitude, placed[i - 1].longitude, placed[i].latitude, placed[i].longitude);
    km += leg;
    if (leg > APP_WALK_MAX_KM) far = true;
  }
  if (far) return "Too far to walk between two of the stops. Try the route in your gallery night on the site.";
  const mins = Math.max(1, Math.round(km / APP_WALK_KMH * 60));
  return `About ${walkMinutes(mins * 60)} on foot between stops, in this order.`;
}
function appNightHTML() {
  const stops = orderedStops();
  const caption = (s) => { const c = gridCaption(s); return esc(c.title || c.artists || s.title || ""); };
  const chips = appNightDays().map(d => `<button type="button" class="app-chip" data-app-when="${escAttr(d)}" aria-pressed="${d === app.night.when}">${esc(d)}</button>`).join("");
  const walk = stops.filter(hasCoords).length > 1 ? (app.night.route ? app.night.route : appWalkEstimate(stops)) : "Add a second stop to see the walk.";
  const rows = stops.map((s, i) => `<div class="app-stop-row">
      <span class="n">${i + 1}</span>
      <span class="app-stop-text"><span class="t">${caption(s)}</span><span class="v">${esc(s.venue || "")}</span></span>
      <span class="app-stop-acts">
        <button type="button" data-app-move="-1" data-key="${escAttr(s.show_key)}" aria-label="move earlier"${i ? "" : " disabled"}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l5-5 5 5"/></svg></button>
        <button type="button" data-app-move="1" data-key="${escAttr(s.show_key)}" aria-label="move later"${i < stops.length - 1 ? "" : " disabled"}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5l5 5 5-5"/></svg></button>
        <button type="button" class="x" data-app-unplan="${escAttr(s.show_key)}" aria-label="remove stop"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>
      </span>
    </div>`).join("");
  const saved = appSavedShows();
  const add = saved.map(s => `<div class="app-saved-row"><span class="app-stop-text"><span class="t">${caption(s)}</span><span class="v">${esc(s.venue || "")}</span></span><button type="button" class="app-pill-btn" data-app-plan="${escAttr(s.show_key)}">add</button></div>`).join("");
  const anySaved = prefs.list.length || radar.want.length;
  const friends = (friendsData?.friends || []);
  const who = friends.map(f => { const on = app.night.who.includes(f.handle); return `<button type="button" class="app-chip app-who" data-app-who="${escAttr(f.handle)}" aria-pressed="${on}"><span class="i">${esc(f.handle.charAt(0).toUpperCase())}</span>@${esc(f.handle)}</button>`; }).join("");
  const sendLabel = app.night.note || (app.night.who.length ? `send to ${app.night.who.map(h => "@" + h).join(", ")}` : "share the plan");
  return `${appBackHTML("profile")}
    <h1 class="app-hand">Plan a Gallery Night</h1>
    <div class="app-chips">${chips}</div>
    <div class="app-night-map"${stops.some(hasCoords) ? "" : " hidden"}><div id="app-night-map"></div></div>
    <div class="app-night-walk">${esc(walk)}</div>
    <div class="app-stops">${rows || `<div class="app-empty-row">No stops yet. Add shows you've saved below, or open any show and choose add to gallery night.</div>`}</div>
    <h2 class="app-h2">Add from saved</h2>
    <div class="app-saved">${add || `<div class="app-empty-row">${anySaved ? "Everything you've saved is in the plan." : "Add shows to my list in Discover, or choose want to see, and they appear here."}</div>`}</div>
    <h2 class="app-h2">Who's coming</h2>
    ${who ? `<div class="app-chips">${who}</div>` : `<p class="app-quiet">Add friends in Communities to name who's coming.</p>`}
    <div class="app-send-row"><button class="app-btn app-send" type="button" data-app-act="night-send"${stops.length ? "" : " disabled"}>${esc(sendLabel)}</button></div>
    <p class="app-status" role="status" id="app-night-status"></p>`;
}
// The small map of the stops: MapLibre over the site's own style, not
// interactive, framed on the stops, with a pin a stop in its set's colour
// and a dotted line in walking order (the real route once Valhalla
// answers, straight lines until then).
let appNightMapObj = null;
function appNightMapDrop() {
  if (!appNightMapObj) return;
  try { appNightMapObj.remove(); } catch { /* already gone with its page */ }
  appNightMapObj = null;
}
function appNightPinHTML(set) {
  const tone = set === "opening" ? "var(--pin-opening)" : set === "upcoming" ? "var(--pin-soon)" : "var(--pin-current)";
  return `<svg width="22" height="30" viewBox="0 0 22 30" style="color:${tone};display:block" aria-hidden="true"><path d="M11 29 C11 22 4 17.5 4 11 A7 7 0 1 1 18 11 C18 17.5 11 22 11 29Z" fill="#ffffff" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="11" r="3.2" fill="currentColor"/></svg>`;
}
function appNightMap() {
  const host = $("app-night-map");
  if (!host) return;
  const stops = orderedStops().filter(hasCoords);
  if (!stops.length) return;
  const live = appLiveByKey();
  loadMapLibre().then(() => {
    if (!$("app-night-map") || app.sub !== "night") return;
    appNightMapDrop();
    const m = new maplibregl.Map({ container: host, style: mapStyleSpec(), interactive: false, attributionControl: false, fadeDuration: 0,
      center: [+stops[0].longitude, +stops[0].latitude], zoom: 13, dragRotate: false, pitchWithRotate: false });
    appNightMapObj = m;
    const bounds = new maplibregl.LngLatBounds();
    stops.forEach(s => bounds.extend([+s.longitude, +s.latitude]));
    m.fitBounds(bounds, { padding: { top: 40, bottom: 24, left: 36, right: 36 }, maxZoom: 15, duration: 0 });
    stops.forEach(s => {
      const el = document.createElement("div");
      el.className = "app-night-pin";
      el.innerHTML = appNightPinHTML(appSetOf(live.get(s.show_key) || s));
      new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([+s.longitude, +s.latitude]).addTo(m);
    });
    const line = (coords) => {
      if (appNightMapObj !== m) return;
      const data = { type: "Feature", geometry: { type: "LineString", coordinates: coords } };
      if (m.getSource("night")) m.getSource("night").setData(data);
      else {
        m.addSource("night", { type: "geojson", data });
        m.addLayer({ id: "night-line", type: "line", source: "night", layout: { "line-cap": "round" }, paint: { "line-color": "#111111", "line-width": 1.5, "line-dasharray": [0.6, 2.4] } });
      }
    };
    const straight = stops.map(s => [+s.longitude, +s.latitude]);
    m.on("load", () => line(straight));
    if (stops.length > 1) appNightRoute(stops, (route) => { if (m.loaded()) line(route.coords); else m.once("load", () => line(route.coords)); });
  }).catch(() => { /* no map: the list still says the walk */ });
}
// The real walk between the stops, from the site's route service (one
// request at a time, as its gallery night does); the estimate stands
// until it answers, and if it can't.
function appNightRoute(stops, drawn) {
  const key = stops.map(s => s.show_key).join("|");
  if (app.night.routeKey === key && app.night.route) return;
  app.night.routeKey = key;
  app.night.route = null;
  fetchWalkingRoute(stops.map(s => ({ lat: +(+s.latitude).toFixed(5), lng: +(+s.longitude).toFixed(5) }))).then(route => {
    if (app.night.routeKey !== key) return;
    // A leg too long to walk stays "too far" even when the router finds a way
    // (it will route Los Angeles to London, 26 Oct 2026).
    if (appWalkEstimate(stops).startsWith("Too far")) return;
    app.night.route = `About ${walkMinutes(route.seconds)} on foot between stops, in this order.`;
    const el = $("app-page").querySelector(".app-night-walk");
    if (el && app.sub === "night") el.textContent = app.night.route;
    drawn(route);
  }).catch(() => { /* the straight-line estimate stands */ });
}
// A show into the plan or out of it, by show key (the account's plan, or
// this device's as a guest), then the page and the site's own rows redrawn.
async function appPlanSet(show_key, on) {
  const live = appLiveByKey();
  const e = live.get(show_key);
  // A live show goes by its id (the API archives it first if need be); a
  // stop already in the plan, maybe closed since, by its key.
  if (isPro()) radar.plan = (await proSend("POST", "/api/me/plan", e ? { exhibition_id: e.id, on } : { show_key, on })).plan;
  else {
    const stops = planStops();
    saveGuestPlan(on ? [...stops, ...(e ? [e] : [])] : stops.filter(s => s.show_key !== show_key));
  }
  track(on ? "plan_add" : "plan_remove", { exhibition_id: live.get(show_key)?.id, props: { stops: planStops().length, guest: !isPro(), app: true } });
  renderAccountState();
  refreshProActions();
}
function appPlanMove(show_key, dir) {
  const keys = orderedStops().map(s => s.show_key);
  const i = keys.indexOf(show_key), j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  savePlanOrder(keys);
  track("plan_reorder", { props: { stops: keys.length, app: true } });
}
// Send the plan: the phone's sheet with the plan's link (the site's
// importSharedPlan opens it for whoever gets it), else the link copied.
// The friends picked name the night in the words sent; there is no
// in-app delivery (ER-19 was dropped on 25 Sep 2026: plans travel by text).
async function appNightSend(btn) {
  const live = appLiveByKey();
  const stops = orderedStops().map(s => (s.public_id ? s : live.get(s.show_key))).filter(s => s?.public_id);
  const say = (t) => { const el = $("app-night-status"); if (el) el.textContent = t; };
  if (!stops.length) { say("Every show in this plan has closed, so there's nothing to send."); return; }
  const n = stops.length;
  const place = planPlace(stops);
  const when = app.night.when === "tonight" ? "tonight" : `on ${app.night.when}`;
  const text = `A gallery night ${when}: ${n} ${n === 1 ? "show" : "shows"}${place ? ` in ${place}` : ""}. Planned on Exhibition Radar.`;
  const url = `https://exhibitionradar.com/?${new URLSearchParams({ plan: stops.map(s => s.public_id).join(","), via: "share" })}`;
  const method = await shareLink({ title: "Gallery night · Exhibition Radar", text, url }, {
    failed: (why) => track("share_plan_failed", { target: why, props: { stops: n } }),
    row: btn.closest(".app-send-row"), label: "Link to this plan", sms: "text it",
  });
  if (!method) return;
  track("share_plan", { props: { method, stops: n, guest: !isPro(), app: true, friends: app.night.who.length } });
  if (method !== "copy") return;
  app.night.note = "link copied";
  btn.textContent = app.night.note;
  clearTimeout(appNightSend.t);
  appNightSend.t = setTimeout(() => { app.night.note = ""; if (app.sub === "night") renderAppPage(); }, 1600);
}

// ---- Communities --------------------------------------------------------------
// Friends' gallery nights, where they've chosen to share them
// (GET /api/me/friends/<handle>/plan), each with join / you're going, and
// the friends list from the site's friends panel (the App design, 8 Oct
// 2026). "Join" is kept on the device (er-joined-plans): the backend has
// no row yet for going to someone's night.
async function appLoadComm() {
  if (app.comm.busy || !currentUser) return;
  app.comm.busy = true;
  try {
    claimFriends();
    if (!friendsData) friendsData = friendsShape(await friendsSend("GET", "/api/me/friends"));
    const sharers = friendsData.friends.filter(f => f.shares_plan);
    const plans = await Promise.all(sharers.map(async f => {
      try { const d = await friendsSend("GET", `/api/me/friends/${encodeURIComponent(f.handle)}/plan`); return { handle: f.handle, stops: d.stops || [] }; }
      catch { return null; }
    }));
    app.comm.plans = plans.filter(p => p && p.stops.length);
  } catch { app.comm.plans = []; }
  app.comm.busy = false;
  if (app.sub === "communities") renderAppPage();
}
function appCommHTML() {
  const fd = friendsData || { friends: [], incoming: [], outgoing: [] };
  const plans = app.comm.plans;
  const card = (p) => {
    const on = prefs.joined.includes(p.handle);
    const venues = [...new Set(p.stops.map(s => s.venue).filter(Boolean))];
    return `<div class="app-plan-card">
      <div class="app-plan-head"><span class="t">@${esc(p.handle)}'s gallery night</span><span class="m">${p.stops.length} ${p.stops.length === 1 ? "stop" : "stops"}</span></div>
      <div class="app-plan-stops">${esc(venues.join(" → "))}</div>
      <div class="app-plan-foot"><span class="m">from @${esc(p.handle)}</span><button type="button" class="app-pill-btn${on ? " on" : ""}" data-app-join="${escAttr(p.handle)}" aria-pressed="${on}">${on ? "you're going" : "join"}</button></div>
    </div>`;
  };
  const planList = plans == null ? `<p class="app-quiet">Loading…</p>`
    : plans.length ? plans.map(card).join("")
    : `<p class="app-quiet">${fd.friends.length ? "None of your friends has shared a gallery night yet." : "Plans your friends share with you appear here."}</p>`;
  const row = (h, note) => `<button type="button" class="app-friend" data-app-act="friends"><span class="i">${esc(h.charAt(0).toUpperCase())}</span><span><span>@${esc(h)}</span>${note ? `<span class="v">${esc(note)}</span>` : ""}</span></button>`;
  const friends = [
    ...fd.friends.map(f => row(f.handle, f.shares_plan ? "shares their gallery night" : "")),
    ...fd.incoming.map(f => row(f.handle, "asked you")),
    ...fd.outgoing.map(f => row(f.handle, "request pending")),
  ];
  return `${appBackHTML("profile")}
    <h1 class="app-hand">Communities</h1>
    <h2 class="app-h2">Plans you're invited to</h2>
    ${planList}
    <h2 class="app-h2" style="margin-top:22px">Friends</h2>
    ${friends.join("") || `<p class="app-quiet">No friends yet. Invite someone, or find them by name.</p>`}
    <button class="app-invite" type="button" data-app-act="friends">invite a friend</button>`;
}

// ---- Following ------------------------------------------------------------------
// Each gallery you follow (radar.favorites), where it is, what's on there
// now (up to two shows, with their pictures), and a following toggle
// (POST /api/me/favorites). A gallery unfollowed here stays listed until
// you leave the page, so it can be followed again (the App design, 8 Oct).
function appFollowHTML() {
  if (!app.follow.shown) app.follow.shown = [...radar.favorites.keys()];
  const byKey = new Map();
  for (const e of [...state.data.current, ...state.data.upcoming]) if (e.gallery_key && !byKey.has(e.gallery_key)) byKey.set(e.gallery_key, e);
  const tile = (e) => {
    const img = showImage(e);
    const c = gridCaption(e);
    const pic = img ? `<img ${imgSrcHTML(img.url, 128, "64px")} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.app-tile').textContent=this.closest('.app-tile').dataset.letter">`
      : esc((c.title || c.artists || e.venue || "?").charAt(0).toUpperCase());
    return `<div class="app-follow-show"><div class="app-tile" data-letter="${escAttr((c.title || c.artists || e.venue || "?").charAt(0).toUpperCase())}">${pic}</div><div class="app-follow-show-text"><div class="t">${c.title ? c.titleHTML : esc(c.artists || e.title || "")}</div><div class="m">${esc(appDates(e.start_date, e.end_date))}</div></div></div>`;
  };
  const rows = app.follow.shown.map(key => {
    const on = radar.favorites.has(key);
    const name = galleryName(key);
    const first = byKey.get(key) || {};
    const place = [first.neighborhood, first.city].filter(Boolean).join(", ");
    const now = state.data.current.filter(e => e.gallery_key === key).slice(0, 2);
    return `<div class="app-follow-row">
      <div class="app-follow-head"><div class="app-follow-name"><div class="t">${esc(name)}</div>${place ? `<div class="m">${esc(place)}</div>` : ""}</div><button type="button" class="app-pill-btn${on ? " on" : ""}" data-app-follow="${escAttr(key)}" aria-pressed="${on}">${on ? "following" : "follow"}</button></div>
      ${now.length ? now.map(tile).join("") : `<div class="m">Nothing on right now.</div>`}
    </div>`;
  });
  return `${appBackHTML("profile")}
    <h1 class="app-hand">Following</h1>
    <p class="app-sub" style="margin:0 0 18px">What's on now at the galleries you follow.</p>
    ${rows.join("") || `<p class="app-quiet">You're not following any galleries yet. Open a show and choose follow gallery.</p>`}`;
}
async function appFollowToggle(key, btn) {
  const on = !radar.favorites.has(key);
  btn.disabled = true;
  try {
    await proSend("POST", "/api/me/favorites", { gallery_key: key, on });
    if (on) radar.favorites.set(key, galleryName(key)); else radar.favorites.delete(key);
    track(on ? "gallery_follow" : "gallery_unfollow", { target: key, props: { app: true } });
    renderAccountState();
    refreshProActions();
    if (app.sub === "following") renderAppPage();
  } catch (err) { btn.disabled = false; btn.textContent = err.message; }
}

// ---- The partner pages, inside the app ------------------------------------------
// "create a partner account" on the way in opens for-galleries.html's
// content as a page of the app, with a back button; its "create partner
// account" buttons push partner-request.html's form, which posts to
// /api/partner/requests as the page does (the App design, 8 Oct 2026).
// Both are fetched once a visit and kept.
async function appLoadPartner() {
  try {
    const res = await fetch("for-galleries.html", { cache: "no-cache" });
    if (!res.ok) throw new Error();
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const wrap = document.createElement("div");
    for (const part of doc.querySelectorAll(".page > :is(section, figure)")) wrap.append(part);
    for (const a of wrap.querySelectorAll("a")) {
      const href = a.getAttribute("href") || "";
      if (/^partner-request\.html/.test(href)) {
        const b = document.createElement("button");
        b.type = "button"; b.className = a.className; b.dataset.appAct = "sub-request"; b.textContent = a.textContent;
        a.replaceWith(b);
      } else if (/^[a-z]+:/i.test(href) && !/^mailto:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      else if (href.startsWith("#")) a.replaceWith(...a.childNodes);
      else if (!/^mailto:/i.test(href)) { a.href = new URL(href, location.href).href; a.target = "_blank"; a.rel = "noopener"; }
    }
    app.partner.page = wrap.innerHTML;
  } catch { app.partner.page = `<p class="app-quiet">Couldn't load the page. Check the connection and try again.</p>`; }
  if (app.sub === "partner") renderAppPage();
}
function appPartnerHTML() {
  return `${appBackHTML("back")}<div class="app-partner">${app.partner.page || `<p class="app-quiet">Loading…</p>`}</div>`;
}
async function appLoadRequest() {
  try {
    const res = await fetch("partner-request.html", { cache: "no-cache" });
    if (!res.ok) throw new Error();
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const ask = doc.getElementById("ask"), done = doc.getElementById("done");
    if (!ask || !done) throw new Error();
    // The form's ids are the app's now: the page's own script isn't run.
    ask.id = "app-ask"; done.id = "app-done";
    ask.querySelector("form").id = "app-partner-form";
    for (const el of [ask, done]) for (const a of el.querySelectorAll("a")) {
      const href = a.getAttribute("href") || "";
      if (href === "/" || href.startsWith("#")) a.replaceWith(...a.childNodes);
      else if (!/^mailto:/i.test(href)) { a.href = new URL(href, location.href).href; a.target = "_blank"; a.rel = "noopener"; }
    }
    const mail = done.querySelector("#done-email"); if (mail) mail.id = "app-done-email";
    const send = ask.querySelector("#send"); if (send) send.id = "app-partner-send";
    const banner = ask.querySelector("#banner"); if (banner) banner.id = "app-partner-banner";
    app.partner.form = ask.outerHTML + done.outerHTML;
  } catch { app.partner.form = `<p class="app-quiet">Couldn't load the form. Write to exhibitionradar@gmail.com instead.</p>`; }
  if (app.sub === "request") renderAppPage();
}
function appRequestHTML() {
  return `${appBackHTML("for galleries")}<div class="app-partner app-request">${app.partner.form || `<p class="app-quiet">Loading…</p>`}</div>`;
}
// The page's own checks and request, as partner-request.html runs them.
async function appRequestSubmit(form) {
  const v = (n) => (form.elements[n]?.value || "").trim();
  const err = (n, msg) => { const el = form.querySelector(`[data-err="${n}"]`); if (el) { el.hidden = !msg; el.textContent = msg || ""; } };
  const banner = (msg) => { const el = $("app-partner-banner"); if (el) { el.hidden = !msg; el.textContent = msg || ""; } };
  let bad = false;
  for (const n of ["name", "role", "email", "phone", "gallery", "city", "site", "instagram"]) err(n, "");
  banner("");
  const need = { name: "Please add your name.", role: "Please add your role at the gallery.", phone: "Please add a phone number we can call.", gallery: "Please add your gallery's name.", city: "Please add the city." };
  for (const n of Object.keys(need)) if (!v(n)) { err(n, need[n]); bad = true; }
  if (!v("site") && !v("instagram")) { err("site", "Please add the gallery's website or Instagram."); bad = true; }
  if (!v("email")) { err("email", "Please add your company email."); bad = true; }
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) { err("email", "That doesn't look like an email address."); bad = true; }
  if (bad) return;
  const send = $("app-partner-send");
  if (send) send.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/partner/requests`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: v("name"), role: v("role"), email: v("email"), phone: v("phone"), gallery: v("gallery"), city: v("city"), website: v("site"), instagram: v("instagram"), nickname: form.elements.nickname?.value || "" }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) { banner(body.error && /already got/i.test(body.error) ? body.error : "Too many tries. Wait a few minutes and try again."); return; }
    if (!res.ok) { banner(body.error || "Something went wrong. Try again, or write to us."); return; }
    const mail = $("app-done-email"); if (mail) mail.textContent = v("email");
    $("app-ask").hidden = true;
    $("app-done").hidden = false;
    $("app-page").scrollTop = 0;
  } catch { banner("Couldn't reach us just now. Try again, or write to exhibitionradar@gmail.com."); }
  finally { if (send) send.disabled = false; }
}

async function appSetHome(city) {
  prefs.home = city;
  appWrite(APP_KEYS.home, city || null);
  if (currentUser) {
    try {
      const res = await proSend("PATCH", "/api/me/preferences", { home_city: city });
      if (res && res.preferences) { currentUser.preferences = res.preferences; radar.prefs = res.preferences; }
    } catch { /* kept on the device; the account catches up next time */ }
  }
}
function appSetTheme(mode) {
  prefs.theme = mode;
  appWrite(APP_KEYS.theme, mode);
  appPaintTheme();
}
const appDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
// Auto follows the device; light and dark are the site's palettes, applied
// through applyTheme so the head script's early paint agrees next time.
function appPaintTheme() {
  if (!prefs.theme) return;
  const dark = prefs.theme === "dark" || (prefs.theme === "auto" && appDarkQuery.matches);
  const want = dark ? "dark" : "light";
  if (theme !== want) applyTheme(want);
}
function appPaintText() {
  document.documentElement.toggleAttribute("data-bigtext", prefs.bigText);
}
function appSetPref(key, on) {
  prefs[key] = on;
  appWrite(APP_KEYS[key], on ? "1" : "0");
  if (key === "cvd") { appPaintPins(); $("app-pins").dataset.key = ""; syncAppChrome(); if (app.drop) renderAppDrop(); }
  if (key === "bigText") { appPaintText(); syncPhoneTop(); }
}

// What the profile shows that the page doesn't already hold: the seen
// shows (with their pictures) and the friends.
async function loadAppProfile() {
  if (!currentUser) return;
  try { app.seen = (await proSend("GET", "/api/me/seen")).seen; } catch { app.seen = []; }
  try { claimFriends(); if (!friendsData) friendsData = friendsShape(await friendsSend("GET", "/api/me/friends")); } catch { /* no friends list: the section stays short */ }
  if (app.tab === "profile" && (!app.sub || ["night", "view"].includes(app.sub))) renderAppPage();
}

async function appAuthSubmit() {
  const email = $("app-email").value.trim();
  const password = $("app-password").value;
  const say = (t) => { app.status = t; const el = $("app-page").querySelector(".app-status"); if (el) el.textContent = t; };
  if (!email || !password) return say("Enter an email and password.");
  const signup = app.authMode === "signup";
  const btn = $("app-auth-form").querySelector("button");
  btn.disabled = true;
  say(signup ? "Making your account…" : "Logging in…");
  const slow = setTimeout(() => say("Waking the server. This can take up to a minute…"), 4000);
  try {
    const res = await fetch(`${API_BASE}/api/auth/${signup ? "signup" : "login"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signup ? { email, password, website: "" } : { email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.token) throw new Error(body.error || "Couldn't reach the server. Try again.");
    setAuthToken(body.token);
    track(signup ? "signup" : "login", { props: { app: true } });
    app.status = "";
    if (signup) {
      // Signed in already; the home city comes next, then the profile.
      app.pendingUser = body;
      app.authStep = "city";
      renderAppPage();
      return;
    }
    appSignedIn(body);
  } catch (err) {
    say(err.message);
  } finally {
    clearTimeout(slow);
    btn.disabled = false;
  }
}
function appSignedIn(user) {
  setCurrentUser(user);
  handleInviteArrival("login");
  renderAccountState();
  loadRadar();
  app.authStep = "email";
  app.seen = null;
  app.comm.plans = null;
  app.follow.shown = null;
  renderAppPage();
  loadAppProfile();
  syncAppChrome();
  if (currentUser.needs_details) setTimeout(() => openDetails(true), 0);
}
async function appHomeDone() {
  if (!app.homePick) return;
  const user = app.pendingUser || {};
  try {
    const res = await proSend("PATCH", "/api/me/preferences", { home_city: app.homePick });
    if (res && res.preferences) user.preferences = res.preferences;
    else user.preferences = { ...(user.preferences || {}), home_city: app.homePick };
  } catch { user.preferences = { ...(user.preferences || {}), home_city: app.homePick }; }
  prefs.home = app.homePick;
  appWrite(APP_KEYS.home, app.homePick);
  app.pendingUser = null;
  appSignedIn(user);
}

// ---- Wiring ----------------------------------------------------------------------
function appInit() {
  if (!isApp) return;
  appFilter = appPass;
  appPaintPins();
  appPaintText();
  appPaintTheme();
  appDarkQuery.addEventListener("change", () => { if (prefs.theme === "auto") appPaintTheme(); });
  // The columns round moves from the bar to the filter row's right.
  $("app-cols-slot").append($("app-cols-btn"));
  $("app-filters").hidden = false;

  $("app-tabs").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-app-tab]");
    if (b) appGo(b.dataset.appTab);
  });
  // The city round: a tap for the drop-down, a hold for your cities.
  const cityBtn = $("app-city-btn");
  let holdTimer = null;
  const holdOff = () => clearTimeout(holdTimer);
  cityBtn.addEventListener("pointerdown", () => {
    clearTimeout(holdTimer);
    app.held = false;
    holdTimer = setTimeout(() => {
      app.held = true;
      try { if (navigator.vibrate) navigator.vibrate(10); } catch { /* no haptics here */ }
      appOpenQuick();
    }, 450);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) cityBtn.addEventListener(ev, holdOff);
  cityBtn.addEventListener("contextmenu", (ev) => ev.preventDefault());
  cityBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (app.held) { app.held = false; return; }
    if (app.quick) return appCloseQuick();
    closeTool(); closeVenuePanel();
    appToggleDrop("cities");
  });
  $("app-quick").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const city = ev.target.closest("[data-app-quick]")?.dataset.appQuick;
    if (city == null) return;
    appCloseQuick();
    if (city !== state.city) appGoCity(city);
  });
  $("app-cols-btn").addEventListener("click", (ev) => { ev.stopPropagation(); app.cols = (app.cols % 3) + 1; syncAppChrome(); });
  $("app-scrim").addEventListener("click", () => appCloseDrop());
  $("app-catch").addEventListener("click", () => { appCloseMenu(); appCloseQuick(); });
  $("app-drop").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const city = ev.target.closest("[data-city]")?.dataset.city;
    if (city == null) return;
    appCloseDrop();
    appGoCity(state.city === city ? "" : city);
  });
  $("app-filters").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const pill = ev.target.closest("[data-app-menu]");
    if (pill) return appOpenMenu(pill.dataset.appMenu);
    const clear = ev.target.closest("[data-app-clear]");
    if (clear) return appClearMenu(clear.dataset.appClear);
    const opt = ev.target.closest("[data-app-opt]");
    if (opt) appPickOption(app.menu, opt.dataset.appOpt);
  });
  $("app-pins").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const b = ev.target.closest("[data-app-set]");
    if (b) appToggleSet(b.dataset.appSet);
  });
  $("app-pins").addEventListener("contextmenu", (ev) => ev.preventDefault());

  // Discover: a tap opens the show, a second goes fullscreen, a third comes
  // back; the action buttons do their own thing; the reel and each strip
  // move one page a swipe; a picture that fails drops its show.
  const reel = $("app-reel");
  reel.addEventListener("click", (ev) => {
    const item = ev.target.closest(".app-reel-item");
    if (!item) return;
    const id = +item.dataset.id;
    const act = ev.target.closest("[data-disc-act]")?.dataset.discAct;
    if (act) {
      ev.stopPropagation();
      const e = appDiscShow(id);
      if (!e) return;
      if (act === "map") appDiscToMap(e);
      else if (act === "list") appDiscToggleList(e, ev.target.closest("[data-disc-act]"));
      else if (act === "share") appDiscShare(e, ev.target.closest("[data-disc-act]"));
      return;
    }
    if (ev.target.closest(".app-info")) return; // the details: links and text, not a tap on the picture
    if (app.menu) return appCloseMenu();
    if (app.disc.open !== id) appDiscOpen(id);
    else appDiscFull(!app.disc.full);
  });
  reel.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const item = ev.target.closest(".app-reel-item");
    if (!item || ev.target !== item) return;
    ev.preventDefault();
    item.click();
  });
  reel.addEventListener("scroll", (ev) => {
    const strip = ev.target.closest?.(".app-strip");
    if (strip) return appDiscSwipe(strip);
    if (ev.target !== reel) return;
    if (app.disc.open == null) appOneStep(reel, "y");
    app.disc.scroll = reel.scrollTop;
  }, true);
  reel.addEventListener("load", (ev) => {
    const img = ev.target;
    if (img.tagName !== "IMG" || !img.naturalWidth || img.previousElementSibling) return; // the show's own picture, the strip's first
    const item = img.closest(".app-reel-item");
    const id = +item.dataset.id;
    const asp = img.naturalHeight / img.naturalWidth;
    if (app.disc.asp.get(id) !== asp) { app.disc.asp.set(id, asp); if (app.disc.open === id) appDiscLayout(item); }
  }, true);
  reel.addEventListener("error", (ev) => {
    const img = ev.target;
    if (img.tagName !== "IMG" || img.previousElementSibling) return;
    const item = img.closest(".app-reel-item");
    failedImages.add(img.dataset.key);
    const id = +item.dataset.id;
    if (app.disc.open === id) appDiscClose();
    item.remove();
    app.disc.key = appDiscRows().map(e => e.id).join(","); // the set as drawn now, without a rebuild under the thumb
    $("app-disc-empty").hidden = !(state.loaded && !reel.children.length);
  }, true);
  $("app-disc-back").addEventListener("click", () => { if (app.disc.full) appDiscFull(false); else appDiscClose(); });
  $("app-disc-reset").addEventListener("click", appDiscReset);
  window.addEventListener("resize", () => { const item = app.disc.open != null ? appDiscItem(app.disc.open) : null; if (item) appDiscLayout(item); });

  $("app-page").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (ev.target.id === "app-partner-form") appRequestSubmit(ev.target);
    else appAuthSubmit();
  });
  // The request form: a field's message goes as soon as it's filled in.
  $("app-page").addEventListener("input", (ev) => {
    const form = ev.target.closest("#app-partner-form");
    if (!form || !ev.target.name) return;
    const el = form.querySelector(`[data-err="${ev.target.name}"]`);
    if (el && ev.target.value.trim()) { el.hidden = true; el.textContent = ""; }
  });
  $("app-page").addEventListener("change", (ev) => {
    if (ev.target.id === "app-home-select") { appSetHome(ev.target.value); renderAppPage(); return; }
    if (ev.target.id === "app-add-city") {
      const c = appNamed(ev.target.value);
      if (c && !prefs.pinned.some(p => p.toLowerCase() === c.toLowerCase())) { prefs.pinned = [...prefs.pinned, c]; appWrite(APP_KEYS.pinned, prefs.pinned); }
      renderAppPage();
    }
  });
  $("app-page").addEventListener("click", (ev) => {
    const site = ev.target.closest("[data-app-site]")?.dataset.appSite;
    if (site) return $(site).click();
    const home = ev.target.closest("[data-app-home]")?.dataset.appHome;
    if (home) { app.homePick = home; return renderAppPage(); }
    if (ev.target.closest("[data-app-sso]")) {
      app.status = "Apple and Google sign in arrive with the App Store release. Email works now.";
      const el = $("app-page").querySelector(".app-status");
      if (el) el.textContent = app.status;
      return;
    }
    const unpin = ev.target.closest("[data-app-unpin]")?.dataset.appUnpin;
    if (unpin) { prefs.pinned = prefs.pinned.filter(p => p.toLowerCase() !== unpin.toLowerCase()); appWrite(APP_KEYS.pinned, prefs.pinned); return renderAppPage(); }
    const notif = ev.target.closest("[data-app-notif]");
    if (notif) { const k = notif.dataset.appNotif; prefs.notifs[k] = !prefs.notifs[k]; appWrite(APP_KEYS.notifs, prefs.notifs); notif.setAttribute("aria-checked", String(!!prefs.notifs[k])); return; }
    const pref = ev.target.closest("[data-app-pref]");
    if (pref) { const k = pref.dataset.appPref; appSetPref(k, !prefs[k]); pref.setAttribute("aria-checked", String(!!prefs[k])); return; }
    const mode = ev.target.closest("[data-app-theme]")?.dataset.appTheme;
    if (mode) { appSetTheme(mode); for (const b of $("app-page").querySelectorAll("[data-app-theme]")) b.setAttribute("aria-pressed", String(b.dataset.appTheme === mode)); return; }
    // Plan a Gallery Night: the day, the order, in and out of the plan, who.
    const when = ev.target.closest("[data-app-when]")?.dataset.appWhen;
    if (when) { app.night.when = when; appWrite(APP_KEYS.nightWhen, when); return renderAppPage(); }
    const move = ev.target.closest("[data-app-move]");
    if (move) { appPlanMove(move.dataset.key, +move.dataset.appMove); return renderAppPage(); }
    const unplan = ev.target.closest("[data-app-unplan]")?.dataset.appUnplan;
    if (unplan) { appPlanSet(unplan, false).then(renderAppPage).catch(err => { const el = $("app-night-status"); if (el) el.textContent = err.message; }); return; }
    const plan = ev.target.closest("[data-app-plan]")?.dataset.appPlan;
    if (plan) { appPlanSet(plan, true).then(renderAppPage).catch(err => { const el = $("app-night-status"); if (el) el.textContent = err.message; }); return; }
    const who = ev.target.closest("[data-app-who]")?.dataset.appWho;
    if (who) { app.night.who = app.night.who.includes(who) ? app.night.who.filter(h => h !== who) : [...app.night.who, who]; return renderAppPage(); }
    const join = ev.target.closest("[data-app-join]")?.dataset.appJoin;
    if (join) { prefs.joined = prefs.joined.includes(join) ? prefs.joined.filter(h => h !== join) : [...prefs.joined, join]; appWrite(APP_KEYS.joined, prefs.joined); return renderAppPage(); }
    const follow = ev.target.closest("[data-app-follow]");
    if (follow) return appFollowToggle(follow.dataset.appFollow, follow);
    const act = ev.target.closest("[data-app-act]")?.dataset.appAct;
    if (act === "switch") { app.authMode = app.authMode === "signup" ? "login" : "signup"; app.status = ""; renderAppPage(); }
    else if (act === "home-done") appHomeDone();
    else if (act === "edit") openModal("profile");
    else if (act === "plan") $("plan-link").click();
    else if (act === "share-plan") { $("plan-link").click(); $("plan-share")?.click(); }
    else if (act === "friends") openFriends();
    else if (act === "logout") $("profile-logout").click();
    else if (act === "settings") appPushSub("settings");
    else if (act && act.startsWith("sub-")) appPushSub(act.slice(4));
    else if (act === "night-send") appNightSend(ev.target.closest("[data-app-act]"));
    else if (act === "back") appPopSub();
    else if (act === "to-auth") { app.sub = null; renderAppPage(); }
  });
  // The radar comes back into view under a closed profile page with the
  // right tab lit.
  narrow.addEventListener("change", () => { if (!narrow.matches) { appCloseDrop(); appCloseMenu(); appCloseQuick(); } });
  syncAppChrome();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", appInit);
else appInit();
