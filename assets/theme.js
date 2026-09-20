// Theme cycle: system -> light -> dark -> system.
// "system" is the default and tracks the OS setting live; the inline script in
// index.html applies the same choice before first paint.

import { T } from "./i18n.js";

const ICONS = {
    light:
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/>' +
        '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2' +
        'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark:
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/></svg>',
    auto:
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2"><circle cx="12" cy="12" r="9"/>' +
        '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
};

const media = matchMedia("(prefers-color-scheme: light)");

export function initTheme(button) {
    button.addEventListener("click", () => {
        const order = ["auto", "light", "dark"];
        const next = order[(order.indexOf(preference()) + 1) % order.length];
        if (next === "auto") localStorage.removeItem("theme");
        else localStorage.setItem("theme", next);
        apply(button);
    });
    media.addEventListener("change", () => { if (preference() === "auto") apply(button); });
    apply(button);
}

function preference() {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "auto";
}

function apply(button) {
    const pref = preference();
    document.documentElement.dataset.theme =
        pref === "auto" ? (media.matches ? "light" : "dark") : pref;

    button.innerHTML = ICONS[pref];
    button.title = pref === "auto" ? T.themeAuto : pref === "light" ? T.themeLight : T.themeDark;
    button.setAttribute("aria-label", button.title);
}
