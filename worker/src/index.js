const ALLOWED_ORIGINS = [
    "https://jankyjankyjanky.github.io"
];

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        const corsHeaders = {
            "Access-Control-Allow-Origin":
                ALLOWED_ORIGINS.includes(origin)
                    ? origin
                    : ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin"
        };

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/") {
            return Response.json({
                ok: true,
                service: "Nazuna Request API"
            });
        }

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
                        { ok: false, error: "許可されていないサイトです。" },
                        403,
                        corsHeaders
                    );
                }

                const body = await request.json();
                const data = body?.request;

                if (!data || typeof data !== "object") {
                    return jsonResponse(
                        { ok: false, error: "依頼データがありません。" },
                        400,
                        corsHeaders
                    );
                }

                if (
                    String(data?.antiSpam?.website || "").trim() !== ""
                ) {
                    return jsonResponse(
                        { ok: false, error: "送信できませんでした。" },
                        403,
                        corsHeaders
                    );
                }

                const applicant = data.applicant || {};
                const estimate = data.estimate || {};

                const activityName = clean(applicant.activityName, 100);
                const contactMethod = clean(applicant.contactMethod, 30);
                const contactValue = clean(applicant.contactValue, 200);

                if (!activityName || !contactMethod || !contactValue) {
                    return jsonResponse(
                        { ok: false, error: "依頼者情報が不足しています。" },
                        400,
                        corsHeaders
                    );
                }

                const total = Number(estimate.finalTotal);

                if (
                    !Number.isFinite(total) ||
                    total < 0 ||
                    total > 10000000
                ) {
                    return jsonResponse(
                        { ok: false, error: "見積り金額が正しくありません。" },
                        400,
                        corsHeaders
                    );
                }

                const result = await env.DB
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
                        clean(applicant.deadline, 30),
                        clean(applicant.publicDate, 30),
                        clean(applicant.materialsUrl, 2000),
                        clean(applicant.referenceUrl, 2000),
                        clean(applicant.notes, 5000),
                        clean(estimate.tab, 30),
                        clean(estimate.category, 100),
                        Math.floor(total),
                        JSON.stringify(data)
                    )
                    .run();

                const id = result.meta.last_row_id;

                const requestId =
                    `NZ-${String(id).padStart(6, "0")}`;

                await env.DB
                    .prepare(`
                        UPDATE requests
                        SET request_id = ?
                        WHERE id = ?
                    `)
                    .bind(requestId, id)
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
                                category: clean(estimate.category, 100),
                                total: Math.floor(total),
                                deadline: clean(applicant.deadline, 30)
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
                        requestId,
                        discordNotified
                    },
                    200,
                    corsHeaders
                );

            } catch (error) {
                console.error(error);

                return jsonResponse(
                    {
                        ok: false,
                        error: "依頼の保存中にエラーが発生しました。"
                    },
                    500,
                    corsHeaders
                );
            }
        }

        return jsonResponse(
            { ok: false, error: "Not Found" },
            404,
            corsHeaders
        );
    }
};

function clean(value, maxLength) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength);
}

function jsonResponse(data, status, corsHeaders) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
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
    const dmResponse = await fetch(
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
        const errorText = await dmResponse.text();

        throw new Error(
            `Discord DM error: ${dmResponse.status} ${errorText}`
        );
    }

    const dm = await dmResponse.json();

    const messageResponse = await fetch(
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
                        title: requestId,
                        fields: [
                            {
                                name: "依頼者",
                                value: data.activityName || "未入力",
                                inline: true
                            },
                            {
                                name: "依頼内容",
                                value: data.category || "未選択",
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
                                value: data.deadline || "指定なし",
                                inline: true
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
