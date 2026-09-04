const ALLOWED_ORIGINS = [
    "https://jankyjankyjanky.github.io"
];

const SERVICE_KEYS = [
    "mix",
    "mv",
    "movie",
    "illust",
    "set"
];

const SET_PLAN_REQUIREMENTS = {
    mix_mv: ["mix", "mv"],
    mv_illust: ["mv", "illust"],
    movie_illust: ["movie", "illust"],
    mix_mv_illust: ["mix", "mv", "illust"]
};


const REQUEST_STATUSES = [
    "new",
    "checked",
    "in_progress",
    "completed",
    "cancelled",
    "archived"
];

const TURNSTILE_EXPECTED_HOSTNAME =
    "jankyjankyjanky.github.io";

const TURNSTILE_EXPECTED_ACTION =
    "submit_request";

const ADMIN_PAGE_URL =
    "https://jankyjankyjanky.github.io/u29Qrsite/admin.html";

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        const corsHeaders = {
            "Access-Control-Allow-Origin":
                ALLOWED_ORIGINS.includes(origin)
                    ? origin
                    : ALLOWED_ORIGINS[0],

            "Access-Control-Allow-Methods":
                "GET, POST, PUT, PATCH, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type, Authorization",

            "Vary":
                "Origin"
        };

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        const url = new URL(request.url);

        if (
            request.method === "GET" &&
            url.pathname === "/"
        ) {
            return Response.json({
                ok: true,
                service: "Nazuna Request API"
            });
        }


        // ====================================================
        // 公開: 受付状況
        // ====================================================

        if (
            request.method === "GET" &&
            url.pathname === "/api/public/settings"
        ) {
            const settings = await getServiceSettings(env);

            return jsonResponse(
                {
                    ok: true,
                    settings,
                    setPlans:
                        getSetPlanSettings(settings)
                },
                200,
                corsHeaders
            );
        }


        // ====================================================
        // 公開: 依頼送信
        // ====================================================

        if (
            request.method === "POST" &&
            url.pathname === "/api/requests"
        ) {
            try {
                if (
                    origin &&
                    !ALLOWED_ORIGINS.includes(origin)
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "許可されていないサイトです。"
                        },
                        403,
                        corsHeaders
                    );
                }

                const body = await request.json();
                const data = body?.request;

                const turnstileToken =
                    clean(
                        body?.turnstileToken,
                        2048
                    );

                const turnstileResult =
                    await verifyTurnstile(
                        env,
                        turnstileToken,
                        request
                    );

                if (!turnstileResult.ok) {
                    return jsonResponse(
                        {
                            ok: false,
                            error:
                                "セキュリティ確認に失敗しました。ページを再読み込みしてもう一度お試しください。"
                        },
                        403,
                        corsHeaders
                    );
                }

                if (
                    !data ||
                    typeof data !== "object"
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼データがありません。"
                        },
                        400,
                        corsHeaders
                    );
                }

                if (
                    String(
                        data?.antiSpam?.website || ""
                    ).trim() !== ""
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "送信できませんでした。"
                        },
                        403,
                        corsHeaders
                    );
                }

                const applicant =
                    data.applicant || {};

                const estimate =
                    data.estimate || {};

                const serviceKey =
                    clean(estimate.tab, 30);

                if (
                    !SERVICE_KEYS.includes(serviceKey)
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼区分が正しくありません。"
                        },
                        400,
                        corsHeaders
                    );
                }

                const settings =
                    await getServiceSettings(env);

                if (
                    settings[serviceKey] === false
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "現在、この依頼は受付停止中です。"
                        },
                        409,
                        corsHeaders
                    );
                }

                if (serviceKey === "set") {
                    const planKey =
                        clean(
                            estimate?.set?.planKey,
                            50
                        );

                    const requirements =
                        SET_PLAN_REQUIREMENTS[planKey];

                    if (!requirements) {
                        return jsonResponse(
                            {
                                ok: false,
                                error: "セット内容が正しくありません。"
                            },
                            400,
                            corsHeaders
                        );
                    }

                    const stoppedComponents =
                        requirements.filter(
                            key =>
                                settings[key] === false
                        );

                    if (
                        stoppedComponents.length > 0
                    ) {
                        return jsonResponse(
                            {
                                ok: false,
                                error:
                                    "このセットに含まれるサービスが現在受付停止中です。"
                            },
                            409,
                            corsHeaders
                        );
                    }
                }

                const activityName =
                    clean(applicant.activityName, 100);

                const contactMethod =
                    clean(applicant.contactMethod, 30);

                const contactValue =
                    clean(applicant.contactValue, 200);

                if (
                    !activityName ||
                    !contactMethod ||
                    !contactValue
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼者情報が不足しています。"
                        },
                        400,
                        corsHeaders
                    );
                }

                const total =
                    Number(estimate.finalTotal);

                if (
                    !Number.isFinite(total) ||
                    total < 0 ||
                    total > 10000000
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "見積り金額が正しくありません。"
                        },
                        400,
                        corsHeaders
                    );
                }

                const result =
                    await env.DB
                        .prepare(`
                            INSERT INTO requests (
                                activity_name,
                                contact_method,
                                contact_value,
                                deadline,
                                public_date,
                                materials_url,
                                reference_url,
                                notes,
                                estimate_tab,
                                estimate_category,
                                estimate_total,
                                request_json
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `)
                        .bind(
                            activityName,
                            contactMethod,
                            contactValue,

                            clean(
                                applicant.deadline,
                                30
                            ),

                            clean(
                                applicant.publicDate,
                                30
                            ),

                            clean(
                                applicant.materialsUrl,
                                2000
                            ),

                            clean(
                                applicant.referenceUrl,
                                2000
                            ),

                            clean(
                                applicant.notes,
                                5000
                            ),

                            serviceKey,

                            clean(
                                estimate.category,
                                100
                            ),

                            Math.floor(total),

                            JSON.stringify(data)
                        )
                        .run();

                const id =
                    result.meta.last_row_id;

                const requestId =
                    `NZ-${String(id).padStart(6, "0")}`;

                await env.DB
                    .prepare(`
                        UPDATE requests
                        SET request_id = ?
                        WHERE id = ?
                    `)
                    .bind(
                        requestId,
                        id
                    )
                    .run();

                let discordNotified = false;

                if (
                    env.DISCORD_BOT_TOKEN &&
                    env.DISCORD_USER_ID
                ) {
                    try {
                        await sendDiscordNotification(
                            env,
                            requestId,
                            {
                                activityName,
                                category:
                                    clean(
                                        estimate.category,
                                        100
                                    ),
                                total:
                                    Math.floor(total),
                                deadline:
                                    clean(
                                        applicant.deadline,
                                        30
                                    )
                            }
                        );

                        discordNotified = true;

                        await env.DB
                            .prepare(`
                                UPDATE requests
                                SET discord_notified = 1
                                WHERE id = ?
                            `)
                            .bind(id)
                            .run();

                    } catch (error) {
                        console.error(
                            "Discord notification error:",
                            error
                        );
                    }
                }

                return jsonResponse(
                    {
                        ok: true,
                        requestId
                    },
                    200,
                    corsHeaders
                );

            } catch (error) {
                console.error(error);

                return jsonResponse(
                    {
                        ok: false,
                        error:
                            "依頼の保存中にエラーが発生しました。"
                    },
                    500,
                    corsHeaders
                );
            }
        }


        // ====================================================
        // 管理者API
        // ====================================================

        if (url.pathname.startsWith("/api/admin/")) {
            if (!isAdmin(request, env)) {
                return jsonResponse(
                    {
                        ok: false,
                        error: "管理者認証が必要です。"
                    },
                    401,
                    corsHeaders
                );
            }


            // 受付設定一覧
            if (
                request.method === "GET" &&
                url.pathname === "/api/admin/settings"
            ) {
                const settings =
                    await getServiceSettings(env);

                return jsonResponse(
                    {
                        ok: true,
                        settings
                    },
                    200,
                    corsHeaders
                );
            }


            // 受付設定変更
            const settingMatch =
                url.pathname.match(
                    /^\/api\/admin\/settings\/([^/]+)$/
                );

            if (
                request.method === "PUT" &&
                settingMatch
            ) {
                const key =
                    decodeURIComponent(settingMatch[1]);

                if (!SERVICE_KEYS.includes(key)) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "対象の依頼区分が正しくありません。"
                        },
                        400,
                        corsHeaders
                    );
                }

                const body =
                    await request.json();

                const accepting =
                    Boolean(body?.accepting);

                await env.DB
                    .prepare(`
                        INSERT INTO service_settings (
                            service_key,
                            label,
                            accepting,
                            updated_at
                        )
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(service_key)
                        DO UPDATE SET
                            accepting = excluded.accepting,
                            updated_at = CURRENT_TIMESTAMP
                    `)
                    .bind(
                        key,
                        serviceLabel(key),
                        accepting ? 1 : 0
                    )
                    .run();

                return jsonResponse(
                    {
                        ok: true,
                        serviceKey: key,
                        accepting
                    },
                    200,
                    corsHeaders
                );
            }


            // 依頼一覧
            if (
                request.method === "GET" &&
                url.pathname === "/api/admin/requests"
            ) {
                const limit =
                    Math.min(
                        100,
                        Math.max(
                            1,
                            Number(
                                url.searchParams.get("limit") ||
                                50
                            )
                        )
                    );

                const result =
                    await env.DB
                        .prepare(`
                            SELECT
                                id,
                                request_id,
                                status,
                                activity_name,
                                estimate_category,
                                estimate_total,
                                discord_notified,
                                created_at
                            FROM requests
                            ORDER BY id DESC
                            LIMIT ?
                        `)
                        .bind(limit)
                        .all();

                return jsonResponse(
                    {
                        ok: true,
                        requests:
                            result.results || []
                    },
                    200,
                    corsHeaders
                );
            }


            // 依頼ステータス変更
            const statusMatch =
                url.pathname.match(
                    /^\/api\/admin\/requests\/([^/]+)\/status$/
                );

            if (
                request.method === "PATCH" &&
                statusMatch
            ) {
                const requestId =
                    decodeURIComponent(statusMatch[1]);

                const body =
                    await request.json();

                const status =
                    clean(body?.status, 30);

                if (
                    !REQUEST_STATUSES.includes(status)
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "進行状況が正しくありません。"
                        },
                        400,
                        corsHeaders
                    );
                }

                const updateResult =
                    await env.DB
                        .prepare(`
                            UPDATE requests
                            SET status = ?
                            WHERE request_id = ?
                        `)
                        .bind(
                            status,
                            requestId
                        )
                        .run();

                if (
                    !updateResult.meta.changes
                ) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼が見つかりません。"
                        },
                        404,
                        corsHeaders
                    );
                }

                return jsonResponse(
                    {
                        ok: true,
                        requestId,
                        status
                    },
                    200,
                    corsHeaders
                );
            }



            // 管理者メモ
            const noteMatch =
                url.pathname.match(
                    /^\/api\/admin\/requests\/([^/]+)\/note$/
                );

            if (
                request.method === "PUT" &&
                noteMatch
            ) {
                const requestId =
                    decodeURIComponent(noteMatch[1]);

                const body =
                    await request.json();

                const note =
                    clean(body?.note, 10000);

                const exists =
                    await env.DB
                        .prepare(`
                            SELECT request_id
                            FROM requests
                            WHERE request_id = ?
                            LIMIT 1
                        `)
                        .bind(requestId)
                        .first();

                if (!exists) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼が見つかりません。"
                        },
                        404,
                        corsHeaders
                    );
                }

                await env.DB
                    .prepare(`
                        INSERT INTO request_admin (
                            request_id,
                            admin_note,
                            updated_at
                        )
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(request_id)
                        DO UPDATE SET
                            admin_note = excluded.admin_note,
                            updated_at = CURRENT_TIMESTAMP
                    `)
                    .bind(
                        requestId,
                        note
                    )
                    .run();

                return jsonResponse(
                    {
                        ok: true,
                        requestId
                    },
                    200,
                    corsHeaders
                );
            }


            // 依頼詳細
            const detailMatch =
                url.pathname.match(
                    /^\/api\/admin\/requests\/([^/]+)$/
                );

            if (
                request.method === "GET" &&
                detailMatch
            ) {
                const requestId =
                    decodeURIComponent(detailMatch[1]);

                const item =
                    await env.DB
                        .prepare(`
                            SELECT
                                requests.*,
                                COALESCE(
                                    request_admin.admin_note,
                                    ''
                                ) AS admin_note
                            FROM requests
                            LEFT JOIN request_admin
                                ON request_admin.request_id =
                                   requests.request_id
                            WHERE requests.request_id = ?
                            LIMIT 1
                        `)
                        .bind(requestId)
                        .first();

                if (!item) {
                    return jsonResponse(
                        {
                            ok: false,
                            error: "依頼が見つかりません。"
                        },
                        404,
                        corsHeaders
                    );
                }

                return jsonResponse(
                    {
                        ok: true,
                        request: item
                    },
                    200,
                    corsHeaders
                );
            }
        }


        return jsonResponse(
            {
                ok: false,
                error: "Not Found"
            },
            404,
            corsHeaders
        );
    }
};



