// ============================================================
// なずなお見積りサイト
// script.js v9
// ============================================================

const TAB_INFO = {
    set:    { sectionId: "sec_set",    title: "セット",       mailTitle: "セット予算" },
    mix:    { sectionId: "sec_mix",    title: "MIX",          mailTitle: "MIX予算" },
    mv:     { sectionId: "sec_mv",     title: "MV",           mailTitle: "MV予算" },
    movie:  { sectionId: "sec_movie",  title: "動画",         mailTitle: "動画予算" },
    illust: { sectionId: "sec_illust", title: "イラスト",     mailTitle: "イラスト予算" }
};

const SET_INFO = {
    mix_mv: {
        label: "MIX + MVセット",
        minimum: 2000,
        discount: 500,
        components: ["mix", "mv"]
    },
    mv_illust: {
        label: "MV + イラストセット",
        minimum: 1500,
        discount: 300,
        components: ["mv", "illust"]
    },
    movie_illust: {
        label: "動画 + イラストセット",
        minimum: 2000,
        discount: 500,
        components: ["movie", "illust"]
    },
    mix_mv_illust: {
        label: "MIX + MV + イラストセット",
        minimum: 3000,
        discount: 1000,
        components: ["mix", "mv", "illust"]
    }
};


// ============================================================
// 受付状況
// ============================================================

const NAZUNA_API_BASE = "https://worker.nazuna-request.workers.dev";

let SERVICE_AVAILABILITY = {
    mix: true,
    mv: true,
    movie: true,
    illust: true,
    set: true
};


const SET_PLAN_REQUIREMENTS = {
    mix_mv: ["mix", "mv"],
    mv_illust: ["mv", "illust"],
    movie_illust: ["movie", "illust"],
    mix_mv_illust: ["mix", "mv", "illust"]
};

const SET_PLAN_LABELS = {
    mix_mv: "MIX + MVセット",
    mv_illust: "MV + イラストセット",
    movie_illust: "動画 + イラストセット",
    mix_mv_illust: "MIX + MV + イラストセット"
};

function isSetPlanAccepting(planKey) {
    if (SERVICE_AVAILABILITY.set === false) {
        return false;
    }

    const requirements = SET_PLAN_REQUIREMENTS[planKey];

    if (!requirements) {
        return false;
    }

    return requirements.every(
        serviceKey => SERVICE_AVAILABILITY[serviceKey] !== false
    );
}

function getSelectedSetPlanKey() {
    return document.querySelector(
        'input[name="set_plan"]:checked'
    )?.value || "";
}

function isEstimateAccepting(estimate = null) {
    const tab = estimate?.tab || getCurrentTab();

    if (SERVICE_AVAILABILITY[tab] === false) {
        return false;
    }

    if (tab !== "set") {
        return true;
    }

    const planKey =
        estimate?.set?.planKey ||
        getSelectedSetPlanKey();

    if (!planKey) {
        return SERVICE_AVAILABILITY.set !== false;
    }

    return isSetPlanAccepting(planKey);
}

function applySetPlanAvailability() {
    const isRequestPage =
        Boolean(document.getElementById("request_form"));

    document.querySelectorAll(
        'input[name="set_plan"]'
    ).forEach(radio => {
        const planKey = radio.value;
        const accepting = isSetPlanAccepting(planKey);

        const label = radio.closest("label");

        if (!label) return;

        label.classList.toggle(
            "is-set-plan-closed",
            !accepting
        );

        let badge =
            label.querySelector(".set-plan-closed-badge");

        if (!accepting) {
            if (!badge) {
                badge =
                    document.createElement("span");

                badge.className =
                    "set-plan-closed-badge";

                badge.textContent =
                    "受付停止中";

                label.appendChild(badge);
            }

            if (isRequestPage) {
                radio.disabled = true;

                if (radio.checked) {
                    radio.checked = false;
                }
            }
        } else {
            if (badge) {
                badge.remove();
            }

            radio.disabled = false;
        }
    });

    if (
        isRequestPage &&
        getCurrentTab() === "set"
    ) {
        const selected =
            document.querySelector(
                'input[name="set_plan"]:checked'
            );

        if (!selected) {
            hideSetPanels();
        }
    }
}


