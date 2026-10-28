"use client";

import { ChevronLeft, ChevronRight, Expand, ImageIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const count = images.length;

  const goTo = useCallback(
    (i: number) => {
      const next = (i + count) % count;
      setIndex(next);
      const el = scroller.current;
      if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom, count]);

  if (!count) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-subtle text-faint">
        <ImageIcon className="h-16 w-16" />
      </div>
    );
  }

  return (
    <div>
      <div className="group relative -mx-4 overflow-hidden bg-slate-950 sm:mx-0 sm:rounded-3xl">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="scrollbar-none flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`${title} — photo ${i + 1} of ${count}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full shrink-0 cursor-zoom-in snap-center object-contain"
              onClick={() => setZoom(true)}
            />
          ))}
        </div>
        {count > 1 && (
          <>
            <NavButton side="left" onClick={() => goTo(index - 1)} />
            <NavButton side="right" onClick={() => goTo(index + 1)} />
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((src, i) => (
                <span key={src} className={`h-1.5 rounded-full bg-white transition-all ${i === index ? "w-5" : "w-1.5 opacity-60"}`} />
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => setZoom(true)}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
          aria-label="View full screen"
        >
          <Expand className="h-4 w-4" />
        </button>
      </div>
      {count > 1 && (
        <div className="scrollbar-none mt-3 hidden gap-2 overflow-x-auto sm:flex">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => goTo(i)}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-canvas transition ${
                i === index ? "ring-lagoon-500" : "opacity-60 ring-transparent hover:opacity-100"
              }`}
              aria-label={`Show photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true">
          <button onClick={() => setZoom(false)} className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt="" className="max-h-full max-w-full object-contain" />
          {count > 1 && (
            <>
              <NavButton side="left" onClick={() => setIndex((i) => (i - 1 + count) % count)} always />
              <NavButton side="right" onClick={() => setIndex((i) => (i + 1) % count)} always />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick, always }: { side: "left" | "right"; onClick: () => void; always?: boolean }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-3" : "right-3"} ${
        always ? "flex" : "hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100"
      } h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg transition hover:scale-105 hover:bg-white`}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
