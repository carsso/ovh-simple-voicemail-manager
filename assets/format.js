// Turning API values into something a human wants to read.
// Pure functions only — no DOM — so they can be unit-tested outside a browser.

import { LANG, T } from "./i18n.js";

// Callers who withheld their number come back as "anonymous" (or empty).
const WITHHELD = /^(anonymous|unknown|restricted|private|unavailable)$/i;

// "+33612345678" -> "06 12 34 56 78", "0049301234567" -> "+49 30 12 34 56 7"
export function phone(raw) {
    const s = String(raw ?? "").trim();
    if (s === "") return null;
    if (WITHHELD.test(s)) return null;

    const n = s.replace(/[\s.\-()]/g, "").replace(/^00/, "+");

    // French numbers are read in their national form, which is how anyone
    // here would write them down.
    if (/^\+33\d{9}$/.test(n)) return pairs("0" + n.slice(3));

    // Anywhere else, group the digits without pretending to know where the
    // country code ends: +49 30… and +493 0… are indistinguishable without a
    // lookup table, and a wrong split reads worse than none.
    if (/^\+\d{6,}$/.test(n)) return "+" + pairs(n.slice(1));

    return s;
}

export function callerLabel(raw) {
    const s = String(raw ?? "").trim();
    if (s !== "" && WITHHELD.test(s)) return T.anonymousCaller;

    return phone(s) ?? T.unknownCaller;
}

// 42 -> "0:42", 725 -> "12:05", 3723 -> "1:02:03"
export function duration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const s = total % 60;
    const m = Math.floor(total / 60) % 60;
    const h = Math.floor(total / 3600);

    return h > 0
        ? `${h}:${pad(m)}:${pad(s)}`
        : `${m}:${pad(s)}`;
}

// "Today 14:32", "Yesterday 09:12", "12 Mar 09:12", "12 Mar 2024 09:12"
export function dateLabel(ts, now = new Date()) {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    const time = fmt({ hour: "2-digit", minute: "2-digit" }).format(d);
    const days = dayDiff(d, now);

    if (days === 0) return `${T.today} ${time}`;
    if (days === 1) return `${T.yesterday} ${time}`;

    const opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";

    return `${fmt(opts).format(d)} ${time}`;
}

export function ago(ts, now = Date.now()) {
    if (!ts) return "";
    const s = Math.max(0, Math.floor(now / 1000) - ts);

    if (s < 60) return T.justNow;
    if (s < 3600) return T.ago(Math.floor(s / 60), "min");
    if (s < 86400) return T.ago(Math.floor(s / 3600), "h");

    return T.ago(Math.floor(s / 86400), LANG === "fr" ? "j" : "d");
}

export function esc(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------------

function pairs(digits) {
    return (String(digits).match(/\d{1,2}/g) || []).join(" ");
}

function pad(n) {
    return String(n).padStart(2, "0");
}

// Calendar days apart, not 24h slices: a message left at 23:50 is "yesterday"
// at 00:10, not "20 minutes ago... today".
function dayDiff(a, b) {
    const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((midnight(b) - midnight(a)) / 86400000);
}

function fmt(options) {
    return new Intl.DateTimeFormat(LANG, options);
}
