// One message row: built once, then patched in place so playing a message
// doesn't rebuild the list under the cursor.

import { T } from "./i18n.js";
import { ago, callerLabel, dateLabel, duration, esc } from "./format.js";

const ICON = {
    play:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>',
    pause:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
        '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    archive:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="4" rx="1"/>' +
        '<path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
    unarchive:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="4" rx="1"/>' +
        '<path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M12 17v-5"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/></svg>',
    transcript:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    download:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>',
    trash:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
        '<path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/><path d="M10 11v6M14 11v6"/></svg>',
};

// handlers: { onToggle, onSeek, onRead, onTranscript, onDelete, audioUrl }
export function createRow(message, handlers) {
    const el = document.createElement("li");
    el.className = "msg";
    el.dataset.id = String(message.id);

    el.innerHTML = `
        <button class="play" type="button" aria-label="${esc(T.play)}" title="${esc(T.play)}">${ICON.play}</button>
        <div class="body">
            <div class="head">
                <span class="caller">${esc(callerLabel(message.caller))}</span>
            </div>
            <div class="meta">
                <time class="when"></time>
                <span class="sep" aria-hidden="true">·</span>
                <span class="elapsed"></span>
            </div>
            <div class="track" role="slider" tabindex="0" aria-label="${esc(T.play)}"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="track-fill"></div>
            </div>
            <p class="transcript" hidden></p>
        </div>
        <div class="row-actions">
            <button class="icon-btn archive" type="button"></button>
            <button class="icon-btn transcript-btn" type="button"
                    title="${esc(T.transcript)}" aria-label="${esc(T.transcript)}">${ICON.transcript}</button>
            <a class="icon-btn" download title="${esc(T.download)}" aria-label="${esc(T.download)}">${ICON.download}</a>
            <button class="icon-btn danger delete" type="button"
                    title="${esc(T.deleteMsg)}" aria-label="${esc(T.deleteMsg)}">${ICON.trash}</button>
        </div>`;

    const view = {
        el,
        message,
        play:       el.querySelector(".play"),
        caller:     el.querySelector(".caller"),
        when:       el.querySelector(".when"),
        elapsed:    el.querySelector(".elapsed"),
        track:      el.querySelector(".track"),
        fill:       el.querySelector(".track-fill"),
        archive:    el.querySelector(".archive"),
        transcript: el.querySelector(".transcript"),
    };

    el.querySelector("a.icon-btn").href = handlers.audioUrl(message.id, true);

    view.play.addEventListener("click", () => handlers.onToggle(message));
    view.archive.addEventListener("click", () => handlers.onArchive(message));
    el.querySelector(".transcript-btn").addEventListener("click", () => handlers.onTranscript(message, view));
    el.querySelector(".delete").addEventListener("click", () => handlers.onDelete(message));

    view.track.addEventListener("click", (e) => {
        const box = view.track.getBoundingClientRect();
        handlers.onSeek(message, (e.clientX - box.left) / box.width);
    });
    view.track.addEventListener("keydown", (e) => {
        const step = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        handlers.onSeek(message, progressOf(view) + step);
    });

    updateRow(view, message, null);

    return view;
}

// `player` is the shared player state, or null when this row isn't the one
// playing.
export function updateRow(view, message, player) {
    view.message = message;

    view.caller.textContent = callerLabel(message.caller);
    view.when.textContent = dateLabel(message.ts);
    view.when.dateTime = message.at ?? "";
    view.when.title = ago(message.ts);

    view.archive.innerHTML = message.archived ? ICON.unarchive : ICON.archive;
    view.archive.title = message.archived ? T.unarchive : T.archive;
    view.archive.setAttribute("aria-label", view.archive.title);

    const active = player !== null;
    const total = active && player.duration > 0 ? player.duration : message.duration;
    const position = active ? player.position : 0;

    view.el.classList.toggle("is-active", active);
    view.el.classList.toggle("is-loading", active && player.loading);
    view.play.innerHTML = active && player.playing ? ICON.pause : ICON.play;
    view.play.title = active && player.playing ? T.pause : T.play;
    view.play.setAttribute("aria-label", view.play.title);

    view.elapsed.textContent = active && position > 0
        ? `${duration(position)} / ${duration(total)}`
        : duration(message.duration);

    const ratio = total > 0 ? Math.min(1, position / total) : 0;
    view.fill.style.width = (ratio * 100).toFixed(1) + "%";
    view.track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
}

function progressOf(view) {
    return (parseFloat(view.fill.style.width) || 0) / 100;
}
