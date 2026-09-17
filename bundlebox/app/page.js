import Image from "next/image";
import CopyCommand from "../components/CopyCommand";
import Profile from "../components/Profile";
import {
  AGENTS, DOCS, AGENT_DOCS, INSTALL, INSTALL_ALT, MEASURED,
  NPM, PIPELINE, RELEASE, REPO, ROUTES, UPTAKE, VERBS,
} from "./content";

function costClass(cost) {
  if (cost === "spends") return "cost spend";
  return cost ? "cost free" : "cost";
}

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="wrap">
          <a className="brand" href="#top">
            <Image src="/logo.svg" alt="" width={28} height={28} priority /> bundlebox
          </a>
          <div className="navlinks">
            <a href="#profile">Performance</a>
            <a href="#how">How it works</a>
            <a className="hideable" href="#measured">Measured</a>
            <a className="hideable" href="#uptake">Enforcement</a>
            <a className="hideable" href="#agents">Agents</a>
            <a className="hideable" href="#console">Console</a>
            <a className="ext" href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </nav>

      <header className="hero field" id="top">
        <div className="wrap">
          <div>
            <div className="badgerow">
              <span className="badge">{RELEASE}</span>
              <span className="badge">MIT</span>
              <span className="badge">zero npm dependencies</span>
              <span className="badge">node ≥ 20</span>
            </div>

            <h1>The zero-token software factory for <em>AI coding agents</em>.</h1>

            <p className="lead">
              An agent is billed for what it reads, and most of what it reads is
              orientation, not judgement. bundlebox answers that half before the
              agent opens — and never calls a model itself.
            </p>

            <CopyCommand command={INSTALL} />

            <div className="cta">
              <a className="btn primary" href="#how">See what it answers</a>
              <a className="btn ghost" href={REPO} target="_blank" rel="noreferrer">Read the source</a>
            </div>
          </div>

          <div className="readout">
              <div className="head"><span className="dot" aria-hidden="true" /> measured · reference workspace</div>
              {MEASURED.map((m) => (
                <div className="row" key={m.k}>
                  <span className="what">{m.k}</span>
                  <span className="was">{m.was}</span>
                  <span className="now">{m.now}</span>
                </div>
              ))}
            <div className="foot">bb session · bb tokens profile --probe · bb buckmaster episodes</div>
          </div>
        </div>
      </header>

      <section id="profile">
        <div className="wrap">
          <p className="eyebrow">What changes when it is on</p>
          <h2>Six outcomes, each measured against itself.</h2>
          <p className="lead">
            Every bar is the number&rsquo;s share of the larger number in its own
            row, in that row&rsquo;s own unit. Nothing is scored, indexed or
            averaged across rows — a token is only ever compared to a token.
          </p>

          <Profile />
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <p className="eyebrow">What a verb turns into</p>
          <h2>Every question a parse can answer, answered before the agent opens.</h2>
          <p className="lead">
            Where a symbol lives. Whether two tables agree. Which command proves
            a change. What moved since last week. None of it is judgement, and
            all of it is billed at model rates today.
          </p>

          <div className="ledger">
            {VERBS.map(([verb, noun, says, cost]) => (
              <div className="lrow" key={verb}>
                <span className="verb">bb {verb}<span className="arrow">→</span></span>
                <span className="noun">{noun}</span>
                <span className="says">{says}</span>
                <span className={costClass(cost)}>{cost || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pipeline">
        <div className="wrap">
          <p className="eyebrow">The loop</p>
          <h2>Four stages. One of them can spend.</h2>
          <p className="lead">
            Every verb is a dry run until <code className="i">--apply</code>.
            Only <code className="i">run</code> and <code className="i">bridge send</code> can
            reach a paid model at all.
          </p>

          <div className="rail">
            {PIPELINE.map(([n, t, d, c]) => (
              <div key={t}>
                <div className="s">{n}</div>
                <div className="t">bb {t}</div>
                <div className="d">{d}</div>
                <div className={c === "spends" ? "c spend" : "c"}>{c}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="measured">
        <div className="wrap">
          <p className="eyebrow">Measured, not projected</p>
          <h2>The bill is a number the tool reads back to you.</h2>
          <p className="lead">
            bundlebox separates what it measured from what it estimated, and
            never adds the two. These three came off the reference workspace.
          </p>

          <div className="grid g3">
            {MEASURED.map((m) => (
              <div className="card" key={m.k}>
                <div className="k">{m.k}</div>
                <div className="n">{m.now}<small>{m.unit}</small></div>
                <div className="was">was {m.was} · {m.delta}</div>
                <div className="d">{m.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="uptake" className="field">
        <div className="wrap narrow">
          <p className="eyebrow">What bb uptake found</p>
          <p className="finding">Advisory lost. Enforcement is the fix.</p>
          <p className="lead" style={{ marginTop: 28 }}>
            Everything wired in front of the agent was a recommendation, and a
            recommendation loses to the model&rsquo;s own habit about three times in
            four. So the wiring changed kind: UserPromptSubmit now builds the
            brief itself — 0.47 s against a 15 s budget — and PreToolUse serves
            the region it already quoted instead of letting the file be reopened.
          </p>

          <div className="fracs">
            {UPTAKE.map(([v, l]) => (
              <div className="frac" key={l}>
                <div className="v">{v}</div>
                <div className="l">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="agents">
        <div className="wrap">
          <p className="eyebrow">Wiring</p>
          <h2>One command wires every agent on the box.</h2>
          <p className="lead">
            <code className="i">bb wire --apply</code> installs an instruction block
            between markers, hooks where the agent supports them, skills where it
            loads them, and an MCP entry. <code className="i">bb unwire</code> removes
            only its own.
          </p>

          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Agent</th><th>Instructions</th><th>Hooks</th><th>Skills</th><th>MCP</th></tr>
              </thead>
              <tbody>
                {AGENTS.map(([a, ins, hooks, skills, mcp]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td><code>{ins}</code></td>
                    <td>{hooks}</td>
                    <td>{skills === "—" ? "—" : <code>{skills}</code>}</td>
                    <td>{mcp === "—" ? "—" : <code>{mcp}</code>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="lead" style={{ marginTop: 26 }}>
            <a href={AGENT_DOCS} target="_blank" rel="noreferrer" style={{ color: "var(--mint)" }}>
              The full wiring guide →
            </a>
          </p>
        </div>
      </section>

      <section id="console">
        <div className="wrap">
          <p className="eyebrow">The console</p>
          <h2>One read-only page for the whole workspace.</h2>
          <p className="lead">
            <code className="i">bb console</code> serves it on{" "}
            <code className="i">127.0.0.1:7788</code>; <code className="i">bb console build</code>{" "}
            writes the same page as a single file with the state embedded. It binds
            to loopback, has no write route, and nothing on it calls a model. It
            pushes rather than polls, and the header always says which state the
            connection is in — a dashboard that cannot tell you it lost the server
            is worse than one that is plainly offline.
          </p>

          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Route</th><th>What it answers</th></tr></thead>
              <tbody>
                {ROUTES.map(([r, w]) => (
                  <tr key={r}><td><code>{r}</code></td><td>{w}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="install" className="field">
        <div className="wrap narrow">
          <p className="eyebrow">Install</p>
          <h2>Node, git, and about a minute.</h2>
          <p className="lead">
            Linux, macOS and Windows. CI runs the full suite on all three against
            Node 20, 22 and 24. A Rust kernel and a Python expert system make it
            faster and smarter, and everything degrades cleanly without them.
          </p>

          <div className="cmds">
            <CopyCommand command={INSTALL} />
            <CopyCommand command={INSTALL_ALT} wrap />
          </div>

          <pre style={{ marginTop: 26 }}>
{`$ cd your-repo
$ `}<b>bb init</b>{`            `}<i># detect languages, agents and gates</i>{`
$ `}<b>bb wire --apply</b>{`    `}<i># hooks, skills, instruction blocks, MCP entries</i>{`
$ `}<b>bb env up --apply</b>{`  `}<i># build everything a session reads</i>{`
$ `}<b>bb scan</b>{`            `}<i># the detectors. Seconds, 0 tokens</i>{`
$ `}<b>bb pinpoint gaps</b>{`   `}<i># every finding as a located, quoted, budgeted brief</i>{`
$ `}<b>bb run --apply</b>{`     `}<i># the only verb that spends</i>{`
$ `}<b>bb session</b>{`         `}<i># what it used and what it saved, measured</i>
          </pre>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div>
            <a className="brand" href="#top">
              <Image src="/logo.svg" alt="" width={24} height={24} /> bundlebox
            </a>
            <p className="fine" style={{ marginTop: 14 }}>
              It never calls a model itself. There are no npm dependencies.
              MIT licensed.
            </p>
          </div>
          <div className="cols">
            <div className="col">
              <b>Project</b>
              <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
              <a href={NPM} target="_blank" rel="noreferrer">npm</a>
              <a href={`${REPO}/releases`} target="_blank" rel="noreferrer">Releases</a>
            </div>
            <div className="col">
              <b>Read</b>
              <a href={DOCS} target="_blank" rel="noreferrer">README</a>
              <a href={AGENT_DOCS} target="_blank" rel="noreferrer">Wiring agents</a>
              <a href={`${REPO}/blob/main/EXPLANATION.md`} target="_blank" rel="noreferrer">Explanation</a>
            </div>
            <div className="col">
              <b>Build</b>
              <a href={`${REPO}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">Contributing</a>
              <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Issues</a>
              <a href={`${REPO}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">Changelog</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
