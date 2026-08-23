// ============================================================
// u29Qr（うにくる）お見積りサイト
// script.js
// ============================================================


// ============================================================
// タブ情報
// ============================================================

const TAB_INFO = {
    mix: {
        sectionId: "sec_mix",
        title: "MIX",
        mailTitle: "MIX予算"
    },

    mv: {
        sectionId: "sec_mv",
        title: "MV",
        mailTitle: "MV予算"
    },

    movie: {
        sectionId: "sec_movie",
        title: "動画",
        mailTitle: "動画予算"
    },

    thumb: {
        sectionId: "sec_thumb",
        title: "サムネイル",
        mailTitle: "サムネイル予算"
    },

    illust: {
        sectionId: "sec_illust",
        title: "イラスト",
        mailTitle: "イラスト予算"
    }
};


// ============================================================
// 初期化
// ============================================================

window.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------------------------
    // イラストフォームを各場所へ展開
    // --------------------------------------------------------

    const templateElement = document.getElementById("tmpl_illust");

    if (templateElement) {

        const template = templateElement.innerHTML;

        const prefixes = [
            "main",
            "mv",
            "movie",
            "thumb"
        ];

        prefixes.forEach(prefix => {

            const wrapper = document.getElementById(
                `wrap_illust_${prefix}`
            );

            if (wrapper) {

                wrapper.innerHTML =
                    template.replace(/PREFIX/g, prefix);

            }

        });

    }


    // --------------------------------------------------------
    // 入力変更時に見積もりを再計算
    // --------------------------------------------------------

    document.addEventListener("change", () => {

        updatePriceTags();

        calcTotal();

    });


    document.addEventListener("input", () => {

        calcTotal();

    });


    // --------------------------------------------------------
    // 初期表示
    // --------------------------------------------------------

    switchTab();

    updatePriceTags();

    calcTotal();

});


// ============================================================
// 現在選択されているタブを取得
// ============================================================

function getCurrentTab() {

    const selected = document.querySelector(
        'input[name="main_tab"]:checked'
    );

    return selected ? selected.value : "mix";

}


// ============================================================
// タブ切り替え
// ============================================================

function switchTab() {

    const currentTab = getCurrentTab();

    const sections = [
        "sec_mix",
        "sec_mv",
        "sec_movie",
        "sec_thumb",
        "sec_illust"
    ];


    // 全部非表示
    sections.forEach(id => {

        const section = document.getElementById(id);

        if (section) {
            section.style.display = "none";
        }

    });


    // 現在のタブだけ表示
    const currentSection = document.getElementById(
        `sec_${currentTab}`
    );

    if (currentSection) {
        currentSection.style.display = "block";
    }


    // ==========================================
    // 下部の「○○のお見積り金額」を変更
    // ==========================================

    const titles = {
        mix: "MIX",
        mv: "MV",
        movie: "動画",
        thumb: "サムネイル",
        illust: "イラスト"
    };

    const totalTitle = document.getElementById(
        "total-title"
    );

    if (totalTitle) {

        totalTitle.textContent =
            `${titles[currentTab]}のお見積り金額:`;

    }


    // 現在のタブだけ再計算
    calcTotal();
}


// ============================================================
// 割引率を取得
// ============================================================

function getDiscountRate() {

    const student =
        document.getElementById("chk_student");

    const first =
        document.getElementById("chk_first");


    const isStudent =
        student ? student.checked : false;

    const isFirst =
        first ? first.checked : false;


    // 学割＋初回
    // 60%OFF
    if (isStudent && isFirst) {

        return 0.4;

    }


    // 学割
    // 50%OFF
    if (isStudent) {

        return 0.5;

    }


    // 初回
    // 20%OFF
    if (isFirst) {

        return 0.8;

    }


    // 割引なし
    return 1;

}


// ============================================================
// 割引後価格
// ============================================================

function applyDiscount(price) {

    const rate =
        getDiscountRate();

    return Math.floor(
        price * rate
    );

}


// ============================================================
// 料金表示を更新
//
// 例：
// 1000円
//
// ↓ 学割
//
// 1,000円 → 500円
//
// ※ イラストは割引対象外
// ============================================================

