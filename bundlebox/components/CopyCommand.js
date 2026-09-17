"use client";

import { useEffect, useRef, useState } from "react";

// Copy fails silently in three ordinary cases — an insecure origin, a denied
// permission, and an iframe without the clipboard allowance — so the button
// reports what happened rather than flashing "copied" over a clipboard that
// never changed. The fallback selects the text so the visitor can still copy it.
export default function CopyCommand({ command, prompt = "$", wrap = false }) {
  const [state, setState] = useState("idle");
  const code = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(command);
      setState("done");
    } catch {
      const el = code.current;
      if (el && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setState("select");
    }
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  const label = state === "done" ? "copied" : state === "select" ? "select ⌘C" : "copy";

  return (
    <div className={`cmd${wrap ? " multiline" : ""}`}>
      <span className="p" aria-hidden="true">{prompt}</span>
      <code ref={code}>{command}</code>
      <button type="button" onClick={copy} data-done={state === "done" ? "1" : "0"}
              aria-label={`Copy: ${command}`}>
        {label}
      </button>
    </div>
  );
}