async function loadServiceAvailability() {
    try {
        const response = await fetch(
            `${NAZUNA_API_BASE}/api/public/settings`,
            { cache: "no-store" }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (data?.settings) {
            SERVICE_AVAILABILITY = {
                ...SERVICE_AVAILABILITY,
                ...data.settings
            };
        }

        applyServiceAvailability();
    } catch (error) {
        console.warn("受付状況を取得できませんでした。", error);
    }
}

function applyServiceAvailability() {
    const isRequestPage =
        Boolean(document.getElementById("request_form"));

    Object.entries(SERVICE_AVAILABILITY).forEach(([key, accepting]) => {
        const radio = document.querySelector(
            `input[name="main_tab"][value="${key}"]`
        );

        if (!radio) return;

        const label = document.querySelector(
            `label[for="${radio.id}"]`
        );

        if (!label) return;

        label.classList.toggle("is-closed", !accepting);

        let badge = label.querySelector(".closed-badge");

        if (!accepting) {
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "closed-badge";
                badge.textContent = "受付停止中";
                label.appendChild(badge);
            }

            if (isRequestPage) {
                radio.disabled = true;
            }
        } else {
            if (badge) badge.remove();
            radio.disabled = false;
        }
    });

    if (isRequestPage) {
        const current = getCurrentTab();

        if (!SERVICE_AVAILABILITY[current]) {
            const firstOpen = document.querySelector(
                'input[name="main_tab"]:not(:disabled)'
            );

            if (firstOpen) {
                firstOpen.checked = true;
                switchTab();
            }
        }
    }

    applySetPlanAvailability();
    calcTotal();
}

function isCurrentServiceAccepting() {
    return isEstimateAccepting();
}

window.addEventListener("DOMContentLoaded", () => {
    // イラストフォームを各場所へ展開
    const templateElement = document.getElementById("tmpl_illust");

    if (templateElement) {
        const template = templateElement.innerHTML;
        ["main", "set"].forEach(prefix => {
            const wrapper = document.getElementById(`wrap_illust_${prefix}`);
            if (wrapper) {
                wrapper.innerHTML = template.replace(/PREFIX/g, prefix);
            }
        });
    }

    // 入力変更時に再計算
    document.addEventListener("change", () => {
        updatePriceTags();
        calcTotal();
    });

    document.addEventListener("input", () => {
        calcTotal();
    });

    switchTab();
    updateSetPanels();
    updatePriceTags();
    calcTotal();
    loadServiceAvailability();
});


// ============================================================
// 共通
// ============================================================

function getCurrentTab() {
    return document.querySelector('input[name="main_tab"]:checked')?.value || "mix";
}

function switchTab() {
    const currentTab = getCurrentTab();

    // すべての予算セクションを一旦非表示
    Object.values(TAB_INFO).forEach(info => {
        const section = document.getElementById(info.sectionId);
        if (section) {
            section.style.display = "none";
        }
    });

    // 現在のタブだけ表示
    const currentInfo = TAB_INFO[currentTab];
    const currentSection = document.getElementById(currentInfo.sectionId);

    if (currentSection) {
        currentSection.style.display = "block";
    }

    // セットタブを離れた場合、セット専用の表示を確実に閉じる
    if (currentTab !== "set") {
        hideSetPanels();
    } else {
        renderSetPanels();
    }

    const totalTitle = document.getElementById("total-title");
    if (totalTitle) {
        totalTitle.textContent = `${currentInfo.title}のお見積り金額:`;
    }

    calcTotal();
}

function getDiscountRate() {
    const isStudent = document.getElementById("chk_student")?.checked ?? false;
    const isFirst = document.getElementById("chk_first")?.checked ?? false;

    if (isStudent && isFirst) return 0.4;
    if (isStudent) return 0.5;
    if (isFirst) return 0.8;
    return 1;
}


// ============================================================
// クレジットなし（固定 +3,000円 / 割引対象外）
// ============================================================

const NO_CREDIT_PRICE = 3000;

const NO_CREDIT_OPTION_IDS = {
    mix: "mix_opt_no_credit",
    mv: "mv_opt_no_credit",
    movie: "movie_opt_no_credit",
    illust: "illust_opt_no_credit",
    set: "set_opt_no_credit"
};

function getNoCreditAddon(tab = getCurrentTab()) {
    const id = NO_CREDIT_OPTION_IDS[tab];

    if (!id) {
        return 0;
    }

    const checkbox =
        document.getElementById(id);

    return checkbox?.checked
        ? NO_CREDIT_PRICE
        : 0;
}