async function verifyTurnstile(
    env,
    token,
    request
) {
    if (
        !env.TURNSTILE_SECRET_KEY ||
        !token
    ) {
        return {
            ok: false,
            reason: "missing-secret-or-token"
        };
    }

    try {
        const response =
            await fetch(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({
                            secret:
                                env.TURNSTILE_SECRET_KEY,

                            response:
                                token,

                            remoteip:
                                request.headers.get(
                                    "CF-Connecting-IP"
                                ) || ""
                        })
                }
            );

        if (!response.ok) {
            console.error(
                "Turnstile Siteverify HTTP error:",
                response.status
            );

            return {
                ok: false,
                reason: "siteverify-http-error"
            };
        }

        const result =
            await response.json();

        if (!result.success) {
            console.warn(
                "Turnstile rejected token:",
                result["error-codes"] || []
            );

            return {
                ok: false,
                reason: "challenge-failed"
            };
        }

        if (
            result.hostname !==
            TURNSTILE_EXPECTED_HOSTNAME
        ) {
            console.warn(
                "Turnstile hostname mismatch:",
                result.hostname
            );

            return {
                ok: false,
                reason: "hostname-mismatch"
            };
        }

        if (
            result.action !==
            TURNSTILE_EXPECTED_ACTION
        ) {
            console.warn(
                "Turnstile action mismatch:",
                result.action
            );

            return {
                ok: false,
                reason: "action-mismatch"
            };
        }

        return {
            ok: true
        };

    } catch (error) {
        console.error(
            "Turnstile verification error:",
            error
        );

        return {
            ok: false,
            reason: "verification-error"
        };
    }
}