function updatePriceTags() {

    const rate = getDiscountRate();

    document.querySelectorAll(".price-tag").forEach(tag => {

        // イラストは割引対象外
        if (tag.closest(".illust-sub-form")) {
            return;
        }


        // 最初の1回だけ元価格を保存
        if (!tag.dataset.originalPrice) {

            const match = tag.textContent.match(/[+＋]?\s*[\d,]+/);

            if (!match) {
                return;
            }

            tag.dataset.originalPrice = match[0]
                .replace(/,/g, "")
                .replace(/＋/g, "+")
                .replace(/\s/g, "");
        }


        const originalText = tag.dataset.originalPrice;

        const hasPlus = originalText.startsWith("+");

        const originalPrice = parseInt(
            originalText.replace("+", ""),
            10
        );

        if (Number.isNaN(originalPrice)) {
            return;
        }


        const prefix = hasPlus ? "+" : "";


        // ==========================================
        // 割引なし
        // ==========================================

        if (rate === 1 || originalPrice === 0) {

            tag.innerHTML =
                `${prefix}${originalPrice.toLocaleString()}円`;

            return;
        }


        // ==========================================
        // 割引あり
        // ==========================================

        const discountedPrice = Math.floor(
            originalPrice * rate
        );


        tag.innerHTML = `
            <span class="price-original">
                ${prefix}${originalPrice.toLocaleString()}円
            </span>
            <span class="price-discounted">
                ${prefix}${discountedPrice.toLocaleString()}円
            </span>
        `;
    });
}


// ============================================================
// イラスト追加フォーム表示切り替え
// ============================================================

function toggleIllust(prefix) {

    const checkbox =
        document.getElementById(
            `chk_illust_${prefix}`
        );


    const wrapper =
        document.getElementById(
            `wrap_illust_${prefix}`
        );


    if (
        !checkbox ||
        !wrapper
    ) {

        return;

    }


    wrapper.style.display =
        checkbox.checked
            ? "block"
            : "none";


    calcTotal();

}


// ============================================================
// イラストの絵柄・範囲表示
// ============================================================

function updateIllust(prefix) {

    const eshi2 =
        document.querySelector(
            `input[name="eshi_${prefix}"][value="2"]`
        );


    const eshiArea =
        document.getElementById(
            `eshi2_area_${prefix}`
        );


    if (
        !eshi2 ||
        !eshiArea
    ) {

        return;

    }


    eshiArea.style.display =
        eshi2.checked
            ? "block"
            : "none";


    if (!eshi2.checked) {

        calcTotal();

        return;

    }


    const style =
        document.querySelector(
            `input[name="style_${prefix}"]:checked`
        );


    if (!style) {

        calcTotal();

        return;

    }


    const rangeArea =
        document.getElementById(
            `range_area_${prefix}`
        );


    if (rangeArea) {

        rangeArea.style.display =
            "block";

    }


    const faceLabel =
        document.getElementById(
            `lbl_face_${prefix}`
        );


    const chestLabel =
        document.getElementById(
            `lbl_chest_${prefix}`
        );


    const kneeLabel =
        document.getElementById(
            `lbl_knee_${prefix}`
        );


    const fullLabel =
        document.getElementById(
            `lbl_full_${prefix}`
        );


    const labels = {
        face: faceLabel,
        chest: chestLabel,
        knee: kneeLabel,
        full: fullLabel
    };


    // --------------------------------------------------------
    // 一旦すべて非表示
    // --------------------------------------------------------

    Object.values(labels)
        .forEach(label => {

            if (label) {

                label.style.display =
                    "none";

            }

        });


    let prices = {};


    // --------------------------------------------------------
    // 通常
    // --------------------------------------------------------

    if (
        style.value === "normal"
    ) {

        prices = {
            chest: 1500,
            knee: 2500,
            full: 5000
        };

    }


    // --------------------------------------------------------
    // 簡易
    // --------------------------------------------------------

    else if (
        style.value === "simple"
    ) {

        prices = {
            chest: 1000,
            knee: 2000,
            full: 4000
        };

    }


    // --------------------------------------------------------
    // デフォルメ
    // --------------------------------------------------------

    else if (
        style.value === "deform"
    ) {

        prices = {
            face: 500,
            full: 2000
        };

    }


    // --------------------------------------------------------
    // 必要な範囲だけ表示
    // --------------------------------------------------------

    Object.entries(prices)
        .forEach(
            ([range, price]) => {

                const label =
                    labels[range];


                if (label) {

                    label.style.display =
                        "inline";

                }


                const priceElement =
                    document.getElementById(
                        `price_${range}_${prefix}`
                    );


                if (priceElement) {

                    priceElement.textContent =
                        `${price.toLocaleString()}円`;

                }

            }
        );


    // --------------------------------------------------------
    // 非表示になった選択肢のチェックを解除
    // --------------------------------------------------------

    Object.entries(labels)
        .forEach(
            ([range, label]) => {

                if (!label) {

                    return;

                }


                if (
                    !Object.prototype.hasOwnProperty.call(
                        prices,
                        range
                    )
                ) {

                    const input =
                        label.querySelector(
                            "input"
                        );


                    if (input) {

                        input.checked =
                            false;

                    }

                }

            }
        );


    calcTotal();

}


