import assert from "node:assert/strict";
import test from "node:test";

import { LANG, T } from "../../assets/i18n.js";
import { ago, callerLabel, dateLabel, duration, esc, phone } from "../../assets/format.js";

test("French numbers are shown the way they are written here", () => {
    assert.equal(phone("+33612345678"), "06 12 34 56 78");
    assert.equal(phone("0033612345678"), "06 12 34 56 78");
    assert.equal(phone("+33 6 12 34 56 78"), "06 12 34 56 78");
    assert.equal(phone("+33123456789"), "01 23 45 67 89");
});

test("other countries keep their + and are only grouped", () => {
    // Splitting the country code would need a lookup table: +49 30… and
    // +493 0… are indistinguishable without one.
    assert.equal(phone("0049301234567"), "+49 30 12 34 56 7");
});

test("withheld and missing numbers have no digits to show", () => {
    assert.equal(phone("anonymous"), null);
    assert.equal(phone("ANONYMOUS"), null);
    assert.equal(phone(""), null);
    assert.equal(phone(null), null);
    assert.equal(phone(undefined), null);
});

test("anything unexpected is shown as-is rather than mangled", () => {
    assert.equal(phone("12345"), "12345");
    assert.equal(phone("SIP/trunk-1"), "SIP/trunk-1");
});

test("caller labels distinguish a hidden number from no number at all", () => {
    assert.equal(callerLabel("anonymous"), T.anonymousCaller);
    assert.equal(callerLabel(""), T.unknownCaller);
    assert.equal(callerLabel("+33612345678"), "06 12 34 56 78");
});

test("durations read like a player", () => {
    assert.equal(duration(0), "0:00");
    assert.equal(duration(9), "0:09");
    assert.equal(duration(42), "0:42");
    assert.equal(duration(725), "12:05");
    assert.equal(duration(3723), "1:02:03");
    assert.equal(duration(-5), "0:00");
    assert.equal(duration(undefined), "0:00");
});

test("dates are relative for the last two days", () => {
    const now = new Date("2026-03-14T09:00:00");
    const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);

    assert.match(dateLabel(at("2026-03-14T08:12:00"), now), new RegExp("^" + T.today + " "));
    assert.match(dateLabel(at("2026-03-13T23:50:00"), now), new RegExp("^" + T.yesterday + " "));
    assert.doesNotMatch(dateLabel(at("2026-03-01T10:00:00"), now), new RegExp(T.today));
    assert.equal(dateLabel(0), "—");
});

test("a message left late last night is yesterday, not 20 minutes ago", () => {
    const now = new Date("2026-03-14T00:10:00");
    const lastNight = Math.floor(new Date("2026-03-13T23:50:00").getTime() / 1000);

    assert.match(dateLabel(lastNight, now), new RegExp("^" + T.yesterday + " "));
});

test("old messages carry their year", () => {
    const now = new Date("2026-03-14T09:00:00");
    const old = Math.floor(new Date("2024-03-14T09:00:00").getTime() / 1000);

    assert.match(dateLabel(old, now), /2024/);
});

test("relative ages round down to the coarsest unit", () => {
    const now = Date.UTC(2026, 2, 14, 12, 0, 0);
    const at = (seconds) => Math.floor(now / 1000) - seconds;

    assert.equal(ago(at(5), now), T.justNow);
    assert.equal(ago(at(3600), now), T.ago(1, "h"));
    assert.equal(ago(at(90 * 60), now), T.ago(1, "h"));
    assert.equal(ago(at(3 * 86400), now), T.ago(3, LANG === "fr" ? "j" : "d"));
    assert.equal(ago(0, now), "");
});

test("escaping covers every character that could close an attribute", () => {
    assert.equal(esc(`<a href="x" title='y'>&</a>`),
        "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
    assert.equal(esc(null), "");
});
