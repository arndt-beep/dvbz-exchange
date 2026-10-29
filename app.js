/* DVBZ Exchange · Web-App auf Supabase.
   Liest alles, was die Rechte erlauben, rechnet Kontostände und Rangliste im Browser
   und schreibt über Tabellen (Back Office) oder die Server-Funktionen (Einlösen, Status). */
const S = {
  sb: null, session: null, uid: null, isAdmin: false, offline: false, loaded: false,
  catalog: [], participants: [], ledger: [], challenges: [], orders: [], settings: {}, emails: {},
  tab: "shop", filter: "Alle", orderFilter: "offen", redeemItem: null, loginEmail: ""
};
const SIZES = { "Oversize-Shirt": ["S","M","L","XL","XXL"], "Hoodie": ["S","M","L","XL","XXL"], "Cap": ["One Size"], "Socken": ["M (ca. 38–42)", "L (ca. 42–46)", "XL (ca. 46–49)"], "Sticker-Pack": ["–"] };
const STATUS_NEXT = { offen: ["freigegeben","abgelehnt"], freigegeben: ["bestellt"], bestellt: ["geliefert"], geliefert: [], abgelehnt: [] };
const STATUS_LABEL = { freigegeben: "Freigeben", abgelehnt: "Ablehnen", bestellt: "Bestellt", geliefert: "Geliefert" };
const $ = s => document.querySelector(s);
const fmt = n => new Intl.NumberFormat("de-DE").format(n);
const dt = s => { try { return new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }); } catch { return ""; } };
const monthName = d => d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
function msg(id, text, kind) { const m = $(id); m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); }
const errText = err => (err?.message || err?.error_description || String(err || "unbekannt")).replace(/^.*?:\s(?=[A-ZÄÖÜ])/, "");
const slug = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function sym(it) {
  const words = String(it.name || "").toUpperCase().replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").split(/[^A-Z0-9]+/).filter(Boolean);
  let s = words.map(w => w[0]).join("");
  if (s.length < 3) s = (words[0] || "DVBZ").slice(0, 4);
  return s.slice(0, 5);
}

