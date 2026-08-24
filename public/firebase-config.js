// ============================================================
// Firebase Web App 設定
//
// Firebase Console:
// プロジェクトの設定 → マイアプリ → Webアプリ → SDK の設定と構成
// に表示される firebaseConfig をここへ貼り付けてください。
//
// この設定値自体は「秘密鍵」ではありません。
// Discord Bot Token は絶対にここへ書かないでください。
// ============================================================

export const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

export const functionsRegion = "asia-northeast1";
