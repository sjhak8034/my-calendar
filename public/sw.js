// 웹 푸시용 서비스 워커(Task 011). 오프라인 캐시는 하지 않아 fetch 핸들러를 두지 않는다.
// 서버(lib/notify/web-push.ts)가 보내는 페이로드: { title, body, url, tag }

// 푸시를 받으면 반드시 알림을 띄운다(userVisibleOnly 구독이라 안 띄우면 브라우저가 구독을 끊을 수 있다).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // 페이로드가 깨져도 알림은 띄운다.
  }
  const title = typeof data.title === "string" && data.title ? data.title : "my-calendar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined, // 같은 알림이 겹쳐 쌓이지 않게 한다.
      icon: "/logo.png",
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

// 같은 사이트의 경로만 연다(페이로드의 외부 주소로 이동하지 않게 한다).
function targetUrl(raw) {
  try {
    const url = new URL(raw, self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

// 알림을 누르면 열려 있는 탭을 재사용하고, 없으면 새 탭을 연다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => ("navigate" in w ? w.navigate(href) : w));
      return self.clients.openWindow(href);
    }),
  );
});