// ============================================================
// イラスト料金を取得
//
// イラストには割引を適用しない
// ============================================================

function getIllustPrice(prefix) {

    const wrapper =
        document.getElementById(
            `wrap_illust_${prefix}`
        );


    if (!wrapper) {

        return 0;

    }


    // main以外は追加依頼チェックを確認
    if (
        prefix !== "main" &&
        wrapper.style.display === "none"
    ) {

        return 0;

    }


    const eshi =
        document.querySelector(
            `input[name="eshi_${prefix}"]:checked`
        );


    const style =
        document.querySelector(
            `input[name="style_${prefix}"]:checked`
        );


    const range =
        document.querySelector(
            `input[name="range_${prefix}"]:checked`
        );


    if (
        !eshi ||
        eshi.value !== "2" ||
        !style ||
        !range
    ) {

        return 0;

    }


    const priceTable = {

        normal: {

            chest: 1500,
            knee: 2500,
            full: 5000

        },


        simple: {

            chest: 1000,
            knee: 2000,
            full: 4000

        },


        deform: {

            face: 500,
            full: 2000

        }

    };


    return (
        priceTable[style.value]?.[
            range.value
        ] || 0
    );

}


// ============================================================
// イラスト内容を文章化
// ============================================================

function getIllustDescription(prefix) {

    const style =
        document.querySelector(
            `input[name="style_${prefix}"]:checked`
        );


    const range =
        document.querySelector(
            `input[name="range_${prefix}"]:checked`
        );


    if (
        !style ||
        !range
    ) {

        return "";

    }


    return (
        `絵師2 / ` +
        `${style.dataset.label} / ` +
        `${range.dataset.label}`
    );

}


// ============================================================
// MIX料金計算
// ============================================================

function calculateMix() {

    let price = 0;

    const lines = [];


    // --------------------------------------------------------
    // 基本料金
    // --------------------------------------------------------

    const base =
        document.querySelector(
            'input[name="mix_base"]:checked'
        );


    if (base) {

        const users =
            Math.max(
                1,
                parseInt(
                    document.getElementById(
                        "mix_users"
                    ).value,
                    10
                ) || 1
            );


        const basePrice =
            parseInt(
                base.value,
                10
            );


        price +=
            basePrice * users;


        lines.push(
            `・基本料金: ${base.dataset.label} × ${users}人`
        );


        // ----------------------------------------------------
        // ハモリ
        // ----------------------------------------------------

        const harm =
            document.querySelector(
                'input[name="mix_harm"]:checked'
            );


        if (harm) {

            const harmPrice =
                parseInt(
                    harm.value,
                    10
                );


            price +=
                harmPrice;


            if (
                harmPrice > 0
            ) {

                lines.push(
                    `・ハモリ: ${harm.dataset.label} (+${harmPrice.toLocaleString()}円)`
                );

            } else {

                lines.push(
                    `・ハモリ: ${harm.dataset.label}`
                );

            }

        }


        // ----------------------------------------------------
        // 通常オプション
        // ----------------------------------------------------

        document
            .querySelectorAll(
                ".mix-opt:checked"
            )
            .forEach(option => {

                const optionPrice =
                    parseInt(
                        option.value,
                        10
                    );


                price +=
                    optionPrice;


                lines.push(
                    `・オプション: ${option.dataset.label} (+${optionPrice.toLocaleString()}円)`
                );

            });


        // ----------------------------------------------------
        // エンコード
        //
        // 各メニュー独立方式のため
        // MIX単体では通常料金
        // ----------------------------------------------------

        const encode =
            document.getElementById(
                "opt_mix_encode"
            );


        if (
            encode &&
            encode.checked
        ) {

            const encodePrice =
                parseInt(
                    encode.value,
                    10
                );


            price +=
                encodePrice;


            lines.push(
                `・オプション: エンコード (+${encodePrice.toLocaleString()}円)`
            );

        }

    }


    return {

        discountable: price,

        illust: 0,

        lines

    };

}


