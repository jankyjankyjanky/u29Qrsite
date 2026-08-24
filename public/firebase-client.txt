// ============================================================
// Firebase Callable Function 接続
// ============================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getFunctions,
    httpsCallable
} from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";

import {
    firebaseConfig,
    functionsRegion
} from "./firebase-config.js";

function isConfigured(config) {
    return Boolean(
        config &&
        config.apiKey &&
        config.projectId &&
        config.appId &&
        !String(config.apiKey).startsWith("YOUR_") &&
        !String(config.projectId).startsWith("YOUR_") &&
        !String(config.appId).startsWith("YOUR_")
    );
}

if (!isConfigured(firebaseConfig)) {
    console.warn(
        "Firebaseが未設定です。public/firebase-config.js を編集してください。"
    );

    window.u29FirebaseReady = false;
} else {
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app, functionsRegion);
    const callable = httpsCallable(functions, "submitRequest");

    window.u29FirebaseReady = true;

    window.u29SubmitRequest = async requestData => {
        const response = await callable({
            request: requestData
        });

        return response.data;
    };
}
