// Entry point: loads the lines from api.php, the messages of the selected line
// from messages.php, and wires the row actions to the PHP endpoints.

import { T, applyStaticStrings } from "./i18n.js";
import { initTheme } from "./theme.js";
import { createRow, updateRow } from "./message.js";
import { onPlayerChange, playerState, seek, stop, toggle } from "./player.js";
import { duration, esc } from "./format.js";

const REFRESH_MS = 60_000;

const linesEl    = document.getElementById("lines");
const listEl     = document.getElementById("messages");
const summaryEl  = document.getElementById("summary");
const bannerEl   = document.getElementById("banner");
const emptyEl    = document.getElementById("empty");
const noMatchEl  = document.getElementById("no-match");
const refreshBtn = document.getElementById("refresh");
const themeBtn   = document.getElementById("theme");
const progressEl = document.getElementById("refresh-progress");

let lines      = [];   // flattened: one entry per voicemail
let current    = null; // the selected entry
let messages   = [];
let filter     = "inbox";
let loading    = false;
let nextLoadAt = 0;

const views = new Map(); // message id -> row view

init();

async function init() {
    // A silent script error would leave nothing but an empty list on screen.
    window.addEventListener("error", (e) => banner(T.scriptError(e.message)));

    applyStaticStrings();
    initTheme(themeBtn);

    refreshBtn.addEventListener("click", () => loadMessages(true));

    for (const btn of document.querySelectorAll(".seg")) {
        btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "r" && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) loadMessages(true);
    });

    window.addEventListener("hashchange", () => selectFromHash());

    // Don't keep polling for a tab nobody is looking at.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && Date.now() > nextLoadAt) loadMessages(false);
    });

    onPlayerChange(renderPlayer);

    await loadLines();

    setInterval(() => { if (!document.hidden && Date.now() > nextLoadAt) loadMessages(false); }, 1000);
    setInterval(tick, 1000);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadLines() {
    let payload;
    try {
        payload = await getJson("api.php");
    } catch (err) {
        banner(T.loadFailed(err.message));
        return;
    }

    lines = [];
    for (const account of payload.lines || []) {
        for (const vm of account.voicemails || []) {
            lines.push({
                billingAccount: account.billingAccount,
                account: account.description,
                serviceName: vm.serviceName,
                description: vm.description,
                unread: vm.unread,
            });
        }
    }

    emptyEl.hidden = lines.length > 0;
    buildLineTabs();
    selectFromHash();
}

async function loadMessages(force) {
    if (current === null || loading) return;

    loading = true;
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-busy");
    nextLoadAt = Date.now() + REFRESH_MS;

    const line = current;
    const url = "messages.php?" + params({
        account: line.billingAccount,
        voicemail: line.serviceName,
        force: force ? "1" : "",
    });

    try {
        const payload = await getJson(url);
        // The user may have switched lines while this was in flight.
        if (current !== line) return;
        messages = payload.messages || [];
        banner(null);
        render();
        buildLineTabs();
    } catch (err) {
        banner(T.messagesFailed(err.message));
    } finally {
        loading = false;
        refreshBtn.disabled = false;
        refreshBtn.classList.remove("is-busy");
        nextLoadAt = Date.now() + REFRESH_MS;
    }
}

// ---------------------------------------------------------------------------
// Line selection
// ---------------------------------------------------------------------------

function buildLineTabs() {
    linesEl.hidden = lines.length < 2;
    linesEl.textContent = "";

    for (const line of lines) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "line-tab";
        btn.classList.toggle("is-active", line === current);
        btn.innerHTML =
            `<span class="line-name">${esc(lineLabel(line))}</span>` +
            (line.unread > 0 ? `<span class="pill">${line.unread}</span>` : "");
        btn.addEventListener("click", () => {
            location.hash = hashOf(line);
        });
        linesEl.appendChild(btn);
    }
}

