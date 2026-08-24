"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const { initializeApp } = require("firebase-admin/app");
const {
    getFirestore,
    FieldValue
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const DISCORD_BOT_TOKEN = defineSecret("DISCORD_BOT_TOKEN");
const DISCORD_USER_ID = defineSecret("DISCORD_USER_ID");

const REGION = "asia-northeast1";
const MAX_PAYLOAD_BYTES = 80_000;

exports.submitRequest = onCall(
    {
        region: REGION,
        secrets: [
            DISCORD_BOT_TOKEN,
            DISCORD_USER_ID
        ],
        timeoutSeconds: 30,
        memory: "256MiB"
    },
    async request => {
        const raw = request.data?.request;

        if (!raw || typeof raw !== "object") {
            throw new HttpsError(
                "invalid-argument",
                "依頼データが正しくありません。"
            );
        }

        // 簡易ハニーポット
        if (String(raw?.antiSpam?.website || "").trim() !== "") {
            throw new HttpsError(
                "permission-denied",
                "送信を受け付けられませんでした。"
            );
        }

        const serialized = JSON.stringify(raw);

        if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
            throw new HttpsError(
                "invalid-argument",
                "依頼データが大きすぎます。"
            );
        }

        const cleaned = validateAndCleanRequest(raw);

        const counterRef = db.doc("system/requestCounter");
        const requestDocRef = db.collection("requests").doc();

        let requestId = "";

        await db.runTransaction(async transaction => {
            const counterSnapshot = await transaction.get(counterRef);

            const previous =
                Number(counterSnapshot.data()?.value || 0);

            const next = previous + 1;

            requestId = `U29-${String(next).padStart(6, "0")}`;

            transaction.set(
                counterRef,
                {
                    value: next,
                    updatedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
            );

            transaction.set(
                requestDocRef,
                {
                    requestId,
                    status: "new",
                    quoteStatus: "site-estimate",
                    applicant: cleaned.applicant,
                    estimate: cleaned.estimate,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    discordNotified: false,
                    discordError: null
                }
            );
        });

        let discordNotified = false;

        try {
            await sendDiscordDm({
                token: DISCORD_BOT_TOKEN.value(),
                recipientId: DISCORD_USER_ID.value(),
                requestId,
                data: cleaned
            });

            discordNotified = true;

            await requestDocRef.update({
                discordNotified: true,
                discordNotifiedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
        } catch (error) {
            logger.error(
                "Discord notification failed",
                {
                    requestId,
                    error: error?.message || String(error)
                }
            );

            await requestDocRef.update({
                discordNotified: false,
                discordError: String(error?.message || error).slice(0, 500),
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        return {
            ok: true,
            requestId,
            savedAt: new Date().toISOString(),
            discordNotified
        };
    }
);

function validateAndCleanRequest(raw) {
    const applicant = raw.applicant || {};
    const estimate = raw.estimate || {};

    const activityName = cleanString(
        applicant.activityName,
        100
    );

    const contactMethod = cleanString(
        applicant.contactMethod,
        30
    );

    const contactValue = cleanString(
        applicant.contactValue,
        200
    );

    if (!activityName) {
        throw new HttpsError(
            "invalid-argument",
            "活動名 / お名前が入力されていません。"
        );
    }

    if (!contactMethod || !contactValue) {
        throw new HttpsError(
            "invalid-argument",
            "連絡先が入力されていません。"
        );
    }

    const finalTotal = Number(estimate.finalTotal);

    if (
        !Number.isFinite(finalTotal) ||
        finalTotal < 0 ||
        finalTotal > 10_000_000
    ) {
        throw new HttpsError(
            "invalid-argument",
            "見積り金額が正しくありません。"
        );
    }

    const lines = Array.isArray(estimate.lines)
        ? estimate.lines
            .slice(0, 100)
            .map(value => cleanString(value, 500))
            .filter(Boolean)
        : [];

    return {
        applicant: {
            activityName,
            contactMethod,
            contactValue,
            deadline: cleanString(applicant.deadline, 30),
            publicDate: cleanString(applicant.publicDate, 30),
            materialsUrl: cleanString(applicant.materialsUrl, 2000),
            referenceUrl: cleanString(applicant.referenceUrl, 2000),
            notes: cleanString(applicant.notes, 5000)
        },
        estimate: {
            version: Number(estimate.version || 1),
            tab: cleanString(estimate.tab, 30),
            title: cleanString(estimate.title, 100),
            category: cleanString(estimate.category, 100),
            finalTotal: Math.floor(finalTotal),
            lines,
            discount: {
                student: Boolean(estimate.discount?.student),
                first: Boolean(estimate.discount?.first),
                rate: Number(estimate.discount?.rate || 1)
            },
            set: cleanSetData(estimate.set)
        }
    };
}

function cleanSetData(value) {
    if (!value || typeof value !== "object") {
        return null;
    }

    return {
        planKey: cleanString(value.planKey, 50),
        planLabel: cleanString(value.planLabel, 100),
        minimum: safeMoney(value.minimum),
        setDiscount: safeMoney(value.setDiscount),
        beforeSetDiscount: safeMoney(value.beforeSetDiscount),
        meetsMinimum: Boolean(value.meetsMinimum)
    };
}

function safeMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            10_000_000,
            Math.floor(number)
        )
    );
}

function cleanString(value, maxLength) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength);
}

async function sendDiscordDm({
    token,
    recipientId,
    requestId,
    data
}) {
    if (!token || !recipientId) {
        throw new Error(
            "Discord Bot Token または Discord User ID が設定されていません。"
        );
    }

    const dmResponse = await fetch(
        "https://discord.com/api/v10/users/@me/channels",
        {
            method: "POST",
            headers: {
                "Authorization": `Bot ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                recipient_id: recipientId
            })
        }
    );

    if (!dmResponse.ok) {
        const text = await dmResponse.text();

        throw new Error(
            `Discord DMチャンネル作成失敗: ${dmResponse.status} ${text.slice(0, 300)}`
        );
    }

    const dmChannel = await dmResponse.json();

    const applicantName =
        data.applicant.activityName || "未入力";

    const category =
        data.estimate.category || "未選択";

    const amount =
        Number(data.estimate.finalTotal || 0)
            .toLocaleString("ja-JP");

    const deadline =
        data.applicant.deadline || "指定なし";

    const messageResponse = await fetch(
        `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bot ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: "📩 **新しい依頼が届きました**",
                embeds: [
                    {
                        title: requestId,
                        description:
                            "詳しい依頼内容は Firebase の `requests` コレクションから確認できます。",
                        fields: [
                            {
                                name: "依頼者",
                                value: applicantName,
                                inline: true
                            },
                            {
                                name: "依頼内容",
                                value: category,
                                inline: true
                            },
                            {
                                name: "サイト見積り",
                                value: `${amount}円`,
                                inline: true
                            },
                            {
                                name: "希望納期",
                                value: deadline,
                                inline: true
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }
                ],
                allowed_mentions: {
                    parse: []
                }
            })
        }
    );

    if (!messageResponse.ok) {
        const text = await messageResponse.text();

        throw new Error(
            `Discordメッセージ送信失敗: ${messageResponse.status} ${text.slice(0, 300)}`
        );
    }
}