/* ---------- abgeleitete Werte ---------- */
const allOrders = () => [...S.orders].sort((a, b) => String(b.at).localeCompare(String(a.at)));
const balance = pid => S.ledger.filter(l => l.pid === pid).reduce((s, l) => s + (Number(l.delta) || 0), 0);
const earned = pid => S.ledger.filter(l => l.pid === pid && l.delta > 0).reduce((s, l) => s + l.delta, 0);
// Vertriebsmonat (setzt der Abgleich, sobald ein neues Auswertungsblatt auftaucht), sonst Kalendermonat
const monthStart = () => {
  if (S.settings.salesPeriodStart) return new Date(S.settings.salesPeriodStart).toISOString();
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};
const periodLabel = () => {
  const p = S.settings.salesPeriod;
  if (!p) return monthName(new Date());
  const [y, m] = p.split("-").map(Number);
  return "Vertriebsmonat " + monthName(new Date(y, m - 1, 1));
};
const earnedMonth = pid => { const m = monthStart(); return S.ledger.filter(l => l.pid === pid && l.delta > 0 && l.at >= m).reduce((s, l) => s + l.delta, 0); };
const reserved = pid => allOrders().filter(o => o.pid === pid && o.status === "offen").reduce((s, o) => s + (o.points || 0), 0);
const available = pid => balance(pid) - reserved(pid);
const myPart = () => S.uid ? S.participants.find(p => p.uid === S.uid) : null;
const stockLeft = it => (it.stock == null || it.stock === "") ? null : Math.max(0, it.stock - (it.sold || 0));
const activeItems = () => S.catalog.filter(i => i.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
// Rangliste: Monatswertung (startet jeden Monat neu), Rang nach Gesamtpunkten
const ranking = () => S.participants.filter(p => p.active !== false && !p.is_admin)
  .map(p => ({ p, e: earnedMonth(p.id), total: earned(p.id) })).sort((a, b) => b.e - a.e || b.total - a.total);
function tier(pts) {
  if (pts >= 3000) return "Wolf";
  if (pts >= 1500) return "Shark";
  if (pts >= 500) return "Closer";
  return "Rookie";
}

/* ---------- Render ---------- */
function render() {
  const inApp = !!S.session && !S.offline;
  $("#view-login").hidden = inApp || S.offline;
  $("#tabs").hidden = !inApp;
  for (const v of ["shop", "konto", "rangliste", "admin"]) $("#view-" + v).hidden = !inApp || v !== S.tab;
  if (!inApp) $("#drawer").hidden = true;
  renderWallet(); renderNotice(); renderHero(); renderTape();
  if (!inApp) return;
  if (S.tab === "shop") renderShop();
  if (S.tab === "konto") renderKonto();
  if (S.tab === "rangliste") renderBoard();
  if (S.tab === "admin") renderAdmin();
  $("#tab-admin").hidden = !S.isAdmin;
}
function renderWallet() {
  const p = myPart();
  if (S.offline) { $("#walletNum").textContent = "–"; $("#walletSub").textContent = "nicht eingerichtet"; return; }
  if (!S.session) { $("#walletNum").textContent = "–"; $("#walletSub").textContent = "anmelden"; return; }
  if (!S.loaded) { $("#walletNum").textContent = "–"; $("#walletSub").textContent = "lädt …"; return; }
  if (!p) { $("#walletNum").textContent = "–"; $("#walletSub").textContent = "nicht verknüpft"; return; }
  $("#walletNum").textContent = fmt(available(p.id));
  const r = reserved(p.id);
  $("#walletSub").textContent = r ? `P frei · ${fmt(r)} reserviert` : `P frei · ${tier(earned(p.id))}`;
}
function renderHero() {
  if (S.settings.dropName) $("#dropName").textContent = S.settings.dropName;
  const live = S.session && S.loaded;
  $("#statItems").textContent = live ? fmt(activeItems().length) : "–";
  $("#statLimited").textContent = live ? fmt(activeItems().reduce((s, i) => s + (stockLeft(i) || 0), 0)) : "–";
  $("#statFloat").textContent = live ? fmt(S.participants.reduce((s, p) => s + Math.max(0, balance(p.id)), 0)) : "–";
  const top = live ? ranking()[0] : null;
  $("#statTop").textContent = top && top.e > 0 ? top.p.name : "Noch offen";
}
let lastTape = "";
function renderTape() {
  const bits = [];
  for (const it of activeItems()) {
    const left = stockLeft(it);
    bits.push([it.sku || sym(it), `${fmt(it.points)} P`, left != null ? `${left}/${it.stock} LEFT` : "", left === 0 ? "down" : (left != null ? "up" : "")]);
  }
  for (const l of S.ledger.slice(0, 12)) {
    const p = S.participants.find(p => p.id === l.pid);
    if (!p) continue;
    bits.push([p.name.toUpperCase(), (l.delta > 0 ? "▲ +" : "▼ ") + fmt(l.delta), l.reason || "", l.delta > 0 ? "up" : "down"]);
  }
  if (!bits.length) bits.push(["DVBZ", "EXCHANGE", "MARKT GEÖFFNET", ""]);
  const key = JSON.stringify(bits);
  if (key === lastTape) return;
  lastTape = key;
  const mk = () => bits.map(([a, b, c, cls]) => el("span", {}, el("b", { text: a }), " ", el("span", { class: cls, text: b }), c ? " · " + c : ""));
  $("#tape").replaceChildren(...mk(), ...mk());
}
function renderNotice() {
  const box = $("#globalNotice"); box.replaceChildren();
  if (S.offline) box.append(el("div", { class: "notice" }, el("strong", { text: "Noch nicht eingerichtet. " }), "In config.js fehlen die Supabase-Adresse und der anon-Schlüssel."));
  else if (S.session && S.loaded && !myPart()) box.append(el("div", { class: "notice" }, el("strong", { text: "Dein Depot ist noch nicht verknüpft. " }), "Sag deinem Vertriebsleiter Bescheid, damit er deine E-Mail im Back Office hinterlegt. Den Markt ansehen kannst du schon jetzt."));
}
function tile(it, idx) {
  if (it.photo || it.print) {
    const main = it.photo || it.print;
    return el("div", { class: "cert" },
      it.limited ? el("span", { class: "stamp", text: it.stock ? "LIMITED · " + it.stock : "LIMITED" }) : null,
      el("div", { class: "shot" },
        el("span", { class: "lab", text: it.label || "DVBZ" }),
        el("img", { src: main, alt: it.alt || it.name, loading: "lazy", style: it.photoPos ? "object-position:" + it.photoPos : null }),
        it.photo && it.print ? el("img", { class: "alt", src: it.print, alt: "Druckmotiv " + it.name, loading: "lazy" }) : null
      )
    );
  }
  const lines = String(it.back || it.name).split("|").map(s => s.trim()).filter(Boolean);
  const cls = ["tile", "g-" + (it.color || "schwarz")];
  if (it.label === "HEAVEN SENT") cls.push("serif");
  return el("div", { class: "cert", "aria-hidden": "true" },
    it.limited ? el("span", { class: "stamp", text: it.stock ? "LIMITED · " + it.stock : "LIMITED" }) : null,
    el("div", { class: cls.join(" ") },
      el("span", { class: "lab", text: it.label || "DVBZ" }),
      el("div", { class: "back" }, lines.map((l, i) => [i ? el("br") : null, l])),
      it.front ? el("div", { class: "front", text: "Druck · " + it.front }) : null,
      el("span", { class: "ser" }, el("span", { text: "Serie A · N° " + String(idx + 1).padStart(4, "0") }), el("span", { text: "DVBZ EXCH." }))
    )
  );
}
function renderEarn() {
  const list = [...S.challenges].filter(c => c.active !== false).sort((a, b) => a.points - b.points);
  $("#earnList").replaceChildren(el("span", { text: "SO VERDIENST DU PUNKTE" }),
    ...(list.length ? list.map(c => el("div", {}, el("span", { text: c.name }), el("b", { text: c.points ? "+" + fmt(c.points) : "nach Ansage" })))
      : [el("div", {}, el("span", { text: "Die Challenges stehen bald hier." }))]));
}
function renderShop() {
  renderEarn();
  const items = activeItems();
  const labels = ["Alle", ...new Set(items.map(i => i.label).filter(Boolean))];
  $("#filters").replaceChildren(...labels.map(l => el("button", { class: "chip", type: "button", "aria-pressed": String(S.filter === l), text: l, onclick: () => { S.filter = l; renderShop(); } })));
  const shown = items.filter(i => S.filter === "Alle" || i.label === S.filter);
  const grid = $("#grid");
  if (!shown.length) { grid.replaceChildren(el("p", { class: "empty", text: S.loaded ? "Noch keine Titel gelistet." : "Der Markt öffnet …" })); return; }
  const p = myPart();
  grid.replaceChildren(...shown.map(it => {
    const left = stockLeft(it);
    const soldOut = left === 0;
    const canAfford = p && available(p.id) >= it.points;
    let label = "Kaufen";
    if (soldOut) label = "Ausverkauft";
    else if (!p) label = "Kein Depot";
    else if (!canAfford) label = `Fehlen ${fmt(it.points - available(p.id))} P`;
    return el("article", { class: "item" },
      tile(it, items.indexOf(it)),
      el("div", { class: "quote" },
        el("span", { class: "sym", text: it.sku || sym(it) }),
        el("span", { class: "px" }, fmt(it.points), el("small", { text: "PUNKTE" })),
        el("h3", { text: it.name })
      ),
      el("div", { class: "info", text: [it.type, it.color, it.front, left != null ? `${left}/${it.stock} verfügbar` : "unlimitiert"].filter(Boolean).join(" · ") }),
      el("button", { class: "btn", type: "button", disabled: soldOut || !p || !canAfford, text: label, onclick: () => openRedeem(it) })
    );
  }));
}

function ordersTable(list, admin) {
  if (!list.length) return el("p", { class: "empty", text: admin ? "Keine Orders in diesem Status." : "Noch keine Order. Der Markt wartet." });
  const head = el("tr", {}, el("th", { text: "Datum" }), admin ? el("th", { text: "Broker" }) : null, el("th", { text: "Titel" }), el("th", { text: "Größe" }), el("th", { text: "Punkte" }), el("th", { text: "Status" }), el("th", { text: "" }));
  const rows = list.map(o => {
    const p = S.participants.find(x => x.id === o.pid);
    let act = null;
    if (admin) act = el("div", { class: "actions" }, (STATUS_NEXT[o.status] || []).map(s => el("button", { class: "btn small " + (s === "abgelehnt" ? "danger" : "ghost"), type: "button", text: STATUS_LABEL[s], onclick: e => setStatus(o, s, e.currentTarget) })));
    else if (o.status === "offen") act = el("button", { class: "btn small ghost", type: "button", text: "Stornieren", onclick: e => cancelOrder(o, e.currentTarget) });
    return el("tr", {},
      el("td", { text: dt(o.at) }),
      admin ? el("td", { text: p ? p.name : "Unbekannt" }) : null,
      el("td", {}, o.name, o.note ? el("div", { class: "note", text: o.note }) : null),
      el("td", { text: o.size || "–" }),
      el("td", { class: "num", text: fmt(o.points) }),
      el("td", {}, el("span", { class: "status st-" + o.status, text: o.status })),
      el("td", {}, act)
    );
  });
  return el("table", {}, el("thead", {}, head), el("tbody", {}, rows));
}
function ledgerTable(list) {
  if (!list.length) return el("p", { class: "empty", text: "Noch keine Buchungen." });
  return el("table", {},
    el("thead", {}, el("tr", {}, el("th", { text: "Datum" }), el("th", { text: "Vorgang" }), el("th", { text: "Punkte" }))),
    el("tbody", {}, list.map(l => el("tr", {},
      el("td", { text: dt(l.at) }), el("td", { text: l.reason || "–" }),
      el("td", { class: "num " + (l.delta > 0 ? "plus" : "minus"), text: (l.delta > 0 ? "+" : "") + fmt(l.delta) })
    ))));
}
function renderKonto() {
  const p = myPart();
  const r = $("#receipt");
  if (!p) {
    r.replaceChildren(el("div", { class: "statement" }, el("div", { class: "hd" }, el("h3", { text: "Kein Depot" }), el("span", { text: "DVBZ Exchange" })),
      el("div", { text: "Sobald deine E-Mail im Back Office hinterlegt ist, steht hier dein Kontostand." })));
    $("#myOrders").replaceChildren(); $("#myLedger").replaceChildren(); return;
  }
  const e = earned(p.id), b = balance(p.id), res = reserved(p.id);
  r.replaceChildren(el("div", { class: "statement" },
    el("div", { class: "hd" }, el("h3", { text: p.name }), el("span", {}, "Depotauszug", el("br"), p.team || "DVBZ")),
    el("div", { class: "row" }, el("span", { text: "Gesammelt" }), el("span", { text: "+" + fmt(e) })),
    el("div", { class: "row" }, el("span", { text: "davon im Vertriebsmonat" }), el("span", { text: "+" + fmt(earnedMonth(p.id)) })),
    el("div", { class: "row" }, el("span", { text: "Eingelöst" }), el("span", { text: fmt(b - e) })),
    el("div", { class: "row" }, el("span", { text: "Reserviert" }), el("span", { text: res ? "-" + fmt(res) : "0" })),
    el("div", { class: "rule" }),
    el("div", { class: "row big" }, el("span", { text: "Verfügbar" }), el("span", { text: fmt(b - res) + " P" })),
    el("div", { class: "rank" }, el("span", { text: nextTierText(e) }), el("b", { text: tier(e) }))
  ));
  $("#myOrders").replaceChildren(ordersTable(allOrders().filter(o => o.pid === p.id), false));
  $("#myLedger").replaceChildren(ledgerTable(S.ledger.filter(l => l.pid === p.id)));
}
function nextTierText(e) {
  const steps = [[500, "Closer"], [1500, "Shark"], [3000, "Wolf"]];
  const n = steps.find(([t]) => e < t);
  return n ? `Noch ${fmt(n[0] - e)} P bis ${n[1]}` : "Höchster Rang. Der Wolf.";
}
function renderBoard() {
  $("#boardMonth").textContent = "Börsenparkett · " + periodLabel();
  const rows = ranking();
  if (!rows.some(r => r.e > 0)) {
    $("#podium").replaceChildren();
    $("#board").replaceChildren(el("p", { class: "empty", text: "Der Monat hat gerade erst begonnen. Die ersten Punkte entscheiden, wer das Parkett regiert." })); return;
  }
  const names = ["1. Platz", "2. Platz", "3. Platz"];
  const me = p => p.uid && p.uid === S.uid ? " (du)" : "";
  const podium = rows.slice(0, 3).filter(r => r.e > 0);
  $("#podium").replaceChildren(...podium.map((r, i) => el("div", { class: "pod" + (i === 0 ? " first" : "") },
    el("span", { class: "pos", text: names[i] }),
    el("span", { class: "who", text: r.p.name + me(r.p) }),
    el("span", { class: "score", text: fmt(r.e) + " P" }),
    el("small", { text: [r.p.team, tier(r.total)].filter(Boolean).join(" · ") })
  )));
  $("#board").replaceChildren(...rows.slice(podium.length).map((r, i) => el("div", { class: "rankrow" },
    el("span", { class: "pos", text: String(i + podium.length + 1).padStart(2, "0") }),
    el("span", { class: "who" }, r.p.name + me(r.p), el("small", { text: [r.p.team, tier(r.total)].filter(Boolean).join(" · ") })),
    el("span", { class: "score", text: fmt(r.e) + " P" })
  )));
}

/* ---------- Back Office ---------- */
function fillSelect(sel, opts, placeholder) {
  const keep = sel.value;
  sel.replaceChildren(...(placeholder ? [el("option", { value: "", text: placeholder })] : []), ...opts.map(([v, t]) => el("option", { value: v, text: t })));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
function renderAdmin() {
  if (!S.isAdmin) return;
  const statuses = ["offen", "freigegeben", "bestellt", "geliefert", "abgelehnt", "alle"];
  const orders = allOrders();
  $("#orderFilter").replaceChildren(...statuses.map(s => {
    const n = s === "alle" ? orders.length : orders.filter(o => o.status === s).length;
    return el("button", { class: "chip", type: "button", "aria-pressed": String(S.orderFilter === s), text: `${s} (${n})`, onclick: () => { S.orderFilter = s; renderAdmin(); } });
  }));
  $("#adminOrders").replaceChildren(ordersTable(S.orderFilter === "alle" ? orders : orders.filter(o => o.status === S.orderFilter), true));
  renderPrintJob(orders);

  const open = S.settings.signupOpen === true;
  const withMail = Object.keys(S.emails).length, joined = S.participants.filter(p => p.uid && !p.is_admin).length;
  $("#launchState").textContent = (open
    ? "Der Shop ist freigeschaltet: Alle Broker mit hinterlegter E-Mail können ihr Passwort festlegen."
    : "Noch nicht freigeschaltet: Nur das Back Office kann sich anmelden.") + ` ${withMail} E-Mails hinterlegt, ${joined} Broker angemeldet.`;
  $("#syncState").textContent = S.lastSync
    ? `Letzter Abgleich mit dem Vertriebscontrolling: ${new Date(S.lastSync).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`
    : "Abgleich mit dem Vertriebscontrolling: noch nicht gelaufen.";
  $("#launchToggle").textContent = open ? "Freischaltung zurücknehmen" : "Shop freischalten";
  $("#launchToggle").className = "btn small" + (open ? " ghost" : "");

  const parts = [...S.participants].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const pOpts = parts.map(p => [p.id, `${p.name} · ${fmt(available(p.id))} P`]);
  fillSelect($("#bookPid"), pOpts, "Bitte wählen");
  fillSelect($("#behalfPid"), pOpts, "Bitte wählen");
  fillSelect($("#bookChallenge"), [...S.challenges].sort((a, b) => a.points - b.points).map(c => [c.id, `${c.name} (+${c.points})`]), "Eigene Buchung");
  const itemOpts = S.catalog.map(i => [i.id, `${i.sku || sym(i)} · ${i.name} · ${fmt(i.points)} P`]);
  fillSelect($("#behalfItem"), itemOpts, "Bitte wählen");
  fillSelect($("#itemEdit"), itemOpts, "Neuer Titel");
  const bi = S.catalog.find(i => i.id === $("#behalfItem").value);
  fillSelect($("#behalfSize"), (SIZES[bi?.type] || ["–"]).map(s => [s, s]));

  const tbl = $("#adminParts");
  if (!parts.length) { tbl.replaceChildren(el("p", { class: "empty", text: "Noch niemand angelegt. Starte mit „Broker anlegen“." })); return; }
  const access = p => p.uid ? "angemeldet" : (S.emails[p.id] ? "eingeladen" : "keine E-Mail");
  tbl.replaceChildren(el("table", {},
    el("thead", {}, el("tr", {}, ["Name", "Team", "E-Mail", "Zugang", "Gesammelt", "Verfügbar", ""].map(t => el("th", { text: t })))),
    el("tbody", {}, parts.map(p => el("tr", {},
      el("td", { text: p.name + (p.is_admin ? " · Back Office" : "") }), el("td", { text: p.team || "–" }),
      el("td", { text: S.emails[p.id] || "–" }), el("td", { text: access(p) }),
      el("td", { class: "num", text: fmt(earned(p.id)) }),
      el("td", { class: "num", text: fmt(available(p.id)) }),
      el("td", {}, el("div", { class: "actions" },
        el("button", { class: "btn small ghost", type: "button", text: "Bearbeiten", onclick: () => editPart(p) }),
        p.uid === S.uid ? null : el("button", { class: "btn small danger", type: "button", text: "Entfernen", onclick: e => removePart(p, e.currentTarget) })))
    )))
  ));
}

/* ---------- Aktionen ---------- */
function openRedeem(it) {
  S.redeemItem = it;
  $("#drawerTitle").replaceChildren(el("small", { text: "Order-Ticket · " + (it.sku || sym(it)) }), `${it.name} · ${fmt(it.points)} P`);
  fillSelect($("#redeemSize"), (SIZES[it.type] || ["–"]).map(s => [s, s]));
  if ((SIZES[it.type] || []).includes("L")) $("#redeemSize").value = "L";
  msg("#redeemMsg", "Die Punkte werden reserviert und abgebucht, sobald das Back Office freigibt.");
  $("#drawer").hidden = false; $("#redeemSize").focus();
}
$("#redeemCancel").addEventListener("click", () => { $("#drawer").hidden = true; });
$("#redeemForm").addEventListener("submit", async e => {
  e.preventDefault();
  const it = S.redeemItem, p = myPart();
  if (!it || !p) return;
  if (available(p.id) < it.points) { msg("#redeemMsg", "Nicht genug freie Punkte.", "err"); return; }
  $("#redeemGo").disabled = true;
  try {
    const { error } = await S.sb.rpc("redeem", { p_item: it.id, p_size: $("#redeemSize").value, p_note: $("#redeemNote").value.trim() || null });
    if (error) throw error;
    $("#redeemNote").value = ""; $("#drawer").hidden = true;
    await load();
  } catch (err) { msg("#redeemMsg", "Order fehlgeschlagen: " + errText(err), "err"); }
  finally { $("#redeemGo").disabled = false; }
});
async function cancelOrder(o, btn) {
  btn.disabled = true;
  const { error } = await S.sb.rpc("cancel_order", { p_order: o.id });
  if (error) { btn.disabled = false; btn.textContent = "Fehler"; return; }
  await load();
}
async function setStatus(o, status, btn) {
  btn.disabled = true;
  const { error } = await S.sb.rpc("set_order_status", { p_order: o.id, p_status: status });
  if (error) { btn.disabled = false; btn.textContent = "Fehler"; btn.title = errText(error); return; }
  await load();
}
$("#launchToggle").addEventListener("click", async e => {
  const btn = e.currentTarget, open = S.settings.signupOpen === true;
  if (!open && btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Wirklich für alle freischalten?"; return; }
  btn.dataset.confirm = ""; btn.disabled = true;
  const { error } = await S.sb.from("settings").update({ value: { ...S.settings, signupOpen: !open } }).eq("id", "shop");
  btn.disabled = false;
  msg("#launchMsg", error ? "Fehler: " + errText(error) : (open ? "Freischaltung zurückgenommen." : "Shop ist freigeschaltet."), error ? "err" : "ok");
  await load();
});
/* ---------- Druckauftrag ---------- */
const printSku = o => { const it = S.catalog.find(i => i.id === o.item); return it?.sku || (it ? sym(it) : "?"); };
function printJob(orders) {
  const ready = orders.filter(o => o.status === "freigegeben");
  const batch = new Date().toISOString().slice(0, 10) + "-" + ready.length;
  return { ready, job: { batch, lines: ready.map(o => ({ order_id: o.id, sku: printSku(o), size: o.size || "–", who: S.participants.find(p => p.id === o.pid)?.name || "" })) } };
}
function renderPrintJob(orders) {
  const { ready, job } = printJob(orders);
  const groups = {};
  for (const l of job.lines) { const k = l.sku + " · " + l.size; groups[k] = (groups[k] || 0) + 1; }
  $("#printSummary").replaceChildren(ready.length
    ? el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: "Motiv · Größe" }), el("th", { text: "Stück" }))),
        el("tbody", {}, Object.entries(groups).map(([k, n]) => el("tr", {}, el("td", { text: k }), el("td", { class: "num", text: n })))))
    : el("p", { class: "empty", text: "Keine freigegebenen Orders. Erst im Order-Buch freigeben." }));
  $("#printJson").value = ready.length ? JSON.stringify(job, null, 1) : "";
  $("#printCopy").disabled = $("#printDone").disabled = !ready.length;
}
$("#printCopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#printJson").value); msg("#printMsg", "Kopiert.", "ok"); }
  catch { $("#printJson").select(); msg("#printMsg", "Kopieren blockiert: Text ist markiert, bitte mit Cmd+C kopieren."); }
});
$("#printDone").addEventListener("click", async e => {
  const btn = e.currentTarget;
  if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Wirklich bei Printful bestellt?"; return; }
  btn.disabled = true;
  const { ready } = printJob(allOrders());
  const { data, error } = await S.sb.rpc("mark_ordered", { p_orders: ready.map(o => o.id) });
  if (error) msg("#printMsg", "Fehler beim Speichern: " + errText(error), "err");
  else msg("#printMsg", `${data} Orders auf „bestellt“ gesetzt.`, "ok");
  btn.dataset.confirm = ""; btn.textContent = "Alle als bestellt markieren";
  await load();
});