function addNoCreditLine(
    lines,
    tab = getCurrentTab()
) {
    const addon =
        getNoCreditAddon(tab);

    if (addon > 0) {
        lines.push(
            `・クレジットなし (+${addon.toLocaleString()}円 / 固定料金)`
        );
    }

    return addon;
}


function updatePriceTags() {
    const rate = getDiscountRate();

    document.querySelectorAll(".price-tag").forEach(tag => {
        // イラストと固定料金は割引対象外
        if (
            tag.closest(".illust-sub-form") ||
            tag.classList.contains("fixed-price-tag")
        ) return;

        if (!tag.dataset.originalPrice) {
            const match = tag.textContent.match(/[+＋]?\s*[\d,]+/);
            if (!match) return;

            tag.dataset.originalPrice = match[0]
                .replace(/,/g, "")
                .replace(/＋/g, "+")
                .replace(/\s/g, "");
        }

        const originalText = tag.dataset.originalPrice;
        const hasPlus = originalText.startsWith("+");
        const originalPrice = parseInt(originalText.replace("+", ""), 10);

        if (Number.isNaN(originalPrice)) return;

        const prefix = hasPlus ? "+" : "";

        if (rate === 1 || originalPrice === 0) {
            tag.innerHTML = `${prefix}${originalPrice.toLocaleString()}円`;
            return;
        }

        const discountedPrice = Math.floor(originalPrice * rate);

        tag.innerHTML =
            `<span class="price-original">${prefix}${originalPrice.toLocaleString()}円</span>` +
            `<span class="price-discounted">${prefix}${discountedPrice.toLocaleString()}円</span>`;
    });
}


// ============================================================
// セット表示切り替え
// ============================================================

function hideSetPanels() {
    ["set_mix_panel", "set_mv_panel", "set_movie_panel", "set_illust_panel"].forEach(id => {
        const panel = document.getElementById(id);
        if (panel) {
            panel.style.display = "none";
        }
    });

    const summary = document.getElementById("set_rule_summary");
    if (summary) {
        summary.style.display = "none";
    }
}

function renderSetPanels() {
    const selectedPlan = document.querySelector('input[name="set_plan"]:checked')?.value;

    const panelMap = {
        mix: document.getElementById("set_mix_panel"),
        mv: document.getElementById("set_mv_panel"),
        movie: document.getElementById("set_movie_panel"),
        illust: document.getElementById("set_illust_panel")
    };

    // まず全て閉じる
    Object.values(panelMap).forEach(panel => {
        if (panel) {
            panel.style.display = "none";
        }
    });

    const summary = document.getElementById("set_rule_summary");

    if (!selectedPlan || !SET_INFO[selectedPlan]) {
        if (summary) {
            summary.style.display = "none";
        }
        return;
    }

    const info = SET_INFO[selectedPlan];

    // 選択したセットに含まれる予算系統をすべて下に表示
    info.components.forEach(component => {
        const panel = panelMap[component];
        if (panel) {
            panel.style.display = "block";
        }
    });

    if (summary) {
        summary.style.display = "block";
        summary.innerHTML =
            `<strong>${info.label}</strong><br>` +
            `最低注文額：${info.minimum.toLocaleString()}円 / ` +
            `セット割引：-${info.discount.toLocaleString()}円` +
            `<span class="desc">（最低注文額・セット割引額は、学生料金や初回割引を適用しても変わりません。）</span>`;
    }
}

function updateSetPanels() {
    // セット予算タブを開いている時だけ表示する
    if (getCurrentTab() === "set") {
        renderSetPanels();
    } else {
        hideSetPanels();
    }

    applySetPlanAvailability();
    calcTotal();
}


// ============================================================
// イラスト
// ============================================================

function toggleIllust(prefix) {
    const checkbox = document.getElementById(`chk_illust_${prefix}`);
    const wrapper = document.getElementById(`wrap_illust_${prefix}`);

    if (!checkbox || !wrapper) return;

    wrapper.style.display = checkbox.checked ? "block" : "none";
    calcTotal();
}

