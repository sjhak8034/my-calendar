// 로그인 직후 잠깐 거치는 빈 화면. 언어 레이아웃의 인트로가 이 위를 덮고, 그동안 뒤에서 캘린더로 이동한다.
// 서버 HTML이 배경뿐이라 풀 로드(Google 로그인)에서도 첫 페인트에 캘린더가 비치지 않는다.
export default function WelcomePage() {
  return <main aria-busy="true" className="flex-1 bg-background" />;
}
