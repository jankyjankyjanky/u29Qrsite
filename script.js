// ============================================================
// u29Qr（うにくる）お見積りサイト
// JavaScript
// ============================================================

// ------------------------------------------------------------
// 初期設定とイベントバインド
// ------------------------------------------------------------
window.onload = () => {
    // イラストフォームのテンプレートを各場所に展開
    const prefixes = ['main', 'mv', 'movie', 'thumb'];
    const tmpl = document.getElementById('tmpl_illust').innerHTML;

    prefixes.forEach(prefix => {
        const wrap = document.getElementById(`wrap_illust_${prefix}`);

        if (wrap) {
            wrap.innerHTML = tmpl.replace(/PREFIX/g, prefix);
        }
    });

    // すべての入力要素の変更を監視
    document.addEventListener('change', calcTotal);
    document.addEventListener('input', calcTotal);

    // 初期タブの切り替え
    switchTab();

    // 初期料金表示を更新
    calcTotal();
};


// ------------------------------------------------------------
// タブ切り替え処理
// ------------------------------------------------------------
function switchTab() {
    const tabRadio = document.querySelector(
        'input[name="main_tab"]:checked'
    );

    if (!tabRadio) {
        return;
    }

    const selectedTab = tabRadio.value;

    const sections = [
        'sec_mix',
        'sec_mv',
        'sec_movie',
        'sec_thumb',
        'sec_illust'
    ];

    // すべて非表示
    sections.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.style.display = 'none';
        }
    });

    // 選択されたタブだけ表示
    const targetElement = document.getElementById(
        `sec_${selectedTab}`
    );

    if (targetElement) {
        targetElement.style.display = 'block';
    }
}


// ------------------------------------------------------------
// イラスト追加フォームの表示・非表示
// ------------------------------------------------------------
function toggleIllust(prefix) {
    const wrap = document.getElementById(`wrap_illust_${prefix}`);
    const checkbox = document.getElementById(`chk_illust_${prefix}`);

    if (!wrap || !checkbox) {
        return;
    }

    wrap.style.display = checkbox.checked ? 'block' : 'none';
}


// ------------------------------------------------------------
// 絵柄に応じた立ち絵範囲の切り替え
// ------------------------------------------------------------
function updateIllust(prefix) {
    const eshi2 = document.querySelector(
        `input[name="eshi_${prefix}"][value="2"]`
    );

    const eshi2Area = document.getElementById(
        `eshi2_area_${prefix}`
    );

    if (!eshi2 || !eshi2Area) {
        return;
    }

    eshi2Area.style.display = eshi2.checked
        ? 'block'
        : 'none';

    const styleObj = document.querySelector(
        `input[name="style_${prefix}"]:checked`
    );

    if (!styleObj) {
        return;
    }

    const rangeArea = document.getElementById(
        `range_area_${prefix}`
    );

    if (rangeArea) {
        rangeArea.style.display = 'block';
    }

    const style = styleObj.value;

    const labelFace = document.getElementById(
        `lbl_face_${prefix}`
    );

    const labelChest = document.getElementById(
        `lbl_chest_${prefix}`
    );

    const labelKnee = document.getElementById(
        `lbl_knee_${prefix}`
    );

    const labelFull = document.getElementById(
        `lbl_full_${prefix}`
    );

    if (
        !labelFace ||
        !labelChest ||
        !labelKnee ||
        !labelFull
    ) {
        return;
    }

    // すべて一旦非表示
    labelFace.style.display = 'none';
    labelChest.style.display = 'none';
    labelKnee.style.display = 'none';
    labelFull.style.display = 'none';

    // 通常
    if (style === 'normal') {
        labelChest.style.display = 'inline';
        document.getElementById(
            `price_chest_${prefix}`
        ).innerText = '1500円';

        labelKnee.style.display = 'inline';
        document.getElementById(
            `price_knee_${prefix}`
        ).innerText = '2500円';

        labelFull.style.display = 'inline';
        document.getElementById(
            `price_full_${prefix}`
        ).innerText = '5000円';

        const faceInput = labelFace.querySelector('input');

        if (faceInput && faceInput.checked) {
            faceInput.checked = false;
        }
    }

    // 簡易
    else if (style === 'simple') {
        labelChest.style.display = 'inline';
        document.getElementById(
            `price_chest_${prefix}`
        ).innerText = '1000円';

        labelKnee.style.display = 'inline';
        document.getElementById(
            `price_knee_${prefix}`
        ).innerText = '2000円';

        labelFull.style.display = 'inline';
        document.getElementById(
            `price_full_${prefix}`
        ).innerText = '4000円';

        const faceInput = labelFace.querySelector('input');

        if (faceInput && faceInput.checked) {
            faceInput.checked = false;
        }
    }

    // デフォルメ
    else if (style === 'deform') {
        labelFace.style.display = 'inline';
        document.getElementById(
            `price_face_${prefix}`
        ).innerText = '500円';

        labelFull.style.display = 'inline';
        document.getElementById(
            `price_full_${prefix}`
        ).innerText = '2000円';

        const chestInput = labelChest.querySelector('input');
        const kneeInput = labelKnee.querySelector('input');

        if (chestInput && chestInput.checked) {
            chestInput.checked = false;
        }

        if (kneeInput && kneeInput.checked) {
            kneeInput.checked = false;
        }
    }
}


