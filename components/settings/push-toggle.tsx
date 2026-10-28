"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sendTestPush, subscribePush, unsubscribePush } from "@/lib/push/actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

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

function supportsPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// 이 브라우저의 웹 푸시 구독을 켜고 끈다. 권한 요청은 반드시 사용자가 스위치를 눌렀을 때만 한다.
export function PushToggle({ lang, dict }: { lang: string; dict: Dictionary["settings"]["push"] }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // 이 브라우저에 이미 구독이 있으면 켜진 상태로 보여 주고, 서버에도 다시 저장해 둔다
  // (서버가 만료된 구독을 지웠거나 화면 언어가 바뀐 경우를 맞춘다).
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supportsPush()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        void subscribePush(subscription.toJSON(), lang);
        return "on";
      }
      return "off";
    }
    check()
      .catch((): State => "off")
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  async function turnOn() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError(dict.errors.notConfigured);
      return;
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
    } else if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

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
      // 서버에 저장되지 않았으면 브라우저 쪽도 되돌려 둘이 어긋나지 않게 한다.
      await subscription.unsubscribe();
      setError(result.code === "limit" ? dict.errors.limit : dict.errors.failed);
      return;
    }
    setState("on");
  }

  async function turnOff() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      // 서버를 먼저 지운다. 브라우저만 해제되면 서버에 쓸 수 없는 구독이 남는다.
      const result = await unsubscribePush(subscription.endpoint);
      if (!result.ok) {
        setError(dict.errors.failed);
        return;
      }
      await subscription.unsubscribe();
    }
    setState("off");
  }

  async function sendTest() {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sendTestPush();
      if (result.ok) setNotice(dict.testSent);
      else setError(result.code === "notSubscribed" ? dict.errors.testNone : dict.errors.failed);
    } catch {
      setError(dict.errors.failed);
    } finally {
      setTesting(false);
    }
  }

  async function change(checked: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await (checked ? turnOn() : turnOff());
    } catch {
      setError(dict.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  const status = busy
    ? dict.working
    : state === "checking"
      ? dict.checking
      : dict[state];

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="push-title" className="text-base font-semibold">
            {dict.title}
          </h2>
          <p id="push-description" className="text-sm text-muted-foreground">
            {dict.description}
          </p>
        </div>
        <Switch
          aria-labelledby="push-title"
          aria-describedby="push-description"
          checked={state === "on"}
          disabled={busy || state === "checking" || state === "unsupported" || state === "denied"}
          onCheckedChange={(checked) => void change(checked)}
          className="mt-1"
        />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      {state === "on" && (
        <div>
          <Button type="button" variant="outline" size="sm" disabled={busy || testing} onClick={() => void sendTest()}>
            {dict.test}
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
