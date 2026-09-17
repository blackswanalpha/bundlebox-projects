"use client";

import { useEffect, useRef, useState } from "react";
import { PROFILE } from "../app/content";

// A bar per side, each scaled to the larger number in ITS OWN row. There is no
// index and no score: a row with tokens is compared against tokens and a row
// with seconds against seconds, so nothing here is normalised across units.
// The bars grow once, when the panel first comes into view; before that they
// are at their final width with no transition, so a viewer who arrives with
// motion turned off sees the finished chart rather than an empty one.
export default function Profile() {
  const el = useRef(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined") { setRun(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setRun(true);
      io.disconnect();
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div className="profile" ref={el} data-run={run ? "1" : "0"}>
      {PROFILE.map((row, i) => {
        const max = Math.max(row.a.v, row.b.v) || 1;
        const pa = Math.max((row.a.v / max) * 100, row.a.v > 0 ? 2 : 0);
        const pb = Math.max((row.b.v / max) * 100, row.b.v > 0 ? 2 : 0);
        return (
          <div className="prow" key={row.axis} style={{ "--i": i }}>
            <div className="phead">
              <span className="paxis">{row.axis}</span>
              <span className="pdelta">{row.delta}</span>
            </div>
            <p className="pwhat">{row.what}</p>

            <div className="pbars">
              <div className="pbar">
                <span className="pl">{row.a.label}</span>
                <span className="ptrack"><i className="pfill a" style={{ width: run ? `${pa}%` : 0 }} /></span>
                <span className="pv">{row.a.show}</span>
              </div>
              <div className="pbar">
                <span className="pl">{row.b.label}</span>
                <span className="ptrack">
                  <i className={`pfill b${row.b.zero ? " zero" : ""}`} style={{ width: run ? `${pb}%` : 0 }} />
                </span>
                <span className="pv now">{row.b.show}</span>
              </div>
            </div>

            <span className="punit">{row.unit}</span>
          </div>
        );
      })}
    </div>
  );
}