// ------------------------------------------------------------
// 割引率を取得
// ------------------------------------------------------------
function getDiscountRate() {
    const studentCheckbox = document.getElementById(
        'chk_student'
    );

    const firstCheckbox = document.getElementById(
        'chk_first'
    );

    const isStudent = studentCheckbox
        ? studentCheckbox.checked
        : false;

    const isFirst = firstCheckbox
        ? firstCheckbox.checked
        : false;

    // 学割 + 初回利用
    if (isStudent && isFirst) {
        return 0.4;
    }

    // 学割のみ
    if (isStudent) {
        return 0.5;
    }

    // 初回利用のみ
    if (isFirst) {
        return 0.8;
    }

    // 割引なし
    return 1.0;
}


// ------------------------------------------------------------
// 画面上の料金表示を割引後の金額に更新
//
// ※ イラスト料金は割引対象外なので除外
// ------------------------------------------------------------
function updatePriceTags(rate) {
    const priceTags = document.querySelectorAll(
        '.price-tag'
    );

    priceTags.forEach(tag => {
        // イラストフォーム内の料金は割引しない
        if (tag.closest('.illust-sub-form')) {
            return;
        }

        // 初回だけ通常価格を保存
        if (!tag.dataset.originalPrice) {
            const match = tag.textContent.match(
                /[+＋]?\s*[\d,]+/
            );

            if (!match) {
                return;
            }

            tag.dataset.originalPrice = match[0]
                .replace(/,/g, '')
                .replace(/[＋]/g, '+')
                .trim();
        }

        const originalPriceText =
            tag.dataset.originalPrice;

        const hasPlus =
            originalPriceText.startsWith('+');

        const originalPrice =
            parseInt(
                originalPriceText.replace('+', ''),
                10
            );

        if (Number.isNaN(originalPrice)) {
            return;
        }

        // 割引後価格
        const discountedPrice = Math.floor(
            originalPrice * rate
        );

        const prefix = hasPlus ? '+' : '';

        tag.textContent =
            `${prefix}${discountedPrice.toLocaleString()}円`;
    });
}