async function removePart(p, btn) {
  if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Wirklich? Löscht auch Punkte"; return; }
  btn.disabled = true;
  const { error } = await S.sb.from("participants").delete().eq("id", p.id);
  if (error) { btn.disabled = false; btn.textContent = "Fehler"; return; }
  await load();
}

$("#bookChallenge").addEventListener("change", () => {
  const c = S.challenges.find(c => c.id === $("#bookChallenge").value);
  if (c) { $("#bookPoints").value = c.points; $("#bookReason").value = c.name; }
});
$("#bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  const pid = $("#bookPid").value, delta = Math.round(Number($("#bookPoints").value)), reason = $("#bookReason").value.trim();
  if (!pid || !delta || !reason) { msg("#bookMsg", "Broker, Punkte und Grund ausfüllen.", "err"); return; }
  const { error } = await S.sb.from("ledger").insert({ participant_id: pid, delta, reason });
  if (error) { msg("#bookMsg", "Buchung fehlgeschlagen: " + errText(error), "err"); return; }
  const p = S.participants.find(p => p.id === pid);
  msg("#bookMsg", `${delta > 0 ? "+" : ""}${fmt(delta)} Punkte für ${p?.name || "?"} gebucht.`, "ok");
  $("#bookPoints").value = ""; $("#bookReason").value = ""; $("#bookChallenge").value = "";
  await load();
});

