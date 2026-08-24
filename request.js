// ============================================================
// u29Qr ご依頼フォーム
// request.js v2
// ============================================================

const ESTIMATE_STORAGE_KEY = "u29qr_current_estimate";
const REQUEST_DRAFT_KEY = "u29qr_request_draft";

window.addEventListener("DOMContentLoaded", () => {
    const savedEstimate = loadEstimate();

    restoreEstimateIntoEditor(savedEstimate);
    setupContactMethod();
    restoreDraft();
    setupEditorSync();
    setupForm();
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
    ["main", "mv", "movie", "set"].forEach(prefix => {
        const eshi = document.querySelector(
            `input[name="eshi_${prefix}"][value="2"]`
        );

        if (eshi?.checked) {
            updateIllust(prefix);
        }
    });

    ["mv", "movie"].forEach(prefix => {
        const checkbox = document.getElementById(`chk_illust_${prefix}`);

        if (checkbox) {
            const wrap = document.getElementById(`wrap_illust_${prefix}`);
            if (wrap) {
                wrap.style.display = checkbox.checked ? "block" : "none";
            }
        }
    });

    updatePriceTags();
    calcTotal();
}

function setupEditorSync() {
    document.addEventListener("change", event => {
        if (event.target.closest(".request-section")) {
            saveCurrentEstimate();
        }
    });

    document.addEventListener("input", event => {
        if (event.target.closest(".request-section")) {
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

        if (!form.reportValidity()) {
            return;
        }

        const estimate = getCurrentEstimateData();

        if (estimate.tab === "set" && estimate.set && !estimate.set.meetsMinimum) {
            alert("現在のセット内容は最低注文額を満たしていません。内容を変更してから確認してください。");
            return;
        }

        const requestData = buildRequestData(estimate);

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
        }
    };
}

function saveDraft() {
    try {
        const estimate = getCurrentEstimateData();
        const requestData = buildRequestData(estimate);

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