function updateIllust(prefix) {
    const eshi2 = document.querySelector(`input[name="eshi_${prefix}"][value="2"]`);
    const eshiArea = document.getElementById(`eshi2_area_${prefix}`);

    if (!eshi2 || !eshiArea) return;

    eshiArea.style.display = eshi2.checked ? "block" : "none";

    if (!eshi2.checked) {
        calcTotal();
        return;
    }

    const style = document.querySelector(`input[name="style_${prefix}"]:checked`);

    if (!style) {
        calcTotal();
        return;
    }

    const rangeArea = document.getElementById(`range_area_${prefix}`);
    if (rangeArea) rangeArea.style.display = "block";

    const labels = {
        face: document.getElementById(`lbl_face_${prefix}`),
        chest: document.getElementById(`lbl_chest_${prefix}`),
        knee: document.getElementById(`lbl_knee_${prefix}`),
        full: document.getElementById(`lbl_full_${prefix}`)
    };

    Object.values(labels).forEach(label => {
        if (label) label.style.display = "none";
    });

    let prices = {};

    if (style.value === "normal") {
        prices = { chest: 1500, knee: 2500, full: 5000 };
    } else if (style.value === "simple") {
        prices = { chest: 1000, knee: 2000, full: 4000 };
    } else if (style.value === "deform") {
        prices = { face: 500, full: 2000 };
    }

    Object.entries(prices).forEach(([range, price]) => {
        const label = labels[range];
        if (label) label.style.display = "inline";

        const priceElement = document.getElementById(`price_${range}_${prefix}`);
        if (priceElement) priceElement.textContent = `${price.toLocaleString()}円`;
    });

    Object.entries(labels).forEach(([range, label]) => {
        if (!label) return;

        if (!Object.prototype.hasOwnProperty.call(prices, range)) {
            const input = label.querySelector("input");
            if (input) input.checked = false;
        }
    });

    calcTotal();
}

function getIllustPrice(prefix) {
    const wrapper = document.getElementById(`wrap_illust_${prefix}`);
    if (!wrapper) return 0;

    if (prefix !== "main" && prefix !== "set" && wrapper.style.display === "none") {
        return 0;
    }

    const eshi = document.querySelector(`input[name="eshi_${prefix}"]:checked`);
    const style = document.querySelector(`input[name="style_${prefix}"]:checked`);
    const range = document.querySelector(`input[name="range_${prefix}"]:checked`);

    if (!eshi || eshi.value !== "2" || !style || !range) return 0;

    const table = {
        normal: { chest: 1500, knee: 2500, full: 5000 },
        simple: { chest: 1000, knee: 2000, full: 4000 },
        deform: { face: 500, full: 2000 }
    };

    return table[style.value]?.[range.value] || 0;
}

function getIllustDescription(prefix) {
    const style = document.querySelector(`input[name="style_${prefix}"]:checked`);
    const range = document.querySelector(`input[name="range_${prefix}"]:checked`);

    if (!style || !range) return "";

    return `絵師2 / ${style.dataset.label} / ${range.dataset.label}`;
}


// ============================================================
// MIX
// ============================================================

function calculateMix(isSet = false) {
    const prefix = isSet ? "set_" : "";
    const usersId = isSet ? "set_mix_users" : "mix_users";
    const baseName = isSet ? "set_mix_base" : "mix_base";
    const harmName = isSet ? "set_mix_harm" : "mix_harm";
    const optionSelector = isSet ? ".set-mix-opt:checked" : ".mix-opt:checked";
    const encodeId = isSet ? "set_opt_mix_encode" : "opt_mix_encode";

    let discountable = 0;
    const lines = [];

    const base = document.querySelector(`input[name="${baseName}"]:checked`);

    if (!base) {
        return { discountable, illust: 0, lines };
    }

    const users = Math.max(
        1,
        parseInt(document.getElementById(usersId)?.value, 10) || 1
    );

    const basePrice = parseInt(base.value, 10);
    discountable += basePrice * users;
    lines.push(`・MIX基本料金: ${base.dataset.label} × ${users}人`);

    const harm = document.querySelector(`input[name="${harmName}"]:checked`);

    if (harm) {
        const harmPrice = parseInt(harm.value, 10);
        discountable += harmPrice;
        lines.push(
            harmPrice > 0
                ? `・ハモリ: ${harm.dataset.label} (+${harmPrice.toLocaleString()}円)`
                : `・ハモリ: ${harm.dataset.label}`
        );
    }

    document.querySelectorAll(optionSelector).forEach(option => {
        const price = parseInt(option.value, 10);
        discountable += price;
        lines.push(`・MIXオプション: ${option.dataset.label} (+${price.toLocaleString()}円)`);
    });

    const encode = document.getElementById(encodeId);
    if (encode?.checked) {
        const price = parseInt(encode.value, 10);
        discountable += price;
        lines.push(
            price === 0
                ? "・MIXオプション: エンコード（MVセットのため無料）"
                : `・MIXオプション: エンコード (+${price.toLocaleString()}円)`
        );
    }

    return { discountable, illust: 0, lines };
}


