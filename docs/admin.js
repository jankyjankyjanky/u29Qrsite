const API_BASE = "https://worker.nazuna-request.workers.dev";
const TOKEN_KEY = "nazuna_admin_token";

const SERVICE_LABELS = {
    mix: "MIX",
    mv: "MV",
    movie: "動画編集",
    illust: "イラスト",
    set: "セット"
};

const STATUS_LABELS = {
    new: "新規",
    checked: "確認済み",
    in_progress: "制作中",
    completed: "完了",
    cancelled: "キャンセル",
    archived: "アーカイブ"
};

let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
let allRequests = [];
let pendingRequestId =
    new URLSearchParams(window.location.search).get("request") || "";

window.addEventListener("DOMContentLoaded", async () => {
    setupEvents();

    if (adminToken) {
        showAdmin();
        await refreshAll();
        await openPendingRequestIfNeeded();
    }
});

function setupEvents() {
    document.getElementById("admin_login").addEventListener("click", login);
    document.getElementById("admin_logout").addEventListener("click", logout);
    document.getElementById("refresh_admin").addEventListener("click", refreshAll);

    document.getElementById("request_filter").addEventListener("change", renderRequestList);

    document.getElementById("request_search").addEventListener("input", renderRequestList);

    document.getElementById("show_new_only").addEventListener("click", () => {
        document.getElementById("request_filter").value = "new";
        renderRequestList();
    });

    document.getElementById("clear_request_filters").addEventListener("click", () => {
        document.getElementById("request_filter").value = "";
        document.getElementById("request_search").value = "";
        renderRequestList();
    });

    document.querySelectorAll("[data-close-detail]").forEach(element => {
        element.addEventListener("click", closeDetail);
    });

    document.getElementById("admin_token").addEventListener("keydown", event => {
        if (event.key === "Enter") login();
    });
}

async function login() {
    const input = document.getElementById("admin_token");
    const value = input.value.trim();

    if (!value) return;

    adminToken = value;

    try {
        await adminFetch("/api/admin/settings");
        sessionStorage.setItem(TOKEN_KEY, adminToken);
        document.getElementById("login_error").hidden = true;
        showAdmin();
        refreshAll();
    } catch (error) {
        adminToken = "";
        sessionStorage.removeItem(TOKEN_KEY);

        const box = document.getElementById("login_error");
        box.hidden = false;
        box.textContent = "管理者キーが正しくないか、APIへ接続できませんでした。";
    }
}

function logout() {
    adminToken = "";
    sessionStorage.removeItem(TOKEN_KEY);
    document.getElementById("admin_app").hidden = true;
    document.getElementById("login_panel").hidden = false;
    document.getElementById("admin_token").value = "";
}

function showAdmin() {
    document.getElementById("login_panel").hidden = true;
    document.getElementById("admin_app").hidden = false;
}

async function refreshAll() {
    try {
        await Promise.all([
            loadSettings(),
            loadRequests()
        ]);

        updateUnreadSummary();

        document.getElementById("last_refresh").textContent =
            `最終更新: ${new Date().toLocaleString("ja-JP")}`;
    } catch (error) {
        console.error(error);

        if (error?.status === 401) {
            logout();
            alert("管理者キーの有効性を確認してください。");
        }
    }
}

async function loadSettings() {
    const data = await adminFetch("/api/admin/settings");
    renderSettings(data.settings || {});
}

