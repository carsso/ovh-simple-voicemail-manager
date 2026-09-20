// One <audio> element for the whole page: starting a message stops the one
// playing, which is what anyone expects from a voicemail list.

const audio = new Audio();
audio.preload = "none";

let currentId = null;
let listeners = [];

for (const event of ["play", "pause", "ended", "timeupdate", "loadedmetadata", "error", "waiting", "playing"]) {
    audio.addEventListener(event, notify);
}

export function onPlayerChange(fn) {
    listeners.push(fn);
}

export function playerState() {
    return {
        id: currentId,
        playing: currentId !== null && !audio.paused && !audio.ended,
        loading: currentId !== null && audio.readyState < 2 && !audio.paused,
        // The API told us how long the message is, so the progress bar is
        // usable before the file has even started downloading.
        position: currentId === null ? 0 : audio.currentTime,
        duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0,
        error: currentId !== null && audio.error !== null
            ? (audio.error.message || "code " + audio.error.code)
            : null,
    };
}

export function toggle(id, src) {
    if (currentId === id) {
        if (audio.paused) audio.play().catch(notify);
        else audio.pause();
        return;
    }

    currentId = id;
    audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(notify);
    notify();
}

export function stop() {
    audio.pause();
    audio.removeAttribute("src");
    currentId = null;
    notify();
}

// fraction is 0..1 of the message duration.
export function seek(id, fraction) {
    if (currentId !== id || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration;
    notify();
}

function notify() {
    const state = playerState();
    for (const fn of listeners) fn(state);
}