async function getServiceSettings(env) {
    const defaults = {
        mix: true,
        mv: true,
        movie: true,
        illust: true,
        set: true
    };

    try {
        const result =
            await env.DB
                .prepare(`
                    SELECT
                        service_key,
                        accepting
                    FROM service_settings
                `)
                .all();

        for (
            const row of result.results || []
        ) {
            if (
                SERVICE_KEYS.includes(
                    row.service_key
                )
            ) {
                defaults[row.service_key] =
                    Boolean(row.accepting);
            }
        }

    } catch (error) {
        // migration前でも公開サイトを壊さない
        console.warn(
            "service_settings unavailable:",
            error
        );
    }

    return defaults;
}



function getSetPlanSettings(settings) {
    const result = {};

    for (
        const [planKey, requirements]
        of Object.entries(SET_PLAN_REQUIREMENTS)
    ) {
        result[planKey] =
            settings.set !== false &&
            requirements.every(
                key => settings[key] !== false
            );
    }

    return result;
}

function isAdmin(request, env) {
    if (!env.ADMIN_TOKEN) {
        return false;
    }

    const auth =
        request.headers.get("Authorization") ||
        "";

    return auth ===
        `Bearer ${env.ADMIN_TOKEN}`;
}


function serviceLabel(key) {
    return {
        mix: "MIX",
        mv: "MV",
        movie: "動画編集",
        illust: "イラスト",
        set: "セット"
    }[key] || key;
}


