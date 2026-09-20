// UI strings. The language follows the browser: French for fr-*, English
// otherwise. Static markup is translated through data-i18n* attributes.

const STRINGS = {
    en: {
        appTitle: "Voicemail",
        filterInbox: "Inbox",
        filterArchived: "Archive",
        filterAria: "Filter messages",
        refresh: "Refresh",
        refreshTitle: "Reload messages now (r)",
        themeAuto: "Theme: follows the system",
        themeLight: "Theme: light",
        themeDark: "Theme: dark",
        linesAria: "Pick a line",
        messages: (n) => (n > 1 ? "messages" : "message"),
        unread: "unread",
        // The API only reports how many messages are unread, never which ones.
        unreadTitle: "Unread messages as the phone reports them — the API never says which ones",
        archivedCount: (n) => "archived",
        totalTime: "total",
        empty: "No voicemail found on this account.",
        emptyLine: "No message on this line.",
        noMatchInbox: "The inbox is empty — everything has been archived.",
        noMatchArchive: "Nothing archived yet.",
        unknownCaller: "Unknown caller",
        anonymousCaller: "Anonymous",
        play: "Play",
        pause: "Pause",
        download: "Download",
        deleteMsg: "Delete",
        archive: "Archive",
        unarchive: "Put back in the inbox",
        transcript: "Transcript",
        transcriptLoading: "Transcribing…",
        transcriptEmpty: "No transcript available for this message.",
        transcriptFailed: (msg) => "Transcript unavailable: " + msg,
        confirmDelete: "Delete this message for good?",
        today: "Today",
        yesterday: "Yesterday",
        ago: (n, unit) => n + unit + " ago",
        justNow: "just now",
        loadFailed: (msg) => "Cannot load the lines: " + msg,
        messagesFailed: (msg) => "Cannot load the messages: " + msg,
        actionFailed: (msg) => "Action failed: " + msg,
        playFailed: (msg) => "Cannot play this message: " + msg,
        scriptError: (msg) => "Script error: " + msg,
    },
    fr: {
        appTitle: "Répondeur",
        filterInbox: "Boîte",
        filterArchived: "Archives",
        filterAria: "Filtrer les messages",
        refresh: "Actualiser",
        refreshTitle: "Recharger les messages (r)",
        themeAuto: "Thème : suit le système",
        themeLight: "Thème : clair",
        themeDark: "Thème : sombre",
        linesAria: "Choisir une ligne",
        messages: (n) => (n > 1 ? "messages" : "message"),
        unread: "non lus",
        unreadTitle: "Messages non lus tels que les compte le répondeur — l'API ne dit jamais lesquels",
        archivedCount: (n) => (n > 1 ? "archivés" : "archivé"),
        totalTime: "au total",
        empty: "Aucun répondeur trouvé sur ce compte.",
        emptyLine: "Aucun message sur cette ligne.",
        noMatchInbox: "La boîte est vide — tout est archivé.",
        noMatchArchive: "Rien d'archivé pour l'instant.",
        unknownCaller: "Appelant inconnu",
        anonymousCaller: "Anonyme",
        play: "Écouter",
        pause: "Pause",
        download: "Télécharger",
        deleteMsg: "Supprimer",
        archive: "Archiver",
        unarchive: "Remettre dans la boîte",
        transcript: "Transcription",
        transcriptLoading: "Transcription en cours…",
        transcriptEmpty: "Pas de transcription pour ce message.",
        transcriptFailed: (msg) => "Transcription indisponible : " + msg,
        confirmDelete: "Supprimer définitivement ce message ?",
        today: "Aujourd'hui",
        yesterday: "Hier",
        ago: (n, unit) => "il y a " + n + " " + unit,
        justNow: "à l'instant",
        loadFailed: (msg) => "Impossible de charger les lignes : " + msg,
        messagesFailed: (msg) => "Impossible de charger les messages : " + msg,
        actionFailed: (msg) => "Action impossible : " + msg,
        playFailed: (msg) => "Lecture impossible : " + msg,
        scriptError: (msg) => "Erreur de script : " + msg,
    },
};

// Guarded so the pure modules can also be imported outside a browser (tests).
const browserLang = globalThis.navigator?.language || "en";

export const LANG = browserLang.toLowerCase().startsWith("fr") ? "fr" : "en";
export const T = STRINGS[LANG];

export function applyStaticStrings() {
    document.documentElement.lang = LANG;
    document.title = T.appTitle;

    for (const el of document.querySelectorAll("[data-i18n]")) {
        el.textContent = T[el.dataset.i18n];
    }
    for (const el of document.querySelectorAll("[data-i18n-title]")) {
        el.title = T[el.dataset.i18nTitle];
    }
    for (const el of document.querySelectorAll("[data-i18n-aria]")) {
        el.setAttribute("aria-label", T[el.dataset.i18nAria]);
    }
}