function editPart(p) {
  $("#partId").value = p.id; $("#partName").value = p.name; $("#partTeam").value = p.team || "";
  $("#partEmail").value = S.emails[p.id] || ""; $("#partAdmin").value = p.is_admin ? "1" : "0";
  $("#partTitle").textContent = "Broker bearbeiten"; $("#partGo").textContent = "Speichern"; $("#partReset").hidden = false;
  msg("#partMsg", ""); $("#partForm").scrollIntoView({ behavior: "smooth", block: "center" }); $("#partName").focus();
}
function resetPart() {
  for (const id of ["#partId", "#partName", "#partTeam", "#partEmail"]) $(id).value = "";
  $("#partAdmin").value = "0";
  $("#partTitle").textContent = "Broker anlegen"; $("#partGo").textContent = "Anlegen"; $("#partReset").hidden = true;
}
$("#partReset").addEventListener("click", () => { resetPart(); msg("#partMsg", ""); });
$("#partForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#partName").value.trim();
  if (!name) return;
  const email = $("#partEmail").value.trim().toLowerCase() || null;
  const body = { name, team: $("#partTeam").value.trim() || null, email, is_admin: $("#partAdmin").value === "1" };
  const id = $("#partId").value;
  if (email && Object.entries(S.emails).some(([pid, m]) => m === email && pid !== id)) { msg("#partMsg", "Diese E-Mail gehört schon zu einem anderen Broker.", "err"); return; }
  let error;
  if (id) ({ error } = await S.sb.from("participants").update(body).eq("id", id));
  else {
    let newId = slug(name) || "broker";
    if (S.participants.some(p => p.id === newId)) newId += "-" + Math.random().toString(36).slice(2, 6);
    ({ error } = await S.sb.from("participants").insert({ id: newId, ...body }));
  }
  if (error) { msg("#partMsg", "Speichern fehlgeschlagen: " + errText(error), "err"); return; }
  msg("#partMsg", id ? name + " gespeichert." : name + " angelegt.", "ok");
  resetPart();
  await load();
});

