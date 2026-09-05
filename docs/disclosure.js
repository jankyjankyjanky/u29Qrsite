const DISCLOSURE_API_URL =
    "https://worker.nazuna-request.workers.dev/api/disclosure-requests";

let disclosureTurnstileWidgetId = null;

function showDisclosureError(message) {
    const error =
        document.getElementById(
            "disclosure_error"
        );

    const success =
        document.getElementById(
            "disclosure_success"
        );

    success.hidden = true;
    error.textContent = message;
    error.hidden = false;
}

function showDisclosureSuccess(message) {
    const success =
        document.getElementById(
            "disclosure_success"
        );

    const error =
        document.getElementById(
            "disclosure_error"
        );

    error.hidden = true;
    success.textContent = message;
    success.hidden = false;
}

function renderDisclosureTurnstile() {
    const siteKey =
        window.NAZUNA_TURNSTILE_SITE_KEY;

    if (
        !siteKey ||
        siteKey === "YOUR_TURNSTILE_SITE_KEY"
    ) {
        showDisclosureError(
            "セキュリティ設定が未完了です。管理者へお問い合わせください。"
        );

        return;
    }

    if (!window.turnstile) {
        setTimeout(
            renderDisclosureTurnstile,
            300
        );

        return;
    }

    if (
        disclosureTurnstileWidgetId !==
        null
    ) {
        return;
    }

    disclosureTurnstileWidgetId =
        window.turnstile.render(
            "#disclosure_turnstile",
            {
                sitekey: siteKey,
                action: "submit_request",
                theme: "auto"
            }
        );
}

window.addEventListener(
    "DOMContentLoaded",
    () => {
        renderDisclosureTurnstile();

        const form =
            document.getElementById(
                "disclosure_form"
            );

        form.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const button =
                    document.getElementById(
                        "disclosure_submit"
                    );

                const token =
                    window.turnstile &&
                    disclosureTurnstileWidgetId !==
                        null
                        ? window.turnstile.getResponse(
                              disclosureTurnstileWidgetId
                          )
                        : "";

                if (!token) {
                    showDisclosureError(
                        "Turnstileの確認を完了してください。"
                    );

                    return;
                }

                button.disabled = true;
                button.textContent =
                    "送信中...";

                try {
                    const response =
                        await fetch(
                            DISCLOSURE_API_URL,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        requesterName:
                                            document
                                                .getElementById(
                                                    "requester_name"
                                                )
                                                .value
                                                .trim(),

                                        email:
                                            document
                                                .getElementById(
                                                    "email"
                                                )
                                                .value
                                                .trim(),

                                        purpose:
                                            document
                                                .getElementById(
                                                    "purpose"
                                                )
                                                .value
                                                .trim(),

                                        website:
                                            document
                                                .getElementById(
                                                    "website"
                                                )
                                                .value,

                                        turnstileToken:
                                            token
                                    })
                            }
                        );

                    const data =
                        await response.json();

                    if (
                        !response.ok ||
                        !data.ok
                    ) {
                        throw new Error(
                            data.error ||
                            "送信できませんでした。"
                        );
                    }

                    form.reset();

                    showDisclosureSuccess(
                        `送信しました。受付番号: ${data.disclosureId}`
                    );
                } catch (error) {
                    showDisclosureError(
                        error.message ||
                        "送信に失敗しました。"
                    );
                } finally {
                    if (
                        window.turnstile &&
                        disclosureTurnstileWidgetId !==
                            null
                    ) {
                        window.turnstile.reset(
                            disclosureTurnstileWidgetId
                        );
                    }

                    button.disabled =
                        false;

                    button.textContent =
                        "開示を請求する";
                }
            }
        );
    }
);
