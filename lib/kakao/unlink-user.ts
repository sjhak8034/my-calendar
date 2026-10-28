import "server-only";
import { unlink } from "./client";
import { getAccessToken } from "./tokens";

// 사용자의 카카오 연결을 카카오 쪽에서 끊는다(동의 철회·토큰 폐기). 연결이 없거나 토큰을 못 쓰거나 실패해도
// 호출한 쪽(연결 해제·계정 삭제)이 자기 쪽 데이터를 지우고 진행하도록 오류를 던지지 않는다.
export async function unlinkKakaoForUser(userId: string): Promise<void> {
  try {
    const token = await getAccessToken(userId);
    if (token.ok) await unlink(token.accessToken);
  } catch (e) {
    console.error("[kakao] unlink skipped:", e instanceof Error ? e.name : "error");
  }
}
