// ============================================================
// u29Qr ご依頼フォーム
// request.js v5
// ============================================================

const ESTIMATE_STORAGE_KEY = "u29qr_current_estimate";
const REQUEST_DRAFT_KEY = "u29qr_request_draft";
const LAST_SUBMISSION_KEY = "u29qr_last_submission";
let confirmedRequestData = null;

window.addEventListener("DOMContentLoaded", () => {
    const savedEstimate = loadEstimate();

    restoreEstimateIntoEditor(savedEstimate);
    setupContactMethod();
    restoreDraft();
    setupEditorSync();
    setupForm();
    setupFinalSubmit();
});

function loadEstimate() {
    try {
        const raw = localStorage.getItem(ESTIMATE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error("見積り情報の読み込みに失敗しました。", error);
        return null;
    }
}

function restoreEstimateIntoEditor(estimate) {
    if (!estimate) {
        switchTab();
        calcTotal();
        return;
    }

    const tab = document.querySelector(
        `input[name="main_tab"][value="${CSS.escape(estimate.tab || "mix")}"]`
    );

    if (tab) {
        tab.checked = true;
    }

    // v7以降の見積りは、選択内容をそのまま復元
    if (Array.isArray(estimate.formState)) {
        restoreEstimatorState(estimate.formState);
    } else {
        // 旧バージョンから来た場合でも割引だけは引き継ぐ
        if (estimate.discount) {
            const student = document.getElementById("chk_student");
            const first = document.getElementById("chk_first");

            if (student) student.checked = Boolean(estimate.discount.student);
            if (first) first.checked = Boolean(estimate.discount.first);
        }

        if (estimate.tab === "set" && estimate.set?.planKey) {
            const plan = document.querySelector(
                `input[name="set_plan"][value="${CSS.escape(estimate.set.planKey)}"]`
            );

            if (plan) {
                plan.checked = true;
            }
        }
    }

    switchTab();

    if (estimate.tab === "set") {
        updateSetPanels();
    }

    // イラスト表示を復元
    ["main", "set"].forEach(prefix => {
        const eshi = document.querySelector(
            `input[name="eshi_${prefix}"][value="2"]`
        );

        if (eshi?.checked) {
            updateIllust(prefix);
        }
    });

    updatePriceTags();
    calcTotal();
}

function setupEditorSync() {
    document.addEventListener("change", event => {
        if (event.target.closest(".request-section")) {
            clearEstimateValidationErrors();
            saveCurrentEstimate();
        }
    });

    document.addEventListener("input", event => {
        if (event.target.closest(".request-section")) {
            clearEstimateValidationErrors();
            saveCurrentEstimate();
        }
    });
}

function saveCurrentEstimate() {
    if (typeof getCurrentEstimateData !== "function") return;

    const estimate = getCurrentEstimateData();

    localStorage.setItem(
        ESTIMATE_STORAGE_KEY,
        JSON.stringify(estimate)
    );
}


// ============================================================
// 依頼内容の必須チェック
// 「オプション」は未選択でもOK
// ============================================================

function clearEstimateValidationErrors() {
    document.querySelectorAll(".estimate-field-error").forEach(element => {
        element.classList.remove("estimate-field-error");
    });

    const message = document.getElementById("estimate_required_error");

    if (message) {
        message.hidden = true;
        message.innerHTML = "";
    }
}

function markEstimateError(element) {
    const field = element?.closest(".field") || element?.closest(".illust-sub-form");

    if (field) {
        field.classList.add("estimate-field-error");
    }
}

function validateRequiredEstimate() {
    clearEstimateValidationErrors();

    const missing = [];
    let firstElement = null;

    const addMissing = (label, element) => {
        missing.push(label);
        markEstimateError(element);

        if (!firstElement && element) {
            firstElement = element;
        }
    };

    const requireRadio = (name, label) => {
        const checked = document.querySelector(`input[name="${name}"]:checked`);

        if (!checked) {
            addMissing(label, document.querySelector(`input[name="${name}"]`));
            return false;
        }

        return true;
    };

    const requireNumber = (id, label, minimum = null) => {
        const element = document.getElementById(id);

        if (!element) return true;

        const raw = element.value.trim();
        const value = Number(raw);

        const invalid =
            raw === "" ||
            Number.isNaN(value) ||
            (minimum !== null && value < minimum);

        if (invalid) {
            addMissing(label, element);
            return false;
        }

        return true;
    };

    const requireIllustration = (prefix, labelPrefix = "イラスト") => {
        const artistOk = requireRadio(`eshi_${prefix}`, `${labelPrefix}：絵師`);

        if (!artistOk) {
            return;
        }

        const selectedArtist =
            document.querySelector(`input[name="eshi_${prefix}"]:checked`);

        // 現状は絵師2の詳細選択を使用
        if (selectedArtist?.value === "2") {
            const styleOk =
                requireRadio(`style_${prefix}`, `${labelPrefix}：絵柄`);

            if (styleOk) {
                requireRadio(`range_${prefix}`, `${labelPrefix}：立ち絵範囲`);
            }
        }
    };

    const currentTab = getCurrentTab();

    if (currentTab === "mix") {
        requireNumber("mix_users", "MIX：人数", 1);
        requireRadio("mix_base", "MIX：基本料金");
        requireRadio("mix_harm", "MIX：ハモリ");
    }

    if (currentTab === "mv") {
        requireRadio("mv_length", "MV：動画尺");
        requireRadio("mv_config", "MV：MV構成");
    }

    if (currentTab === "movie") {
        requireNumber("movie_min", "動画編集：動画尺", 0);
        requireNumber("movie_mat", "動画編集：動画の素材数", 1);
        requireRadio("movie_cut", "動画編集：動画のカット");
    }

    if (currentTab === "illust") {
        requireIllustration("main", "イラスト");
    }

    if (currentTab === "set") {
        const planSelected = requireRadio("set_plan", "セット：セット種類");

        if (planSelected) {
            const planKey =
                document.querySelector('input[name="set_plan"]:checked')?.value;

            const components = SET_INFO[planKey]?.components || [];

            if (components.includes("mix")) {
                requireNumber("set_mix_users", "セット内MIX：人数", 1);
                requireRadio("set_mix_base", "セット内MIX：基本料金");
                requireRadio("set_mix_harm", "セット内MIX：ハモリ");
            }

            if (components.includes("mv")) {
                requireRadio("set_mv_length", "セット内MV：動画尺");
                requireRadio("set_mv_config", "セット内MV：MV構成");
            }

            if (components.includes("movie")) {
                requireNumber("set_movie_min", "セット内動画編集：動画尺", 0);
                requireNumber("set_movie_mat", "セット内動画編集：動画の素材数", 1);
                requireRadio("set_movie_cut", "セット内動画編集：動画のカット");
            }

            if (components.includes("illust")) {
                requireIllustration("set", "セット内イラスト");
            }
        }
    }

    if (missing.length === 0) {
        return true;
    }

    const message = document.getElementById("estimate_required_error");

    if (message) {
        message.hidden = false;
        message.innerHTML =
            `<strong>未選択の必須項目があります。</strong>` +
            `<ul>${missing.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

        message.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    } else if (firstElement) {
        firstElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    return false;
}


function setupContactMethod() {
    const select = document.getElementById("contact_method");
    const input = document.getElementById("contact_value");
    const help = document.getElementById("contact_help");

    const settings = {
        discord: {
            placeholder: "Discordのユーザー名",
            help: "Discordのユーザー名を入力してください。"
        },
        x: {
            placeholder: "@username",
            help: "XのユーザーID（@から始まるもの）を入力してください。"
        },
        email: {
            placeholder: "example@example.com",
            help: "連絡を受け取れるメールアドレスを入力してください。"
        },
        other: {
            placeholder: "連絡方法と連絡先",
            help: "連絡可能なサービス名とIDなどを入力してください。"
        }
    };

    const update = () => {
        const setting = settings[select.value] || settings.other;

        input.placeholder = setting.placeholder;
        help.textContent = setting.help;
        input.type = select.value === "email" ? "email" : "text";
    };

    select.addEventListener("change", update);
    update();
}

function setupForm() {
    const form = document.getElementById("request_form");

    form.addEventListener("input", saveDraft);
    form.addEventListener("change", saveDraft);

    form.addEventListener("submit", event => {
        event.preventDefault();

        if (!validateRequiredEstimate()) {
            return;
        }

        if (!form.reportValidity()) {
            return;
        }

        const estimate = getCurrentEstimateData();

        if (estimate.tab === "set" && estimate.set && !estimate.set.meetsMinimum) {
            alert("現在のセット内容は最低注文額を満たしていません。内容を変更してから確認してください。");
            return;
        }

        const requestData = buildRequestData(estimate);
        confirmedRequestData = requestData;

        localStorage.setItem(
            REQUEST_DRAFT_KEY,
            JSON.stringify(requestData)
        );

        localStorage.setItem(
            ESTIMATE_STORAGE_KEY,
            JSON.stringify(estimate)
        );

        renderPreview(requestData);

        const preview = document.getElementById("request_preview");
        preview.hidden = false;
        preview.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("edit_request").addEventListener("click", () => {
        confirmedRequestData = null;
        document.getElementById("request_preview").hidden = true;

        document.querySelector(".request-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

function buildRequestData(estimate) {
    return {
        version: 2,
        createdAt: new Date().toISOString(),
        estimate,
        applicant: {
            activityName: document.getElementById("activity_name").value.trim(),
            contactMethod: document.getElementById("contact_method").value,
            contactValue: document.getElementById("contact_value").value.trim(),
            deadline: document.getElementById("deadline").value,
            publicDate: document.getElementById("public_date").value,
            materialsUrl: document.getElementById("materials_url").value.trim(),
            referenceUrl: document.getElementById("reference_url").value.trim(),
            notes: document.getElementById("notes").value.trim()
        },
        antiSpam: {
            website: document.getElementById("website")?.value.trim() || ""
        }
    };
}

function saveDraft() {
    try {
        const estimate = getCurrentEstimateData();
        const requestData = buildRequestData(estimate);
        confirmedRequestData = requestData;

        localStorage.setItem(
            REQUEST_DRAFT_KEY,
            JSON.stringify(requestData)
        );
    } catch (error) {
        console.error("下書き保存に失敗しました。", error);
    }
}

function restoreDraft() {
    try {
        const raw = localStorage.getItem(REQUEST_DRAFT_KEY);
        if (!raw) return;

        const draft = JSON.parse(raw);
        const applicant = draft?.applicant;

        if (!applicant) return;

        setValue("activity_name", applicant.activityName);
        setValue("contact_method", applicant.contactMethod || "discord");
        setValue("contact_value", applicant.contactValue);
        setValue("deadline", applicant.deadline);
        setValue("public_date", applicant.publicDate);
        setValue("materials_url", applicant.materialsUrl);
        setValue("reference_url", applicant.referenceUrl);
        setValue("notes", applicant.notes);

        document.getElementById("contact_method")
            ?.dispatchEvent(new Event("change"));
    } catch (error) {
        console.error("依頼フォームの下書き復元に失敗しました。", error);
    }
}

function setValue(id, value) {
    const element = document.getElementById(id);

    if (element && value != null) {
        element.value = value;
    }
}


function setupFinalSubmit() {
    const button = document.getElementById("final_submit");
    if (!button) return;

    button.addEventListener("click", async () => {
        const status = document.getElementById("submit_status");

        if (!confirmedRequestData) {
            setSubmitStatus(
                "error",
                "送信前に「入力内容を確認する」を押して、依頼内容を確認してください。"
            );
            return;
        }

        if (typeof window.u29SubmitRequest !== "function") {
            setSubmitStatus(
                "error",
                "Firebaseの設定がまだ完了していません。firebase-config.js を設定してください。"
            );
            return;
        }

        button.disabled = true;
        button.textContent = "送信中...";
        setSubmitStatus("loading", "依頼を送信しています。");

        try {
            const result = await window.u29SubmitRequest(confirmedRequestData);

            const submission = {
                requestId: result.requestId,
                savedAt: result.savedAt || new Date().toISOString(),
                discordNotified: Boolean(result.discordNotified)
            };

            localStorage.setItem(
                LAST_SUBMISSION_KEY,
                JSON.stringify(submission)
            );

            // 送信済みの下書きを消す
            localStorage.removeItem(REQUEST_DRAFT_KEY);

            window.location.href =
                `thanks.html?id=${encodeURIComponent(result.requestId)}`;
        } catch (error) {
            console.error("依頼送信に失敗しました。", error);

            const message =
                error?.message ||
                "依頼の送信に失敗しました。時間をおいてもう一度お試しください。";

            setSubmitStatus("error", message);

            button.disabled = false;
            button.textContent = "依頼を送信";
        }
    });
}

function setSubmitStatus(type, message) {
    const status = document.getElementById("submit_status");
    if (!status) return;

    status.hidden = false;
    status.className = `submit-status ${type}`;
    status.textContent = message;
}

function renderPreview(data) {
    const body = document.getElementById("preview_body");
    const estimate = data.estimate;
    const applicant = data.applicant;

    const estimateLines = (estimate.lines || [])
        .map(line => `<li>${escapeHtml(String(line).replace(/^・/, ""))}</li>`)
        .join("");

    let setBlock = "";

    if (estimate.tab === "set" && estimate.set) {
        setBlock = `
            <dt>セット</dt>
            <dd>${escapeHtml(estimate.set.planLabel || "―")}</dd>
            <dt>最低注文額</dt>
            <dd>${Number(estimate.set.minimum || 0).toLocaleString()}円</dd>
            <dt>セット割引</dt>
            <dd>-${Number(estimate.set.setDiscount || 0).toLocaleString()}円</dd>
        `;
    }

    body.innerHTML = `
        <div class="preview-block">
            <h3>依頼内容</h3>
            <dl class="preview-data">
                <dt>依頼区分</dt>
                <dd>${escapeHtml(estimate.category || "")}</dd>
                <dt>合計金額</dt>
                <dd><strong>${Number(estimate.finalTotal || 0).toLocaleString()}円</strong></dd>
                <dt>割引</dt>
                <dd>${escapeHtml(getDiscountLabel(estimate.discount))}</dd>
                ${setBlock}
            </dl>
            <ul class="preview-list">${estimateLines}</ul>
        </div>

        <div class="preview-block">
            <h3>依頼者情報</h3>
            <dl class="preview-data">
                <dt>活動名 / お名前</dt>
                <dd>${escapeHtml(applicant.activityName)}</dd>
                <dt>連絡方法</dt>
                <dd>${escapeHtml(getContactMethodLabel(applicant.contactMethod))}</dd>
                <dt>連絡先</dt>
                <dd>${escapeHtml(applicant.contactValue)}</dd>
                <dt>希望納期</dt>
                <dd>${escapeHtml(applicant.deadline || "未指定")}</dd>
                <dt>公開予定日</dt>
                <dd>${escapeHtml(applicant.publicDate || "未指定")}</dd>
                <dt>素材URL</dt>
                <dd>${escapeHtml(applicant.materialsUrl || "未入力")}</dd>
                <dt>参考URL</dt>
                <dd>${escapeHtml(applicant.referenceUrl || "未入力")}</dd>
                <dt>ご要望・補足</dt>
                <dd>${escapeHtml(applicant.notes || "なし").replace(/\n/g, "<br>")}</dd>
            </dl>
        </div>
    `;
}

function getDiscountLabel(discount) {
    if (!discount) return "なし";

    if (discount.student && discount.first) {
        return "学生料金 + 初回利用（合計60%OFF）";
    }

    if (discount.student) {
        return "学生料金 50%OFF";
    }

    if (discount.first) {
        return "初回利用 20%OFF";
    }

    return "なし";
}

function getContactMethodLabel(value) {
    return {
        discord: "Discord",
        x: "X（Twitter）",
        email: "メール",
        other: "その他"
    }[value] || value;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
