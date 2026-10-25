import Image from "next/image";
import { cn } from "@/lib/utils";

// 로고 이미지 + "my-calendar" 텍스트. 이미지는 장식이므로 텍스트가 접근 가능한 이름이 된다.
export function BrandLogo({
  className,
  textClassName,
  iconClassName,
}: {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt=""
        width={96}
        height={96}
        className={cn("shrink-0", iconClassName)}
      />
      <span className={cn("font-bold tracking-tight", textClassName)}>
        my-calendar
      </span>
    </span>
  );
}
