// 로그인 화면 장식 일러스트. 직접 그린 인라인 SVG이며 카드 뒤에 깔린다.
// 색은 globals.css의 --illust-* 변수(fill-illust-*, stroke-illust-*)만 쓴다.
// 소재: 월간 캘린더 카드, 일정 타임라인, AI 말풍선, 알림 벨, 시계, 화분.

// 모든 도형이 공유하는 선 스타일(얇고 일관된 1.5 두께)
const lineProps = {
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// 부드러운 그림자용 클래스
const shadow = "fill-illust-shadow stroke-none";

// 4갈래 반짝임(AI sparkle)
function Sparkle({
  cx,
  cy,
  r,
  className,
}: {
  cx: number;
  cy: number;
  r: number;
  className: string;
}) {
  const k = r * 0.18;
  return (
    <path
      d={`M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`}
      className={className}
    />
  );
}

// 알림 벨. (0,0)을 중심으로 그리고 transform으로 배치한다.
function Bell({ transform, dot = true }: { transform: string; dot?: boolean }) {
  return (
    <g transform={transform}>
      <path
        d="M-26 20 C-21 15 -19 8 -19 -4 C-19 -19 -10 -28 0 -28 C10 -28 19 -19 19 -4 C19 8 21 15 26 20 Z"
        className="fill-illust-butter"
      />
      <path d="M-8 26 Q0 34 8 26" className="fill-illust-peach" />
      <circle cx={0} cy={-32} r={3.5} className="fill-illust-butter" />
      {dot && (
        <circle cx={18} cy={-22} r={7} className="fill-illust-coral" />
      )}
    </g>
  );
}

// 잎 하나(타원). 중심 위치와 회전각을 받는다.
function Leaf({
  x,
  y,
  rotate,
  ry = 22,
}: {
  x: number;
  y: number;
  rotate: number;
  ry?: number;
}) {
  return (
    <ellipse
      cx={0}
      cy={0}
      rx={ry * 0.45}
      ry={ry}
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      className="fill-illust-sage"
    />
  );
}

// 일정 칩(타임라인 조각). 글자 대신 둥근 막대를 쓴다.
function Chip({
  x,
  y,
  w,
  h,
  fill,
  check = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  check?: boolean;
}) {
  return (
    <g>
      <rect x={x + 3} y={y + 5} width={w} height={h} rx={14} className={shadow} />
      <rect x={x} y={y} width={w} height={h} rx={14} className={fill} />
      <rect x={x + 14} y={y + 13} width={Math.min(92, w - 70)} height={8} rx={4} className="fill-illust-paper stroke-none" />
      {h > 38 && (
        <rect x={x + 14} y={y + 28} width={Math.min(58, w - 100)} height={8} rx={4} className="fill-illust-paper/70 stroke-none" />
      )}
      {check && (
        <g>
          <circle cx={x + w - 24} cy={y + h / 2} r={11} className="fill-illust-paper" />
          <path
            d={`M${x + w - 29} ${y + h / 2} l4 4 l7 -8`}
            fill="none"
            className="stroke-illust-sage"
            strokeWidth={2}
          />
        </g>
      )}
    </g>
  );
}

// 왼쪽: 월간 캘린더 카드 + AI 말풍선 + 벨 + 화분
function LeftScene() {
  const cx = (i: number) => 24 + i * 35;
  const cy = (r: number) => 238 + r * 32;
  const cells = [0, 1, 2, 3, 4].flatMap((r) =>
    [0, 1, 2, 3, 4, 5, 6].map((c) => ({ r, c })),
  );
  return (
    <svg
      viewBox="0 0 440 440"
      className="absolute bottom-24 left-0 h-auto w-[22rem] xl:w-[23rem] min-[1700px]:w-[28rem]"
      fill="none"
      focusable="false"
    >
      <g {...lineProps} className="stroke-illust-ink">
        {/* 흩어진 장식 */}
        <circle cx={150} cy={36} r={6} className="fill-illust-sage" />
        <circle cx={14} cy={110} r={4} className="stroke-illust-ink" />
        <Sparkle cx={176} cy={92} r={11} className="fill-illust-peach" />
        <path d="M416 300 q8 -10 16 0 t16 0" className="stroke-illust-coral" />

        {/* 알림 벨 */}
        <ellipse cx={72} cy={112} rx={28} ry={5} className={shadow} />
        <Bell transform="translate(72 78) scale(1.15)" />

        {/* AI 말풍선 */}
        <path d="M236 116 L224 144 L270 118 Z" className="fill-illust-lavender" />
        <rect x={208} y={32} width={190} height={90} rx={26} className={shadow} transform="translate(4 6)" />
        <rect x={205} y={28} width={190} height={90} rx={26} className="fill-illust-lavender" />
        <Sparkle cx={240} cy={73} r={17} className="fill-illust-butter" />
        <rect x={270} y={58} width={96} height={9} rx={4.5} className="fill-illust-paper stroke-none" />
        <rect x={270} y={78} width={62} height={9} rx={4.5} className="fill-illust-paper/70 stroke-none" />

        {/* 사용자 말풍선 */}
        <path d="M402 202 L414 226 L376 206 Z" className="fill-illust-coral" />
        <rect x={304} y={152} width={130} height={56} rx={22} className={shadow} transform="translate(4 6)" />
        <rect x={300} y={146} width={130} height={56} rx={22} className="fill-illust-coral" />
        {[338, 365, 392].map((x) => (
          <circle key={x} cx={x} cy={174} r={5} className="fill-illust-paper stroke-none" />
        ))}

        {/* 월간 캘린더 카드 */}
        <rect x={1} y={150} width={258} height={240} rx={22} className={shadow} transform="translate(7 10)" />
        <rect x={1} y={150} width={258} height={240} rx={22} className="fill-illust-paper" />
        <path d="M1 172 a22 22 0 0 1 22 -22 h214 a22 22 0 0 1 22 22 v28 h-258 Z" className="fill-illust-peach" />
        <rect x={24} y={168} width={84} height={10} rx={5} className="fill-illust-paper stroke-none" />
        {[62, 198].map((x) => (
          <rect key={x} x={x} y={138} width={10} height={26} rx={5} className="fill-illust-paper" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <circle key={c} cx={cx(c)} cy={216} r={2.5} className="fill-illust-ink/40 stroke-none" />
        ))}
        {cells.map(({ r, c }) => (
          <rect
            key={`${r}-${c}`}
            x={cx(c) - 14}
            y={cy(r) - 12}
            width={28}
            height={24}
            rx={8}
            className="fill-illust-ink/5 stroke-none"
          />
        ))}
        {/* 기간 일정 막대 */}
        <rect x={cx(1) - 14} y={cy(1) - 12} width={cx(3) - cx(1) + 28} height={24} rx={12} className="fill-illust-sky" />
        <rect x={cx(1) - 2} y={cy(1) - 2} width={36} height={4} rx={2} className="fill-illust-paper stroke-none" />
        <rect x={cx(3) - 14} y={cy(2) - 12} width={cx(6) - cx(3) + 28} height={24} rx={12} className="fill-illust-lavender" />
        <rect x={cx(3) + 2} y={cy(2) - 2} width={44} height={4} rx={2} className="fill-illust-paper stroke-none" />
        {/* 오늘 */}
        <circle cx={cx(1)} cy={cy(3)} r={15} className="fill-illust-butter" />
        {/* 완료 체크 */}
        <circle cx={cx(4)} cy={cy(0)} r={13} className="fill-illust-coral" />
        <path d={`M${cx(4) - 5} ${cy(0)} l4 4 l7 -8`} className="stroke-illust-paper" strokeWidth={2} />

        {/* 화분 (카드 쪽으로 겹쳐 들어옴) */}
        <ellipse cx={330} cy={439} rx={52} ry={5} className={shadow} />
        <path d="M325 382 C322 352 310 338 298 324" />
        <path d="M325 382 C327 348 330 322 326 298" />
        <path d="M325 382 C330 356 346 342 358 330" />
        <Leaf x={296} y={322} rotate={-40} />
        <Leaf x={326} y={296} rotate={0} ry={26} />
        <Leaf x={360} y={328} rotate={40} />
        <path d="M290 394 H362 L354 439 H298 Z" className="fill-illust-coral" />
        <rect x={284} y={380} width={84} height={18} rx={9} className="fill-illust-peach" />
      </g>
    </svg>
  );
}

// 오른쪽: 일정 타임라인 + 시계 + 알림 토스트 + 날짜 타일
function RightScene() {
  return (
    <svg
      viewBox="0 0 440 440"
      className="absolute right-0 bottom-24 h-auto w-[22rem] xl:w-[23rem] min-[1700px]:w-[28rem]"
      fill="none"
      focusable="false"
    >
      <g {...lineProps} className="stroke-illust-ink">
        {/* 흩어진 장식 */}
        <path d="M262 18 q12 -14 24 0 t24 0 t24 0" className="stroke-illust-coral" />
        <Sparkle cx={420} cy={20} r={12} className="fill-illust-butter" />
        <circle cx={130} cy={150} r={5} className="stroke-illust-ink" />
        <circle cx={112} cy={250} r={6} className="fill-illust-lavender" />
        <Sparkle cx={140} cy={286} r={10} className="fill-illust-sage" />

        {/* 타임라인 카드 */}
        <rect x={180} y={40} width={258} height={262} rx={24} className={shadow} transform="translate(7 10)" />
        <rect x={180} y={40} width={258} height={262} rx={24} className="fill-illust-paper" />
        <rect x={256} y={58} width={88} height={10} rx={5} className="fill-illust-ink/15 stroke-none" />
        {[130, 186, 242].map((y) => (
          <g key={y}>
            <path d={`M200 ${y} h18`} className="stroke-illust-ink/30" />
            <path d={`M232 ${y} H420`} className="stroke-illust-ink/10" />
          </g>
        ))}
        <Chip x={248} y={98} w={170} h={50} fill="fill-illust-sky" />
        <Chip x={268} y={160} w={150} h={44} fill="fill-illust-coral" />
        <Chip x={248} y={216} w={170} h={70} fill="fill-illust-sage" check />

        {/* 시계 (카드 모서리에 겹침) */}
        <circle cx={200} cy={68} r={42} className={shadow} transform="translate(4 7)" />
        <circle cx={196} cy={64} r={42} className="fill-illust-paper" />
        <circle cx={196} cy={64} r={32} className="fill-illust-lavender/60 stroke-none" />
        {[
          [196, 38, 196, 43],
          [196, 85, 196, 90],
          [170, 64, 175, 64],
          [217, 64, 222, 64],
        ].map(([x1, y1, x2, y2]) => (
          <path key={`${x1}-${y1}`} d={`M${x1} ${y1} L${x2} ${y2}`} />
        ))}
        <path d="M196 64 V47 M196 64 L209 72" />
        <circle cx={196} cy={64} r={4} className="fill-illust-coral" />

        {/* 날짜 타일 + 작은 화분 */}
        <ellipse cx={100} cy={439} rx={92} ry={5} className={shadow} />
        <rect x={72} y={351} width={88} height={88} rx={18} className="fill-illust-paper" />
        <path d="M72 369 a18 18 0 0 1 18 -18 h52 a18 18 0 0 1 18 18 v8 h-88 Z" className="fill-illust-coral" />
        <circle cx={116} cy={410} r={16} className="fill-illust-butter" />
        <path d="M109 410 l5 5 l9 -10" />

        <path d="M36 418 C34 404 30 396 24 390 M36 418 C38 402 44 394 50 388" />
        <Leaf x={22} y={386} rotate={-30} ry={14} />
        <Leaf x={51} y={384} rotate={30} ry={14} />
        <path d="M12 418 H60 L55 439 H17 Z" className="fill-illust-lavender" />
        <rect x={8} y={410} width={56} height={11} rx={5.5} className="fill-illust-peach" />

        {/* 알림 토스트 (카드 쪽으로 겹침) */}
        <rect x={140} y={322} width={298} height={70} rx={35} className={shadow} transform="translate(5 8)" />
        <rect x={140} y={322} width={298} height={70} rx={35} className="fill-illust-peach" />
        <circle cx={177} cy={357} r={22} className="fill-illust-paper" />
        <Bell transform="translate(177 358) scale(0.55)" />
        <rect x={214} y={343} width={130} height={9} rx={4.5} className="fill-illust-paper stroke-none" />
        <rect x={214} y={362} width={84} height={9} rx={4.5} className="fill-illust-paper/70 stroke-none" />
        <circle cx={405} cy={357} r={16} className="fill-illust-sage" />
        <path d="M398 357 l5 5 l9 -10" className="stroke-illust-paper" strokeWidth={2} />
      </g>
    </svg>
  );
}

// 좌우 하단 장식. lg 미만에서는 숨기고 클릭을 막지 않는다.
// 상단 바(header)와 같은 max-width·좌우 패딩 컨테이너를 공유해 로고/버튼과 가로 위치를 맞춘다.
export function LoginIllustrations() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden h-[34rem] overflow-hidden lg:block"
    >
      <div className="relative mx-auto h-full w-full max-w-[1600px] px-5 sm:px-8 lg:px-12">
        <div className="relative h-full w-full">
          {/* 바닥선 */}
          <div className="absolute inset-x-0 bottom-24 h-px bg-border" />
          <LeftScene />
          <RightScene />
        </div>
      </div>
    </div>
  );
}