$("#behalfItem").addEventListener("change", () => {
  const it = S.catalog.find(i => i.id === $("#behalfItem").value);
  fillSelect($("#behalfSize"), (SIZES[it?.type] || ["–"]).map(s => [s, s]));
});
$("#behalfForm").addEventListener("submit", async e => {
  e.preventDefault();
  const pid = $("#behalfPid").value, it = S.catalog.find(i => i.id === $("#behalfItem").value);
  if (!pid || !it) return;
  if (available(pid) < it.points) { msg("#behalfMsg", "Nicht genug freie Punkte.", "err"); return; }
  const { error } = await S.sb.rpc("redeem", { p_item: it.id, p_size: $("#behalfSize").value, p_note: null, p_participant: pid });
  if (error) { msg("#behalfMsg", "Fehlgeschlagen: " + errText(error), "err"); return; }
  msg("#behalfMsg", "Order angelegt. Jetzt oben im Order-Buch freigeben.", "ok");
  await load();
});

$("#itemEdit").addEventListener("change", () => {
  const it = S.catalog.find(i => i.id === $("#itemEdit").value) || {};
  $("#itemName").value = it.name || ""; $("#itemLabel").value = it.label || "CLOSERS CLUB";
  $("#itemBack").value = it.back || ""; $("#itemFront").value = it.front || "";
  $("#itemType").value = it.type || "Oversize-Shirt"; $("#itemColor").value = it.color || "Ivory";
  $("#itemPoints").value = it.points ?? ""; $("#itemStock").value = it.stock ?? ""; $("#itemActive").value = it.active === false ? "0" : "1";
});
$("#itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("#itemEdit").value;
  const stock = $("#itemStock").value === "" ? null : Number($("#itemStock").value);
  const body = { name: $("#itemName").value.trim(), label: $("#itemLabel").value, back: $("#itemBack").value.trim(), front: $("#itemFront").value.trim(),
    type: $("#itemType").value, color: $("#itemColor").value, points: Number($("#itemPoints").value), stock, limited: stock != null, active: $("#itemActive").value === "1" };
  const { error } = id
    ? await S.sb.from("catalog").update(body).eq("id", id)
    : await S.sb.from("catalog").insert({ id: slug(body.name) + "-" + Math.random().toString(36).slice(2, 6), sort: S.catalog.length + 1, ...body });
  if (error) { msg("#itemMsg", "Speichern fehlgeschlagen: " + errText(error), "err"); return; }
  msg("#itemMsg", "Gespeichert.", "ok");
  await load();
});

