// 관리자 화면 표시용 도우미(서버·클라이언트 공용).

// 이메일은 앞 두 글자만 보여 주고 나머지는 가린다.
export function maskEmail(email: string | null | undefined) {
  if (!email) return "(이메일 없음)";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export const formatKrw = (n: number) => `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: n < 100 ? 1 : 0 }).format(n)}원`;

export const formatUsd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

// 'YYYY-MM-DD' → 'M/D'
export const shortDay = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
};