// ============================================================
// MV料金計算
// ============================================================

function calculateMv() {

    let discountable = 0;

    let illust = 0;

    const lines = [];


    // --------------------------------------------------------
    // 動画尺
    // --------------------------------------------------------

    const length =
        document.querySelector(
            'input[name="mv_length"]:checked'
        );


    if (length) {

        discountable +=
            parseInt(
                length.value,
                10
            );


        lines.push(
            `・動画尺: ${length.dataset.label}`
        );

    }


    // --------------------------------------------------------
    // MV構成
    // --------------------------------------------------------

    const config =
        document.querySelector(
            'input[name="mv_config"]:checked'
        );


    if (config) {

        discountable +=
            parseInt(
                config.value,
                10
            );


        lines.push(
            `・MV構成: ${config.dataset.label}`
        );

    }


    // --------------------------------------------------------
    // イラスト追加
    // --------------------------------------------------------

    const checkbox =
        document.getElementById(
            "chk_illust_mv"
        );


    if (
        checkbox &&
        checkbox.checked
    ) {

        illust =
            getIllustPrice(
                "mv"
            );


        if (
            illust > 0
        ) {

            lines.push(
                `・イラスト追加: ${getIllustDescription("mv")} (+${illust.toLocaleString()}円)`
            );

        }

    }


    return {

        discountable,

        illust,

        lines

    };

}


// ============================================================
// 動画料金計算
// ============================================================

function calculateMovie() {

    let discountable = 0;

    let illust = 0;

    const lines = [];


    // --------------------------------------------------------
    // 動画尺
    // --------------------------------------------------------

    const minuteElement =
        document.getElementById(
            "movie_min"
        );


    const secondElement =
        document.getElementById(
            "movie_sec"
        );


    const minutes =
        parseInt(
            minuteElement.value,
            10
        );


    const seconds =
        parseInt(
            secondElement.value,
            10
        ) || 0;


    if (
        !Number.isNaN(
            minutes
        )
    ) {

        let movieBasePrice = 0;


        // 3分未満
        if (
            minutes < 3
        ) {

            movieBasePrice =
                1500;

        }


        // 3分以上8分未満
        else if (
            minutes < 8
        ) {

            movieBasePrice =
                minutes * 400;

        }


        // 8分以上30分未満
        else if (
            minutes < 30
        ) {

            movieBasePrice =
                minutes * 500;

        }


        // 30分以上
        else {

            movieBasePrice =
                minutes * 1000;

        }


        discountable +=
            movieBasePrice;


        lines.push(
            `・動画尺: ${minutes}分${seconds}秒`
        );

    }


    // --------------------------------------------------------
    // 素材数
    // --------------------------------------------------------

    const materialCount =
        document.getElementById(
            "movie_mat"
        ).value;


    if (materialCount) {

        lines.push(
            `・素材数: ${materialCount}`
        );

    }


    // --------------------------------------------------------
    // カット
    // --------------------------------------------------------

    const cut =
        document.querySelector(
            'input[name="movie_cut"]:checked'
        );


    if (cut) {

        const cutPrice =
            parseInt(
                cut.value,
                10
            );


        discountable +=
            cutPrice;


        lines.push(
            `・カット: ${cut.dataset.label}`
        );

    }


    // --------------------------------------------------------
    // イラスト追加
    // --------------------------------------------------------

    const checkbox =
        document.getElementById(
            "chk_illust_movie"
        );


    if (
        checkbox &&
        checkbox.checked
    ) {

        illust =
            getIllustPrice(
                "movie"
            );


        if (
            illust > 0
        ) {

            lines.push(
                `・イラスト追加: ${getIllustDescription("movie")} (+${illust.toLocaleString()}円)`
            );

        }

    }


    return {

        discountable,

        illust,

        lines

    };

}


// ============================================================
// サムネイル料金計算
// ============================================================

