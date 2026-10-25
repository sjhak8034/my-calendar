export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">my-calendar</h1>
      <p className="text-muted-foreground">월간 캘린더가 이곳에 표시됩니다.</p>
    </main>
  );
}
