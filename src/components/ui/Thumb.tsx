/**
 * Video thumbnail. Demo videos have no image, so a plain placeholder with the
 * opening words of the title is drawn instead.
 */
export function Thumb({ src, seed, label, title }: { src?: string | null; seed: string; label?: string; title?: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div className="@container relative aspect-video w-full overflow-hidden rounded-lg bg-panel-2" style={src ? undefined : { background: `hsl(${h} 32% 20%)` }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : title ? (
        <div className="absolute inset-0 flex items-end p-[6cqw]">
          <span className="line-clamp-3 text-[8cqw] leading-[1.1] font-bold tracking-tight text-white/90">
            {title.split(/\s+/).slice(0, 5).join(" ")}
          </span>
        </div>
      ) : null}
      {label && (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</span>
      )}
    </div>
  );
}
