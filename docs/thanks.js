const LAST_SUBMISSION_KEY = "nazuna_last_submission";

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id");

    let saved = null;

    try {
        const raw = localStorage.getItem(LAST_SUBMISSION_KEY);
        saved = raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error(error);
    }

    const requestId = queryId || saved?.requestId || "―";

    document.getElementById("request_id").textContent = requestId;

    const note = document.getElementById("discord_note");

    if (saved?.discordNotified) {
        note.hidden = false;
    }
});