function renderSettings(settings) {
    const wrap = document.getElementById("service_settings");
    wrap.innerHTML = "";

    Object.entries(SERVICE_LABELS).forEach(([key, label]) => {
        const accepting = settings[key] !== false;

        const box = document.createElement("div");
        box.className = "service-setting";

        const title = document.createElement("strong");
        title.textContent = label;

        const button = document.createElement("button");
        button.type = "button";
        button.className =
            `service-toggle ${accepting ? "accepting" : "closed"}`;
        button.textContent =
            accepting ? "受付中" : "受付停止中";

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await adminFetch(
                    `/api/admin/settings/${key}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            accepting: !accepting
                        })
                    }
                );

                await loadSettings();
            } finally {
                button.disabled = false;
            }
        });

        box.append(title, button);
        wrap.appendChild(box);
    });
}

async function loadRequests() {
    const data = await adminFetch("/api/admin/requests?limit=100");
    allRequests = Array.isArray(data.requests) ? data.requests : [];
    renderRequestList();
}

function renderRequestList() {
    const wrap = document.getElementById("request_list");
    const filter = document.getElementById("request_filter").value;
    const query =
        document.getElementById("request_search").value
            .trim()
            .toLowerCase();

    let items;

    if (filter === "all") {
        items = [...allRequests];
    } else if (filter) {
        items = allRequests.filter(
            item => item.status === filter
        );
    } else {
        items = allRequests.filter(
            item => item.status !== "archived"
        );
    }

    if (query) {
        items = items.filter(item => {
            return [
                item.request_id,
                item.activity_name,
                item.estimate_category
            ]
                .filter(Boolean)
                .some(value =>
                    String(value).toLowerCase().includes(query)
                );
        });
    }

    wrap.innerHTML = "";

    if (!items.length) {
        wrap.innerHTML =
            '<div class="empty-state">該当する依頼はありません。</div>';
        return;
    }

    items.forEach(item => {
        const row = document.createElement("div");
        row.className =
            "request-row" +
            (item.status === "new" ? " is-new" : "") +
            (item.status === "archived" ? " is-archived" : "");
        row.tabIndex = 0;

        row.innerHTML = `
            <div class="request-row-id">${escapeHtml(item.request_id || "―")}</div>

            <div class="request-row-main">
                <strong>${escapeHtml(item.activity_name || "名称なし")}</strong>
                <span>${escapeHtml(item.estimate_category || "")}</span>
            </div>

            <div>
                <span class="status-badge">
                    ${escapeHtml(STATUS_LABELS[item.status] || item.status || "新規")}
                </span>
            </div>

            <div class="request-row-price">
                ${Number(item.estimate_total || 0).toLocaleString()}円
            </div>

            <div class="request-row-date">
                ${formatDate(item.created_at)}
            </div>
        `;

        row.addEventListener("click", () => openDetail(item.request_id));
        row.addEventListener("keydown", event => {
            if (event.key === "Enter") openDetail(item.request_id);
        });

        wrap.appendChild(row);
    });
}

async function openDetail(requestId) {
    const modal = document.getElementById("detail_modal");
    const content = document.getElementById("detail_content");

    modal.hidden = false;
    content.innerHTML = '<p>読み込み中...</p>';

    try {
        const data = await adminFetch(
            `/api/admin/requests/${encodeURIComponent(requestId)}`
        );

        renderDetail(data.request);
    } catch (error) {
        content.innerHTML =
            '<div class="admin-message error">詳細の読み込みに失敗しました。</div>';
    }
}

function closeDetail() {
    document.getElementById("detail_modal").hidden = true;
}

function renderDetail(item) {
    const content = document.getElementById("detail_content");

    let original = {};

    try {
        original = JSON.parse(item.request_json || "{}");
    } catch (error) {
        console.warn(error);
    }

    const applicant = original.applicant || {};
    const estimate = original.estimate || {};

    const lines = Array.isArray(estimate.lines)
        ? estimate.lines
        : [];

    const setText =
        estimate.set?.planLabel
            ? `<dt>セット</dt><dd>${escapeHtml(estimate.set.planLabel)}</dd>`
            : "";

    content.innerHTML = `
        <div class="detail-heading">
            <h2>${escapeHtml(item.request_id || "依頼詳細")}</h2>
            <span class="desc">
                ${escapeHtml(item.activity_name || "")} /
                ${escapeHtml(item.estimate_category || "")}
            </span>
            <a
                class="detail-direct-link"
                href="${escapeHtml(buildAdminRequestUrl(item.request_id))}"
            >
                この依頼への管理画面リンク
            </a>

            <div class="detail-action-row">
                <button
                    type="button"
                    class="copy-button"
                    id="copy_request_id"
                >
                    依頼番号をコピー
                </button>

                <button
                    type="button"
                    class="copy-button"
                    id="copy_admin_link"
                >
                    管理画面リンクをコピー
                </button>

                <button
                    type="button"
                    class="archive-button ${item.status === "archived" ? "restore" : ""}"
                    id="archive_request"
                >
                    ${item.status === "archived" ? "アーカイブから戻す" : "アーカイブ"}
                </button>

                <span id="detail_copy_feedback" class="copy-feedback"></span>
            </div>
        </div>

        <div class="detail-status-row">
            <strong>進行状況</strong>
            <select id="detail_status">
                ${Object.entries(STATUS_LABELS)
                    .map(([key, label]) => `
                        <option value="${key}" ${item.status === key ? "selected" : ""}>
                            ${label}
                        </option>
                    `)
                    .join("")}
            </select>
            <button type="button" class="secondary-button" id="save_status">
                保存
            </button>
        </div>

        <div class="detail-section">
            <h3>依頼情報</h3>
            <dl class="detail-grid">
                <dt>依頼番号</dt>
                <dd>${escapeHtml(item.request_id || "")}</dd>

                <dt>依頼区分</dt>
                <dd>${escapeHtml(item.estimate_category || "")}</dd>

                ${setText}

                <dt>見積り金額</dt>
                <dd><strong>${Number(item.estimate_total || 0).toLocaleString()}円</strong></dd>

                <dt>受付日時</dt>
                <dd>${formatDateTime(item.created_at)}</dd>

                <dt>Discord通知</dt>
                <dd>${item.discord_notified ? "送信済み" : "未送信"}</dd>
            </dl>
        </div>

        <div class="detail-section">
            <h3>依頼内容の詳細</h3>
            <ul class="detail-lines">
                ${lines.length
                    ? lines.map(line => `<li>${escapeHtml(String(line).replace(/^・/, ""))}</li>`).join("")
                    : "<li>詳細項目なし</li>"}
            </ul>
        </div>

        <div class="detail-section">
            <h3>依頼者情報</h3>
            <dl class="detail-grid">
                <dt>活動名 / お名前</dt>
                <dd>${escapeHtml(applicant.activityName || item.activity_name || "")}</dd>

                <dt>連絡方法</dt>
                <dd>${escapeHtml(contactLabel(applicant.contactMethod || item.contact_method))}</dd>

                <dt>連絡先</dt>
                <dd>
                    <div class="contact-value">
                        ${escapeHtml(applicant.contactValue || item.contact_value || "")}
                    </div>
                    <div class="detail-action-row">
                        <button
                            type="button"
                            class="copy-button"
                            id="copy_contact"
                        >
                            連絡先をコピー
                        </button>

                        ${contactOpenHtml(
                            applicant.contactMethod || item.contact_method,
                            applicant.contactValue || item.contact_value || ""
                        )}
                    </div>
                </dd>

                <dt>希望納期</dt>
                <dd>${escapeHtml(applicant.deadline || item.deadline || "指定なし")}</dd>

                <dt>公開予定日</dt>
                <dd>${escapeHtml(applicant.publicDate || item.public_date || "指定なし")}</dd>

                <dt>素材URL</dt>
                <dd>${linkOrText(applicant.materialsUrl || item.materials_url)}</dd>

                <dt>参考URL</dt>
                <dd>${linkOrText(applicant.referenceUrl || item.reference_url)}</dd>
            </dl>
        </div>

        <div class="detail-section">
            <h3>ご要望・補足</h3>
            <div class="detail-notes">
                ${escapeHtml(applicant.notes || item.notes || "なし")}
            </div>
        </div>

        <div class="detail-section admin-note-area">
            <h3>管理者メモ</h3>
            <span class="desc">
                このメモは依頼者には表示されません。
            </span>

            <textarea id="admin_note" placeholder="進行上のメモ、確認事項など">${escapeHtml(item.admin_note || "")}</textarea>

            <div class="admin-note-actions">
                <button type="button" class="secondary-button" id="save_admin_note">
                    メモを保存
                </button>
            </div>
        </div>
    `;

    document.getElementById("copy_request_id").addEventListener("click", async () => {
        await copyText(
            item.request_id || "",
            "依頼番号をコピーしました"
        );
    });

    document.getElementById("copy_admin_link").addEventListener("click", async () => {
        await copyText(
            buildAdminRequestUrl(item.request_id),
            "管理画面リンクをコピーしました"
        );
    });

    document.getElementById("copy_contact").addEventListener("click", async () => {
        await copyText(
            applicant.contactValue ||
            item.contact_value ||
            "",
            "連絡先をコピーしました"
        );
    });

    document.getElementById("archive_request").addEventListener("click", async () => {
        const nextStatus =
            item.status === "archived"
                ? "completed"
                : "archived";

        const message =
            item.status === "archived"
                ? "この依頼をアーカイブから戻しますか？"
                : "この依頼をアーカイブしますか？ データは削除されません。";

        if (!window.confirm(message)) {
            return;
        }

        await adminFetch(
            `/api/admin/requests/${encodeURIComponent(item.request_id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status: nextStatus
                })
            }
        );

        closeDetail();
        await loadRequests();
        updateUnreadSummary();
    });

    document.getElementById("save_status").addEventListener("click", async () => {
        const status = document.getElementById("detail_status").value;

        await adminFetch(
            `/api/admin/requests/${encodeURIComponent(item.request_id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ status })
            }
        );

        await loadRequests();
        updateUnreadSummary();
        await openDetail(item.request_id);
    });

    document.getElementById("save_admin_note").addEventListener("click", async () => {
        const note =
            document.getElementById("admin_note").value;

        await adminFetch(
            `/api/admin/requests/${encodeURIComponent(item.request_id)}/note`,
            {
                method: "PUT",
                body: JSON.stringify({ note })
            }
        );

        await openDetail(item.request_id);
    });
}


function updateUnreadSummary() {
    const newCount =
        allRequests.filter(
            item => item.status === "new"
        ).length;

    const badge =
        document.getElementById(
            "unread_summary"
        );

    if (badge) {
        badge.textContent =
            `新規 ${newCount}件`;
    }
}

async function openPendingRequestIfNeeded() {
    if (!pendingRequestId) return;

    const requestId = pendingRequestId;
    pendingRequestId = "";

    await openDetail(requestId);
}

function buildAdminRequestUrl(requestId) {
    const url =
        new URL(
            window.location.origin +
            window.location.pathname
        );

    url.searchParams.set(
        "request",
        requestId
    );

    return url.toString();
}


async function adminFetch(path, options = {}) {
    const response = await fetch(
        API_BASE + path,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`,
                ...(options.headers || {})
            },
            cache: "no-store"
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(
            data?.error || `HTTP ${response.status}`
        );

        error.status = response.status;
        throw error;
    }

    return data;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(
        value.includes("T") ? value : value.replace(" ", "T") + "Z"
    );

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("ja-JP");
}

