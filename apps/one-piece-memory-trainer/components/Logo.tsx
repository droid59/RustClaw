import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold tracking-tight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-8 w-8" />
      <span className="leading-tight">
        Memory<span className="text-straw-400">Trainer</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">One Piece TCG</span>
      </span>
    </Link>
  );
}