/* ---------- Anmeldung ---------- */
// Ohne Mailversand: Beim ersten Besuch legt jeder sein Passwort selbst fest.
// Das klappt nur für E-Mails, die im Back Office hinterlegt sind (Sperre in der Datenbank).
let signup = false;
function setMode(first) {
  signup = first;
  $("#loginLede").textContent = first
    ? "Erster Besuch: Gib deine Firmen-E-Mail ein und leg ein Passwort mit mindestens 8 Zeichen fest."
    : "Melde dich mit deiner Firmen-E-Mail und deinem Passwort an.";
  $("#loginGo").textContent = first ? "Passwort festlegen" : "Anmelden";
  $("#modeSwitch").textContent = first ? "Ich habe schon ein Passwort" : "Zum ersten Mal hier? Passwort festlegen";
  $("#loginPass").autocomplete = first ? "new-password" : "current-password";
  msg("#loginMsg", "");
}
$("#modeSwitch").addEventListener("click", () => setMode(!signup));
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#loginEmail").value.trim().toLowerCase(), password = $("#loginPass").value;
  if (!email || password.length < 8) { msg("#loginMsg", "Passwort muss mindestens 8 Zeichen haben.", "err"); return; }
  $("#loginGo").disabled = true; msg("#loginMsg", signup ? "Lege Zugang an …" : "Melde an …");
  const { data, error } = signup
    ? await S.sb.auth.signUp({ email, password })
    : await S.sb.auth.signInWithPassword({ email, password });
  $("#loginGo").disabled = false;
  if (error) {
    const t = errText(error);
    let text = "Das hat nicht geklappt: " + t;
    if (/freigeschaltet|Database error|saving new user/i.test(t)) text = "Diese E-Mail ist nicht freigeschaltet. Bitte beim Vertriebsleiter melden.";
    else if (/already registered|already been registered/i.test(t)) text = "Für diese E-Mail gibt es schon ein Passwort. Bitte normal anmelden.";
    else if (/Invalid login/i.test(t)) text = "E-Mail oder Passwort stimmt nicht. Passwort vergessen? Beim Vertriebsleiter melden.";
    msg("#loginMsg", text, "err");
    return;
  }
  if (signup && !data.session) { msg("#loginMsg", "Zugang angelegt. Bitte jetzt anmelden.", "ok"); setMode(false); return; }
  $("#loginPass").value = ""; msg("#loginMsg", "");
});
$("#logout").addEventListener("click", async () => { await S.sb.auth.signOut(); });

