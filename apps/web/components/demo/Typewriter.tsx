"use client";

import { useEffect, useState } from "react";

export function Typewriter({ text, active }: { text: string; active: boolean }) {
  const [count, setCount] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      setCount(i);
      if (i >= text.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [text, active]);

  const done = count >= text.length;
  return (
    <span>
      {text.slice(0, count)}
      {!done ? (
        <span className="ml-0.5 inline-block h-[1em] w-[7px] translate-y-[2px] bg-accent/80 animate-caret" />
      ) : null}
    </span>
  );
}