function clean(value, maxLength) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength);
}


function jsonResponse(
    data,
    status,
    corsHeaders
) {
    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8",

                ...corsHeaders
            }
        }
    );
}


async function sendDiscordNotification(
    env,
    requestId,
    data
) {
    const dmResponse =
        await fetch(
            "https://discord.com/api/v10/users/@me/channels",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bot ${env.DISCORD_BOT_TOKEN}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    recipient_id:
                        env.DISCORD_USER_ID
                })
            }
        );

    if (!dmResponse.ok) {
        const errorText =
            await dmResponse.text();

        throw new Error(
            `Discord DM error: ${dmResponse.status} ${errorText}`
        );
    }

    const dm =
        await dmResponse.json();

    const messageResponse =
        await fetch(
            `https://discord.com/api/v10/channels/${dm.id}/messages`,
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bot ${env.DISCORD_BOT_TOKEN}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    content:
                        "📩 **新しい依頼が届きました**",

                    embeds: [
                        {
                            title:
                                requestId,

                            url:
                                `${ADMIN_PAGE_URL}?request=${encodeURIComponent(requestId)}`,

                            fields: [
                                {
                                    name: "依頼者",
                                    value:
                                        data.activityName ||
                                        "未入力",
                                    inline: true
                                },

                                {
                                    name: "依頼内容",
                                    value:
                                        data.category ||
                                        "未選択",
                                    inline: true
                                },

                                {
                                    name: "サイト見積り",
                                    value:
                                        `${data.total.toLocaleString("ja-JP")}円`,
                                    inline: true
                                },

                                {
                                    name: "希望納期",
                                    value:
                                        data.deadline ||
                                        "指定なし",
                                    inline: true
                                },

                                {
                                    name: "管理画面",
                                    value:
                                        `[この依頼を開く](${ADMIN_PAGE_URL}?request=${encodeURIComponent(requestId)})`,
                                    inline: false
                                }
                            ],

                            timestamp:
                                new Date().toISOString()
                        }
                    ],

                    allowed_mentions: {
                        parse: []
                    }
                })
            }
        );

    if (!messageResponse.ok) {
        const errorText =
            await messageResponse.text();

        throw new Error(
            `Discord message error: ${messageResponse.status} ${errorText}`
        );
    }
}