/* ---------- Tabs ---------- */
function showTab(t) {
  if (t === "admin" && !S.isAdmin) t = "shop";
  S.tab = t;
  for (const b of document.querySelectorAll("nav.tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === t));
  if (t !== "shop") $("#drawer").hidden = true;
  history.replaceState(null, "", t === "shop" ? location.pathname : "#" + t);
  render();
}
document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
  if (!S.session) { $("#view-login").scrollIntoView({ behavior: "smooth" }); return; }
  showTab(b.dataset.go); $("#tabs").scrollIntoView({ behavior: "smooth" });
}));
$("#walletBtn").addEventListener("click", () => { if (S.session) { showTab("konto"); $("#tabs").scrollIntoView({ behavior: "smooth" }); } else $("#view-login").scrollIntoView({ behavior: "smooth" }); });

/* ---------- Daten ---------- */
const mapItem = r => ({ ...r, order: r.sort, photoPos: r.photo_pos });
const mapPart = r => ({ ...r, uid: r.user_id });
const mapLedger = r => ({ id: r.id, pid: r.participant_id, delta: r.delta, reason: r.reason, at: r.created_at });
const mapOrder = r => ({ id: r.id, pid: r.participant_id, item: r.item_id, name: r.item_name, points: r.points, size: r.size, note: r.note, status: r.status, at: r.created_at });
let loading = null;
async function load() {
  if (!S.session) return;
  if (loading) return loading;
  loading = (async () => {
    const sb = S.sb;
    const [cat, parts, led, ch, ord, set] = await Promise.all([
      sb.from("catalog").select("*"),
      sb.from("participants").select("id, name, team, user_id, is_admin, active"),
      sb.from("ledger").select("id, participant_id, delta, reason, created_at").order("created_at", { ascending: false }).limit(5000),
      sb.from("challenges").select("*"),
      sb.from("orders").select("*").order("created_at", { ascending: false }),
      sb.from("settings").select("*").eq("id", "shop").maybeSingle()
    ]);
    const err = [cat, parts, led, ch, ord].find(r => r.error);
    if (err) { console.error(err.error); return; }
    S.catalog = cat.data.map(mapItem);
    S.participants = parts.data.map(mapPart);
    S.ledger = led.data.map(mapLedger);
    S.challenges = ch.data;
    S.orders = ord.data.map(mapOrder);
    S.settings = set.data?.value || {};
    S.isAdmin = !!myPart()?.is_admin;
    if (S.isAdmin) {
      const { data } = await sb.rpc("admin_participants");
      S.emails = Object.fromEntries((data || []).filter(r => r.email).map(r => [r.id, r.email]));
      const { data: snap } = await sb.from("metric_snapshots").select("updated_at").order("updated_at", { ascending: false }).limit(1);
      S.lastSync = snap?.[0]?.updated_at || null;
    }
    S.loaded = true;
    if (S.tab === "admin" && !S.isAdmin) S.tab = "shop";
    render();
  })();
  try { await loading; } finally { loading = null; }
}
let reloadTimer = null;
const scheduleLoad = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 400); };

(async () => {
  const cfg = window.DVBZ_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { S.offline = true; render(); return; }
  S.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const startTab = location.hash.replace("#", "");
  let channel = null;
  async function onSession(session) {
    const was = S.uid;
    S.session = session; S.uid = session?.user?.id || null;
    if (!session) {
      S.loaded = false; S.isAdmin = false; S.ledger = []; S.orders = []; S.participants = []; S.catalog = []; S.emails = {};
      if (channel) { S.sb.removeChannel(channel); channel = null; }
      render(); return;
    }
    if (was === S.uid && S.loaded) return;
    await S.sb.rpc("link_me");
    if (!channel) channel = S.sb.channel("dvbz").on("postgres_changes", { event: "*", schema: "public" }, scheduleLoad).subscribe();
    S.tab = ["konto", "rangliste", "admin"].includes(startTab) ? startTab : "shop";
    render();
    await load();
    showTab(S.tab);
  }
  S.sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });
  const { data } = await S.sb.auth.getSession();
  await onSession(data.session);
  setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
})();