// ============================================================
// MV
// ============================================================

function calculateMv(isSet = false) {
    const lengthName = isSet ? "set_mv_length" : "mv_length";
    const configName = isSet ? "set_mv_config" : "mv_config";
    const thumbId = isSet ? "set_opt_mv_thumb" : "opt_mv_thumb";

    let discountable = 0;
    const lines = [];

    const length = document.querySelector(`input[name="${lengthName}"]:checked`);
    if (length) {
        discountable += parseInt(length.value, 10);
        lines.push(`・MV動画尺: ${length.dataset.label}`);
    }

    const config = document.querySelector(`input[name="${configName}"]:checked`);
    if (config) {
        discountable += parseInt(config.value, 10);
        lines.push(`・MV構成: ${config.dataset.label}`);
    }

    const thumb = document.getElementById(thumbId);
    if (thumb?.checked) {
        discountable += 500;
        lines.push("・MVオプション: サムネイル (+500円)");
    }

    return {
        discountable,
        illust: 0,
        lines
    };
}


// ============================================================
// 動画
// ============================================================

function calculateMovie(isSet = false) {
    const minId = isSet ? "set_movie_min" : "movie_min";
    const matId = isSet ? "set_movie_mat" : "movie_mat";
    const cutName = isSet ? "set_movie_cut" : "movie_cut";
    const thumbId = isSet ? "set_opt_movie_thumb" : "opt_movie_thumb";

    let discountable = 0;
    const lines = [];

    const minutes = parseInt(document.getElementById(minId)?.value, 10);

    if (!Number.isNaN(minutes)) {
        let basePrice = 0;

        if (minutes < 3) basePrice = 1500;
        else if (minutes < 8) basePrice = minutes * 400;
        else if (minutes < 30) basePrice = minutes * 500;
        else basePrice = minutes * 1000;

        discountable += basePrice;
        lines.push(`・動画尺: ${minutes}分`);
    }

    const materials = document.getElementById(matId)?.value;
    if (materials) {
        lines.push(`・動画の素材数: ${materials}`);
    }

    const cut = document.querySelector(`input[name="${cutName}"]:checked`);
    if (cut) {
        discountable += parseInt(cut.value, 10);
        lines.push(`・カット: ${cut.dataset.label}`);
    }

    const thumb = document.getElementById(thumbId);
    if (thumb?.checked) {
        discountable += 500;
        lines.push("・動画オプション: サムネイル (+500円)");
    }

    return {
        discountable,
        illust: 0,
        lines
    };
}


// ============================================================
// イラスト単体
// ============================================================

function calculateIllust(prefix = "main") {
    const illust = getIllustPrice(prefix);
    const lines = [];

    if (illust > 0) {
        lines.push(`・${getIllustDescription(prefix)}`);
    }

    return { discountable: 0, illust, lines };
}


// ============================================================
// セット計算
// ============================================================

