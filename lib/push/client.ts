import { subscribePush, unsubscribePush } from "./actions";

// 브라우저 전용 웹 푸시 도우미. 설정 화면의 스위치, 로그인 후 자동 복원, 로그아웃 정리가 함께 쓴다.

export function supportsPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// VAPID 공개 키(base64url)를 PushManager.subscribe가 받는 바이트로 바꾼다.
function toBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array) {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, i) => value === expected[i]);
}

export type SubscribeOutcome = "ok" | "notConfigured" | "limit" | "failed";

// 이 브라우저를 구독시키고 서버에 저장한다. 알림 권한은 이미 허용돼 있어야 하며 여기서는 요청하지 않는다
// (권한 창은 사용자가 스위치를 눌렀을 때만 띄운다). 저장에 실패하면 브라우저 쪽도 되돌려 둘이 어긋나지 않게 한다.
export async function subscribeThisBrowser(lang: string): Promise<SubscribeOutcome> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return "notConfigured";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = toBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // VAPID 키가 바뀌었으면 이전 구독으로는 보낼 수 없으니 새로 만든다.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const result = await subscribePush(subscription.toJSON(), lang);
  if (!result.ok) {
    await subscription.unsubscribe();
    return result.code === "limit" ? "limit" : "failed";
  }
  return "ok";
}

// 로그아웃할 때 이 브라우저의 웹 푸시 구독을 해제한다.
// 구독은 계정이 아니라 브라우저에 붙어 있어서, 해제하지 않으면 공유 기기에서 로그아웃한 뒤에도
// 이전 사용자의 일정 알림이 계속 뜬다. 서버 행 삭제는 로그인이 필요하므로 로그아웃 전에 불러야 한다.
// 계정에 켜 둔 상태는 그대로 두므로, 같은 계정으로 다시 로그인하면 자동으로 다시 구독된다.
//
// 어떤 이유로든 실패하거나 오래 걸려도 로그아웃을 막지 않는다: 서버 삭제가 실패해도 브라우저 구독은 해제하고
// (알림이 더는 뜨지 않는다), 남은 서버 행은 다음 발송 때 404·410으로 정리된다.
export async function releasePushSubscription(timeoutMs = 3000): Promise<void> {
  const release = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await unsubscribePush(subscription.endpoint);
    } catch {
      // 서버에 닿지 않아도 아래에서 브라우저 구독은 해제한다.
    }
    await subscription.unsubscribe();
  };
  try {
    await Promise.race([release(), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  } catch {
    // 로그아웃은 계속 진행한다.
  }
}
