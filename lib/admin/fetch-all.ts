import "server-only";

export const PAGE = 1000;
// 한 번의 집계에서 읽는 최대 행 수(과도한 읽기 방지). 넘으면 오래된 쪽이 빠진다.
export const MAX_ROWS = 20_000;

// PostgREST는 한 번에 가져오는 행 수가 제한돼 있어 페이지를 나눠 모은다.
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null as string | null };
}