function calculateThumb() {

    let discountable = 0;

    let illust = 0;

    const lines = [];


    // --------------------------------------------------------
    // セット
    // --------------------------------------------------------

    const set =
        document.querySelector(
            'input[name="thumb_set"]:checked'
        );


    if (set) {

        discountable +=
            parseInt(
                set.value,
                10
            );


        lines.push(
            `・セット: ${set.dataset.label}`
        );

    }


    // --------------------------------------------------------
    // イラスト追加
    // --------------------------------------------------------

    const checkbox =
        document.getElementById(
            "chk_illust_thumb"
        );


    if (
        checkbox &&
        checkbox.checked
    ) {

        illust =
            getIllustPrice(
                "thumb"
            );


        if (
            illust > 0
        ) {

            lines.push(
                `・イラスト追加: ${getIllustDescription("thumb")} (+${illust.toLocaleString()}円)`
            );

        }

    }


    return {

        discountable,

        illust,

        lines

    };

}


// ============================================================
// イラスト単体料金計算
// ============================================================

function calculateIllust() {

    const illust =
        getIllustPrice(
            "main"
        );


    const lines = [];


    if (
        illust > 0
    ) {

        lines.push(
            `・${getIllustDescription("main")}`
        );

    }


    return {

        discountable: 0,

        illust,

        lines

    };

}


// ============================================================
// 現在のタブだけを計算
// ============================================================

function calcTotal() {

    const currentTab = getCurrentTab();

    const rate = getDiscountRate();

    updatePriceTags();

    let result = {
        discountable: 0,
        illust: 0,
        lines: []
    };


    switch (currentTab) {

        case "mix":
            result = calculateMix();
            break;

        case "mv":
            result = calculateMv();
            break;

        case "movie":
            result = calculateMovie();
            break;

        case "thumb":
            result = calculateThumb();
            break;

        case "illust":
            result = calculateIllust();
            break;
    }


    // イラスト以外だけ割引
    const discountedPrice = Math.floor(
        result.discountable * rate
    );

    const finalTotal =
        discountedPrice + result.illust;


    document.getElementById(
        "display_price"
    ).textContent =
        `${finalTotal.toLocaleString()} 円`;


    updateSubmitButton(
        currentTab,
        finalTotal,
        result.lines
    );
}


// ============================================================
// メール送信ボタン
// ============================================================

function updateSubmitButton(
    currentTab,
    finalTotal,
    lines
) {

    const button =
        document.getElementById(
            "btn_submit"
        );


    if (!button) {

        return;

    }


    button.onclick = () => {


        const info =
            TAB_INFO[currentTab];


        const student =
            document.getElementById(
                "chk_student"
            );


        const first =
            document.getElementById(
                "chk_first"
            );


        const isStudent =
            student
                ? student.checked
                : false;


        const isFirst =
            first
                ? first.checked
                : false;


        let textBody =
            "【お見積り依頼内容】\n\n";


        // ----------------------------------------------------
        // 現在開いているメニューのみ
        // ----------------------------------------------------

        textBody +=
            `■ ${info.mailTitle}\n`;


        if (
            lines.length > 0
        ) {

            textBody +=
                lines.join("\n");

            textBody +=
                "\n";

        } else {

            textBody +=
                "・未選択\n";

        }


        // ----------------------------------------------------
        // 割引情報
        // ----------------------------------------------------

        textBody +=
            "\n■ 割引\n";


        if (
            isStudent &&
            isFirst
        ) {

            textBody +=
                "・学生料金 50%OFF\n";

            textBody +=
                "・初回利用者 20%OFF\n";

            textBody +=
                "・同時適用：合計60%OFF\n";

        }


        else if (
            isStudent
        ) {

            textBody +=
                "・学生料金 50%OFF\n";

        }


        else if (
            isFirst
        ) {

            textBody +=
                "・初回利用者 20%OFF\n";

        }


        else {

            textBody +=
                "・なし\n";

        }


        // ----------------------------------------------------
        // 合計
        // ----------------------------------------------------

        textBody +=
            "\n【お見積り合計金額】: " +
            `${finalTotal.toLocaleString()} 円\n\n` +
            "よろしくお願いいたします。";


        // ----------------------------------------------------
        // メール画面を開く
        // ----------------------------------------------------

        const subject =
            "お見積り・依頼のご相談";


        window.location.href =
            `mailto:?subject=${encodeURIComponent(subject)}` +
            `&body=${encodeURIComponent(textBody)}`;

    };

}
