import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_ADMIN_SERVICE_ACCOUNT = {
  projectId: "hp-task",
  clientEmail: "firebase-adminsdk-fbsvc@hp-task.iam.gserviceaccount.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC1+Ya6w/kDz48j
YHPbKfZySw5FL4w+JBb8LWhw70IkK4zZFVkTSMxWxbHiQXnwBBjTnky8RXl+RyzO
uQGk02nLkdC5WH78aeHa3AYs+LFzdXL8rWYLUV12f/FFNWg819aMAs5G17tja4Go
acza82RagoBTUc9ZlvhNckNVIGjdWYMCr/XEY3+a+U3HjY1FYayHJnNGLKimxrCR
UaEKt+pcRHmndLoQij+20WpHniXvlJB9dzFuT+QNALgmXkGqwfcERtPA/zNjNriM
72yxxoskecVyAtzMqVwO2Kp0lhhZnW1zNSBOvIlILvgIpq/5r9vz9dXWL12E6GHN
WfnNN/9dAgMBAAECggEAD6oirGoZQfg4iKGRZ5DVq6IFYPRGXMULi3q3Ll2SMn3j
On6pc80E9gU/mkvrnLsljfXnAh/y5OlolIT9fLxMM59iOcpB6CWPMSFWkMF5uQgn
tVOR4LCI3J4H3V7LEc28pMHLEvMYKOdEuoQdA84G2fm45TM6J6qkxjnrTOUk0cTw
9Qvsb3zvypFZ2Lc8dBDD/AbJsNDZqUt64bc4+wmLZLs6RrQouFwmg62sj+fNRtkH
pZnkxaz5ARA0b9QXocIZM3WSmiWkoSt6rgAP/RcSQe/R8AjVygQsEQjMG3Q0E6sW
qcA8KGVCj1fk1ibcAdPn2ufd8rjyUcuk18uIYSeWoQKBgQDvEo2BTEsCAOeMqel+
CK9slhrVSBaqVLmZgWYDcJ5qh2sURIKoKcdApqSkH3ojC4jB6LJ3VFMU7tlym4n3
1qMjEsshWsj8KIEKpkt766Ul3ZdRAlAWeOhAIW/JK81Op8FrPiVKjFhL4czzcDQ6
V4F5+uH5pV9whKCmARsVDZqAzQKBgQDC3APNjNbWs4rq4hnmBSqXCAonu5UkxZO9
xaeP+gzdXZzt9Ghfs32NDwgqcEZx5rtxWJhrzHK3M7LPGq0bNaCWkSIeL0sTusLv
vs9pxHiv5pD2LbqiE66ujpk5TmWoga7jShlkJkuCxzi9DhSn7THp9OpYi4cRyqry
QRO1XYg40QKBgHCWvC14UJrQ8js8icnhLTxmNJzdJk9xNzcjyXc1QmXJAJS67w1j
H4NC96aTbGG0vOMVQ3cPL1FcauuedItTeeC6qQ88Qgr+yEbLqiDiCRScFvb/r9fl
ePs6w/pptnakamKnEcjZ73tNC8hZvz76lu9rR6DaUOgcjcugGbEAhxLBAoGAL70n
UVyH5eHmztTF84ygepAFrOZQC8o7/+pEuwlPzYv5vnJ6f7fBsqVUItGO8KjOk15Z
OU/FawzHaeXnMxtYVIsKCMsdYaAH0iS1O/xedPnP2gAqETsxOKLG9zs1vKrI5fZp
chfPuCKGzAp/FQUPjXnrT/YfCUTVzLQU2AIqNYECgYBNARlL93hsSvkJJIFRlEXG
2OBWrlWemsKKVQ8aXa99sC1MxgdP/8hx1qnZrkwLTwUS9616nFVtiroMqCNpydm3
ZMFV68G4ATbA+Wa1UX60ZFSZ9dfFoZjxUQWQBi3f4kDDzEP52iWNVF58dQOJlvif
GQnGrI4yXaWa+9gh87TVBA==
-----END PRIVATE KEY-----
`,
} as const;

function getHardcodedServiceAccount() {
  const { projectId, clientEmail } = FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const privateKeyRaw = FIREBASE_ADMIN_SERVICE_ACCOUNT.privateKey;
  const privateKey = privateKeyRaw.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0]!;

  const { projectId, clientEmail, privateKey } = getHardcodedServiceAccount();

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getDb() {
  getFirebaseAdminApp();
  return getFirestore();
}