function selectFromHash() {
    const wanted = decodeURIComponent(location.hash.replace(/^#/, ""));
    const line = lines.find((l) => hashOf(l) === wanted) || lines[0] || null;

    if (line === current) return;

    current = line;
    messages = [];
    views.clear();
    listEl.textContent = "";
    stop();

    if (current === null) return;

    document.getElementById("line-title").textContent = lineLabel(current);
    buildLineTabs();
    loadMessages(false);
}

function lineLabel(line) {
    return line.description || line.serviceName;
}

function hashOf(line) {
    return `${line.billingAccount}/${line.serviceName}`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
    const seen = new Set();

    for (const message of messages) {
        seen.add(message.id);
        let view = views.get(message.id);
        if (!view) {
            view = createRow(message, handlers);
            views.set(message.id, view);
        } else {
            updateRow(view, message, playerFor(message.id));
        }
        listEl.appendChild(view.el);
    }

    for (const [id, view] of views) {
        if (!seen.has(id)) {
            view.el.remove();
            views.delete(id);
        }
    }

    applyFilter();
    updateSummary();
}

function applyFilter() {
    let shown = 0;
    for (const message of messages) {
        const view = views.get(message.id);
        if (!view) continue;
        const keep = filter === "archived" ? message.archived : !message.archived;
        view.el.hidden = !keep;
        if (keep) shown++;
    }

    noMatchEl.textContent = filter === "archived" ? T.noMatchArchive : T.noMatchInbox;
    noMatchEl.hidden = shown > 0 || messages.length === 0;
    emptyEl.hidden = !(lines.length === 0 || (current !== null && messages.length === 0));
    emptyEl.textContent = lines.length === 0 ? T.empty : T.emptyLine;
}

function updateSummary() {
    const unread = current?.unread ?? 0;
    const archived = messages.filter((m) => m.archived).length;
    const total = messages.reduce((sum, m) => sum + m.duration, 0);

    const chips = [`<span class="stat"><b>${messages.length}</b> ${T.messages(messages.length)}</span>`];
    if (unread > 0) {
        chips.push(`<span class="stat is-new" title="${esc(T.unreadTitle)}">` +
                   `<i class="dot"></i><b>${unread}</b> ${T.unread}</span>`);
    }
    if (archived > 0) chips.push(`<span class="stat"><b>${archived}</b> ${T.archivedCount(archived)}</span>`);
    if (total > 0) chips.push(`<span class="stat"><b>${duration(total)}</b> ${T.totalTime}</span>`);
    summaryEl.innerHTML = chips.join("");

    document.title = unread > 0 ? `(${unread}) ${T.appTitle}` : T.appTitle;
}

// Only the row that owns the player needs repainting on every timeupdate.
function renderPlayer(state) {
    for (const [id, view] of views) {
        updateRow(view, view.message, id === state.id ? state : null);
    }
    if (state.error) banner(T.playFailed(state.error));
}

function playerFor(id) {
    const state = playerState();
    return state.id === id ? state : null;
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

const handlers = {
    audioUrl: (id, download = false) => "audio.php?" + params({
        account: current.billingAccount,
        voicemail: current.serviceName,
        id,
        download: download ? "1" : "",
    }),

    onToggle(message) {
        toggle(message.id, handlers.audioUrl(message.id));
    },

    onSeek(message, fraction) {
        seek(message.id, fraction);
    },

    onArchive(message) {
        setArchived(message, !message.archived);
    },

    async onTranscript(message, view) {
        const el = view.transcript;
        if (!el.hidden) {
            el.hidden = true;
            return;
        }

        el.hidden = false;
        if (el.dataset.loaded === "1") return;

        el.textContent = T.transcriptLoading;
        try {
            const payload = await getJson("transcript.php?" + params({
                account: current.billingAccount,
                voicemail: current.serviceName,
                id: message.id,
            }));
            el.textContent = payload.text || T.transcriptEmpty;
            el.dataset.loaded = "1";
        } catch (err) {
            el.textContent = T.transcriptFailed(err.message);
        }
    },

    async onDelete(message) {
        if (!confirm(T.confirmDelete)) return;

        const view = views.get(message.id);
        view?.el.classList.add("is-busy");

        try {
            await postJson("delete.php", {
                account: current.billingAccount,
                voicemail: current.serviceName,
                id: message.id,
            });
        } catch (err) {
            view?.el.classList.remove("is-busy");
            banner(T.actionFailed(err.message));
            return;
        }

        messages = messages.filter((m) => m.id !== message.id);
        render();
    },
};

// Optimistic: the row moves now and rolls back if the API disagrees.
async function setArchived(message, archived) {
    message.archived = archived;
    updateRow(views.get(message.id), message, playerFor(message.id));
    applyFilter();
    updateSummary();

    try {
        await postJson("move.php", {
            account: current.billingAccount,
            voicemail: current.serviceName,
            id: message.id,
            dir: archived ? "old" : "inbox",
        });
    } catch (err) {
        message.archived = !archived;
        updateRow(views.get(message.id), message, playerFor(message.id));
        applyFilter();
        updateSummary();
        banner(T.actionFailed(err.message));
    }
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function setFilter(next) {
    filter = next;
    for (const btn of document.querySelectorAll(".seg")) {
        btn.classList.toggle("is-active", btn.dataset.filter === next);
    }
    applyFilter();
}

function tick() {
    const left = Math.max(0, nextLoadAt - Date.now());
    progressEl.style.width = (100 - (left / REFRESH_MS) * 100).toFixed(1) + "%";
}

async function getJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    return unwrap(res);
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params(body),
    });
    return unwrap(res);
}

// PHP endpoints answer {error: "..."} with a real status code; surface the
// message rather than "HTTP 502".
async function unwrap(res) {
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || "HTTP " + res.status);
    return payload ?? {};
}

function params(obj) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(obj)) {
        if (value !== "" && value !== null && value !== undefined) q.set(key, String(value));
    }
    return q.toString();
}

function banner(msg) {
    bannerEl.textContent = msg ?? "";
    bannerEl.hidden = !msg;
}

function isTyping(el) {
    return el && /^(input|textarea|select)$/i.test(el.tagName);
}