function calculateSet() {
    const planKey = document.querySelector('input[name="set_plan"]:checked')?.value;

    if (!planKey || !SET_INFO[planKey]) {
        return {
            finalTotal: 0,
            beforeSetDiscount: 0,
            lines: [],
            planLabel: "",
            minimum: 0,
            setDiscount: 0,
            meetsMinimum: false
        };
    }

    const info = SET_INFO[planKey];

    let discountable = 0;
    let illust = 0;
    const lines = [];

    if (info.components.includes("mix")) {
        const result = calculateMix(true);
        discountable += result.discountable;
        lines.push(...result.lines);
    }

    if (info.components.includes("mv")) {
        const result = calculateMv(true);
        discountable += result.discountable;
        lines.push(...result.lines);
    }

    if (info.components.includes("movie")) {
        const result = calculateMovie(true);
        discountable += result.discountable;
        lines.push(...result.lines);
    }

    if (info.components.includes("illust")) {
        const result = calculateIllust("set");
        illust += result.illust;

        if (result.lines.length) {
            lines.push(
                `・イラスト: ${getIllustDescription("set")} (+${illust.toLocaleString()}円)`
            );
        }
    }

    // クレジットなしは固定 +3,000円で割引対象外。
    const noCreditAddon = addNoCreditLine(lines, "set");

    // 学割・初回割引は通常サービス部分だけに適用。
    // イラスト・クレジットなしは割引対象外。
    const rate = getDiscountRate();
    const discountedService = Math.floor(discountable * rate);

    // 最低注文額は「学割・初回割引適用後、セット割引適用前」の注文総額で判定する。
    // 固定オプションも注文総額に含める。
    const beforeSetDiscount =
        discountedService +
        illust +
        noCreditAddon;
    const meetsMinimum = beforeSetDiscount >= info.minimum;

    // 最低注文額を満たしている場合だけ、固定額のセット割引を適用。
    // セット割引額そのものも学割・初回割引で変化しない。
    const finalTotal = meetsMinimum
        ? Math.max(0, beforeSetDiscount - info.discount)
        : beforeSetDiscount;

    return {
        finalTotal,
        beforeSetDiscount,
        lines,
        planLabel: info.label,
        minimum: info.minimum,
        setDiscount: info.discount,
        meetsMinimum
    };
}


// ============================================================
// メイン計算
// ============================================================

function calcTotal() {
    const currentTab = getCurrentTab();
    const rate = getDiscountRate();

    updatePriceTags();

    let finalTotal = 0;
    let lines = [];
    let extraMailLines = [];
    let setResult = null;

    if (currentTab === "set") {
        setResult = calculateSet();
        finalTotal = setResult.finalTotal;
        lines = setResult.lines;

        if (setResult.planLabel) {
            extraMailLines.push(`・セット: ${setResult.planLabel}`);
            extraMailLines.push(`・最低注文額: ${setResult.minimum.toLocaleString()}円`);
            extraMailLines.push(`・セット割引: -${setResult.setDiscount.toLocaleString()}円`);

            if (!setResult.meetsMinimum) {
                extraMailLines.push(
                    `・学割・初回割引適用後の注文額: ${setResult.beforeSetDiscount.toLocaleString()}円（最低注文額未満）`
                );
            }
        }
    } else {
        let result = { discountable: 0, illust: 0, lines: [] };

        if (currentTab === "mix") {
            result = calculateMix(false);
        } else if (currentTab === "mv") {
            result = calculateMv(false);
        } else if (currentTab === "movie") {
            result = calculateMovie(false);
        } else if (currentTab === "illust") {
            result = calculateIllust("main");
        }

        const noCreditAddon =
            addNoCreditLine(
                result.lines,
                currentTab
            );

        finalTotal =
            Math.floor(result.discountable * rate) +
            result.illust +
            noCreditAddon;

        lines = result.lines;
    }

    const info = TAB_INFO[currentTab];

    const title = document.getElementById("total-title");
    if (title) {
        title.textContent = `${info.title}のお見積り金額:`;
    }

    const price = document.getElementById("display_price");

    if (price) {
        if (currentTab === "set" && setResult?.planLabel) {
            if (setResult.meetsMinimum) {
                price.innerHTML =
                    `<span class="total-original">${setResult.beforeSetDiscount.toLocaleString()}円</span>` +
                    `<span class="total-discounted">${setResult.finalTotal.toLocaleString()}円</span>`;
            } else {
                price.innerHTML =
                    `<span class="total-current">${setResult.beforeSetDiscount.toLocaleString()}円</span>` +
                    `<span class="minimum-warning">最低注文額を満たしていません。</span>`;
            }
        } else {
            price.textContent = `${finalTotal.toLocaleString()} 円`;
        }
    }

    updateSubmitButton(currentTab, finalTotal, lines, extraMailLines);
}



// ============================================================
// 現在の見積り内容をデータ化
// request.html への引き継ぎにも使用
// ============================================================

