import admin from "firebase-admin";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "your-project-id.appspot.com", // Replace with your bucket
  });
}

const bucket = admin.storage().bucket();

export { bucket };
   