// ------------------------------------------------------------
// メインの計算処理
// ------------------------------------------------------------
function calcTotal() {
    let totalDiscountable = 0;
    let totalIllust = 0;

    let textBody =
        '【お見積り依頼内容】\n\n';

    // --------------------------------------------------------
    // 割引計算
    // --------------------------------------------------------
    const isStudent =
        document.getElementById('chk_student').checked;

    const isFirst =
        document.getElementById('chk_first').checked;

    const rate = getDiscountRate();

    // ★ 画面上の価格表示も同じ割引率に更新
    updatePriceTags(rate);

    textBody += '■ 基本設定\n';

    if (isStudent) {
        textBody += '・学割適用あり\n';
    }

    if (isFirst) {
        textBody += '・初回利用者\n';
    }

    textBody += '\n';


    // --------------------------------------------------------
    // 1. MIX
    // --------------------------------------------------------
    let mixPrice = 0;

    const mixBase = document.querySelector(
        'input[name="mix_base"]:checked'
    );

    if (mixBase) {
        const users =
            parseInt(
                document.getElementById('mix_users').value,
                10
            ) || 1;

        mixPrice +=
            parseInt(mixBase.value, 10) * users;

        textBody +=
            `■ MIX予算\n` +
            `・基本料金: ${mixBase.dataset.label} ` +
            `(x${users}人)\n`;

        const mixHarm = document.querySelector(
            'input[name="mix_harm"]:checked'
        );

        if (mixHarm) {
            const harmValue =
                parseInt(mixHarm.value, 10);

            if (harmValue > 0) {
                mixPrice += harmValue;

                textBody +=
                    `・ハモリ: ${mixHarm.dataset.label} ` +
                    `(+${harmValue}円)\n`;
            } else {
                textBody +=
                    `・ハモリ: ${mixHarm.dataset.label}\n`;
            }
        }

        document
            .querySelectorAll('.mix-opt:checked')
            .forEach(option => {
                mixPrice +=
                    parseInt(option.value, 10);

                textBody +=
                    `・オプション: ` +
                    `${option.dataset.label}\n`;
            });
    }


    // --------------------------------------------------------
    // 2. MV
    // --------------------------------------------------------
    let mvPrice = 0;

    const mvLength = document.querySelector(
        'input[name="mv_length"]:checked'
    );

    if (mvLength) {
        mvPrice +=
            parseInt(mvLength.value, 10);

        textBody +=
            `■ MV予算\n` +
            `・動画尺: ${mvLength.dataset.label}\n`;
    }

    const mvConfig = document.querySelector(
        'input[name="mv_config"]:checked'
    );

    if (mvConfig) {
        mvPrice +=
            parseInt(mvConfig.value, 10);

        textBody +=
            `・MV構成: ${mvConfig.dataset.label}\n`;
    }


    // --------------------------------------------------------
    // MIXのエンコード無料判定
    // MV依頼がある場合はエンコード無料
    // --------------------------------------------------------
    const encodeCheckbox =
        document.getElementById('opt_mix_encode');

    if (
        encodeCheckbox &&
        encodeCheckbox.checked
    ) {
        if (mvPrice > 0) {
            textBody +=
                '・オプション: エンコード ' +
                '(MV同時依頼のため無料)\n';
        } else {
            mixPrice += 1000;

            textBody +=
                '・オプション: エンコード ' +
                '(+1000円)\n';
        }
    }

    totalDiscountable +=
        mixPrice + mvPrice;


    // --------------------------------------------------------
    // 3. 動画編集
    // --------------------------------------------------------
    let moviePrice = 0;

    const movieMin =
        parseInt(
            document.getElementById('movie_min').value,
            10
        );

    const movieSec =
        parseInt(
            document.getElementById('movie_sec').value,
            10
        ) || 0;

    if (!Number.isNaN(movieMin)) {
        let price = 0;

        if (movieMin < 3) {
            price = 1500;
        } else if (movieMin < 8) {
            price = movieMin * 400;
        } else if (movieMin < 30) {
            price = movieMin * 500;
        } else {
            price = movieMin * 1000;
        }

        moviePrice += price;

        textBody +=
            `■ 動画編集\n` +
            `・動画尺: ${movieMin}分${movieSec}秒\n`;
    }

    const movieCut = document.querySelector(
        'input[name="movie_cut"]:checked'
    );

    if (movieCut) {
        moviePrice +=
            parseInt(movieCut.value, 10);

        textBody +=
            `・カット: ${movieCut.dataset.label}\n`;
    }

    const movieMaterial =
        document.getElementById('movie_mat').value;

    if (
        movieMaterial &&
        !Number.isNaN(movieMin)
    ) {
        textBody +=
            `・素材数: ${movieMaterial}\n`;
    }

    totalDiscountable += moviePrice;


    // --------------------------------------------------------
    // 4. サムネイル
    // --------------------------------------------------------
    let thumbPrice = 0;

    const thumbSet = document.querySelector(
        'input[name="thumb_set"]:checked'
    );

    if (thumbSet) {
        thumbPrice +=
            parseInt(thumbSet.value, 10);

        textBody +=
            `■ サムネイル\n` +
            `・セット: ${thumbSet.dataset.label}\n`;
    }

    totalDiscountable += thumbPrice;


    // --------------------------------------------------------
    // 5. イラスト
    //
    // イラストは割引対象外
    // --------------------------------------------------------
    const calcIllust = (prefix, title) => {
        const wrap =
            document.getElementById(
                `wrap_illust_${prefix}`
            );

        if (
            !wrap ||
            wrap.style.display === 'none'
        ) {
            return 0;
        }

        const eshi = document.querySelector(
            `input[name="eshi_${prefix}"]:checked`
        );

        const style = document.querySelector(
            `input[name="style_${prefix}"]:checked`
        );

        const range = document.querySelector(
            `input[name="range_${prefix}"]:checked`
        );

        if (
            eshi &&
            eshi.value === '2' &&
            style &&
            range
        ) {
            let price = 0;

            const styleValue = style.value;
            const rangeValue = range.value;

            if (styleValue === 'normal') {
                if (rangeValue === 'chest') {
                    price = 1500;
                }

                if (rangeValue === 'knee') {
                    price = 2500;
                }

                if (rangeValue === 'full') {
                    price = 5000;
                }
            }

            else if (styleValue === 'simple') {
                if (rangeValue === 'chest') {
                    price = 1000;
                }

                if (rangeValue === 'knee') {
                    price = 2000;
                }

                if (rangeValue === 'full') {
                    price = 4000;
                }
            }

            else if (styleValue === 'deform') {
                if (rangeValue === 'face') {
                    price = 500;
                }

                if (rangeValue === 'full') {
                    price = 2000;
                }
            }

            if (price > 0) {
                textBody +=
                    `■ ${title}\n` +
                    `・絵師2 / ` +
                    `${style.dataset.label} / ` +
                    `${range.dataset.label}\n`;
            }

            return price;
        }

        return 0;
    };


    totalIllust +=
        calcIllust(
            'main',
            'イラスト単体'
        );

    if (
        document.getElementById(
            'chk_illust_mv'
        ).checked
    ) {
        totalIllust +=
            calcIllust(
                'mv',
                'イラスト追加(MV)'
            );
    }

    if (
        document.getElementById(
            'chk_illust_movie'
        ).checked
    ) {
        totalIllust +=
            calcIllust(
                'movie',
                'イラスト追加(動画)'
            );
    }

    if (
        document.getElementById(
            'chk_illust_thumb'
        ).checked
    ) {
        totalIllust +=
            calcIllust(
                'thumb',
                'イラスト追加(サムネ)'
            );
    }


    // --------------------------------------------------------
    // 最終計算
    // --------------------------------------------------------
    const finalTotal =
        Math.floor(
            totalDiscountable * rate
        ) + totalIllust;


    // --------------------------------------------------------
    // 画面表示
    // --------------------------------------------------------
    document.getElementById(
        'display_price'
    ).innerText =
        finalTotal.toLocaleString() + ' 円';


    // --------------------------------------------------------
    // メール本文
    // --------------------------------------------------------
    textBody +=
        `\n【お見積り合計金額】: ` +
        `${finalTotal.toLocaleString()} 円\n\n` +
        'よろしくお願いいたします。';


    // --------------------------------------------------------
    // 依頼ボタン
    // --------------------------------------------------------
    document.getElementById(
        'btn_submit'
    ).onclick = () => {
        window.location.href =
            `mailto:?subject=${encodeURIComponent(
                'お見積り・依頼のご相談'
            )}&body=${encodeURIComponent(
                textBody
            )}`;
    };
}