function captureEstimatorState(currentTab = getCurrentTab()) {
    const state = [];

    const targets = [
        document.getElementById("chk_student"),
        document.getElementById("chk_first")
    ];

    const section = document.getElementById(`sec_${currentTab}`);

    if (section) {
        section.querySelectorAll("input, select, textarea").forEach(element => {
            targets.push(element);
        });
    }

    targets.filter(Boolean).forEach(element => {
        const item = {
            tag: element.tagName.toLowerCase(),
            type: element.type || "",
            id: element.id || "",
            name: element.name || ""
        };

        if (element.type === "radio" || element.type === "checkbox") {
            item.optionValue = element.value;
            item.checked = element.checked;
        } else {
            item.value = element.value;
        }

        state.push(item);
    });

    return state;
}

function restoreEstimatorState(state) {
    if (!Array.isArray(state)) return;

    state.forEach(item => {
        let element = null;

        if (item.id) {
            element = document.getElementById(item.id);
        }

        if (!element && item.name) {
            if (item.type === "radio" || item.type === "checkbox") {
                const safeValue = CSS.escape(String(item.optionValue ?? ""));
                element = document.querySelector(
                    `input[name="${CSS.escape(item.name)}"][value="${safeValue}"]`
                );
            } else {
                element = document.querySelector(`[name="${CSS.escape(item.name)}"]`);
            }
        }

        if (!element) return;

        if (item.type === "radio" || item.type === "checkbox") {
            element.checked = Boolean(item.checked);
        } else if ("value" in item) {
            element.value = item.value;
        }
    });
}

function getCurrentEstimateData() {
    const currentTab = getCurrentTab();
    const info = TAB_INFO[currentTab];
    const rate = getDiscountRate();

    let finalTotal = 0;
    let lines = [];
    let extraLines = [];
    let setData = null;

    if (currentTab === "set") {
        const result = calculateSet();

        finalTotal = result.finalTotal;
        lines = result.lines;

        if (result.planLabel) {
            extraLines.push(`・セット: ${result.planLabel}`);
            extraLines.push(`・最低注文額: ${result.minimum.toLocaleString()}円`);
            extraLines.push(`・セット割引: -${result.setDiscount.toLocaleString()}円`);

            if (!result.meetsMinimum) {
                extraLines.push(
                    `・学割・初回割引適用後の注文額: ${result.beforeSetDiscount.toLocaleString()}円（最低注文額未満）`
                );
            }
        }

        const planKey =
            document.querySelector('input[name="set_plan"]:checked')?.value || "";

        setData = {
            planKey,
            planLabel: result.planLabel || "",
            minimum: result.minimum || 0,
            setDiscount: result.setDiscount || 0,
            beforeSetDiscount: result.beforeSetDiscount || 0,
            meetsMinimum: Boolean(result.meetsMinimum)
        };
    } else {
        let result = {
            discountable: 0,
            illust: 0,
            lines: []
        };

        if (currentTab === "mix") {
            result = calculateMix(false);
        } else if (currentTab === "mv") {
            result = calculateMv(false);
        } else if (currentTab === "movie") {
            result = calculateMovie(false);
        } else if (currentTab === "illust") {
            result = calculateIllust("main");
        }

        const noCreditAddon =
            addNoCreditLine(
                result.lines,
                currentTab
            );

        finalTotal =
            Math.floor(result.discountable * rate) +
            result.illust +
            noCreditAddon;

        lines = result.lines;
    }

    return {
        version: 2,
        savedAt: new Date().toISOString(),
        tab: currentTab,
        title: info?.title || "",
        category: info?.mailTitle || "",
        finalTotal,
        lines: [...extraLines, ...lines],
        discount: {
            student: document.getElementById("chk_student")?.checked ?? false,
            first: document.getElementById("chk_first")?.checked ?? false,
            rate
        },
        set: setData,
        formState: captureEstimatorState(currentTab)
    };
}


// ============================================================
// メール
// ============================================================

function updateSubmitButton(currentTab, finalTotal, lines, extraMailLines = []) {
    const button = document.getElementById("btn_submit");
    if (!button) return;

    const estimateForAvailability =
        typeof getCurrentEstimateData === "function"
            ? getCurrentEstimateData()
            : null;

    if (!isEstimateAccepting(estimateForAvailability)) {
        button.disabled = true;
        button.textContent = "受付停止中";
        button.onclick = null;
        return;
    }

    button.disabled = false;
    button.textContent = "依頼してみる！";

    button.onclick = () => {
        const estimate = getCurrentEstimateData();

        localStorage.setItem(
            "nazuna_current_estimate",
            JSON.stringify(estimate)
        );

        window.location.href = "request.html";
    };
}