function formatDateTime(value) {
    if (!value) return "";

    const date = new Date(
        value.includes("T") ? value : value.replace(" ", "T") + "Z"
    );

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("ja-JP");
}


async function copyText(value, successMessage) {
    const text = String(value || "");

    if (!text) {
        showCopyFeedback("コピーする内容がありません");
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(successMessage);
    } catch (error) {
        console.error(error);
        showCopyFeedback("コピーに失敗しました");
    }
}

function showCopyFeedback(message) {
    const box =
        document.getElementById(
            "detail_copy_feedback"
        );

    if (!box) return;

    box.textContent = message;

    window.setTimeout(() => {
        if (box.textContent === message) {
            box.textContent = "";
        }
    }, 1800);
}

function contactOpenHtml(method, value) {
    const href =
        contactHref(method, value);

    if (!href) {
        return "";
    }

    return `
        <a
            class="contact-open-button"
            href="${escapeHtml(href)}"
            target="_blank"
            rel="noopener noreferrer"
        >
            連絡先を開く
        </a>
    `;
}

function contactHref(method, value) {
    const raw =
        String(value || "").trim();

    if (!raw) return "";

    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }

    if (method === "email") {
        return `mailto:${raw}`;
    }

    if (method === "x") {
        const username =
            raw.replace(/^@/, "")
               .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
               .split(/[/?#]/)[0];

        return username
            ? `https://x.com/${encodeURIComponent(username)}`
            : "";
    }

    // Discordのユーザー名だけではWeb上から確実にDMを直接開けないため、
    // Discordはコピーのみ。招待URL等を入力した場合は上のURL判定で開ける。
    return "";
}

function contactLabel(value) {
    return {
        discord: "Discord",
        x: "X（Twitter）",
        email: "メール",
        other: "その他"
    }[value] || value || "";
}

function linkOrText(value) {
    if (!value) return "未入力";

    const safe = escapeHtml(value);

    if (/^https?:\/\//i.test(value)) {
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
    }

    return safe;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
