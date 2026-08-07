# Reality graph — repo pin, regen order, and the prompt

**For:** whoever wires the reality-ingest job in `metamax-ux-test`.
**Status:** the pin file exists in this repo but is **hand-written**. Nothing maintains it. That is the
work this document is asking for.

---

## The problem

A project's Reality graph is tied to one commit. Today the only way to know *which* is to call the MCP
and read the `freshness` block it attaches to an answer:

```json
"freshness": {
  "graph_head": "4b648313936cd21ed1498bd09cbd54b60636d072",
  "live_head":  "023647578c3d4a8a911906d6f24e501320cd1976",
  "stale": true
}
```

That works, but only with a live backend, only from inside a tool call, and it leaves no trace. You
cannot see from the repo when the graph last moved, and a PR cannot show that a change landed against a
graph that never saw it.

Measured cost on Bulwark MM (project 16): the graph has been pinned at `4b648313` since **2026-07-25**
while `main` advanced **39 commits** through an entire save-architecture rebuild. Every `impact_of` and
`does_exist` answer over that window described code that no longer existed, and nothing in the repo said
so.

---

## What is being asked for

**The ingest job writes `.metamax/reality.json` into the ingested repo, and commits it.**

A hand-written version is committed now as the shape to match:

```json
{
  "project_id": 16,
  "project": "Bulwark MM",
  "graph_head": "4b648313936cd21ed1498bd09cbd54b60636d072",
  "ingested_at": "2026-07-25T18:17:19Z",
  "totals": { "nodes": 1490, "edges": 1134 }
}
```

`_`-prefixed keys in the committed file are documentation for humans; the job may drop or regenerate
them. The four load-bearing fields are `project_id`, `graph_head`, `ingested_at`, `totals`.

### Why in the repo rather than only in the API

- Readable with **no live backend** — a session that cannot reach MetaMax can still tell whether the
  graph is worth trusting.
- **Diffable.** A PR shows whether the graph moved with the code.
- **Historical.** `git log .metamax/reality.json` answers "when did the graph last actually run", which
  is exactly the question nobody could answer for those 39 commits.

---

## The wrinkle that breaks the naive implementation

**`graph_head` is the commit the ingest READ. The commit that writes the pin is a different, later
commit.**

So immediately after a successful regen:

```
graph_head = A          <- what the ingest actually analysed
HEAD       = A + 1      <- the pin commit the job just made
```

A reader comparing `graph_head` to `HEAD` sees a one-commit gap and concludes the graph is stale — one
second after it was regenerated. If a regen prompt is wired to that comparison, **it fires forever and
can never be satisfied.**

**Required rule:**

> staleness = commits between `graph_head` and `HEAD`, **excluding the pin commit itself**.

Equivalently: a graph is fresh when `HEAD` is either `graph_head`, or the pin commit whose parent is
`graph_head`. Anything beyond that is genuinely behind.

Two implementations, either is fine:
- Compute the gap and subtract the pin commit when `HEAD` is the pin commit; or
- Have the job record `pin_commit` alongside `graph_head` once it knows its own SHA (a second write, or
  amend), so readers compare against a value rather than inferring one.

The first is simpler and needs no second write.

---

## Regen ordering

**push `main` → TEST on main remote → regen.**

Not regen-then-push. Two reasons, and the second is the binding one:

1. Regenerating before the test bakes an **unvalidated** state into the graph. If the test fails and the
   code changes, the graph describes something that never shipped.
2. **MetaMax can only test against `main` remote.** So the state worth capturing does not exist until
   after the push, and cannot be validated until after the test.

This supersedes an earlier "pull main into branch, regen, then push" ordering — that one regenerates
against a state nobody has exercised.

---

## The regen prompt

Derived, never stored.

- **Ask when** `graph_head` is behind `HEAD` by more than the pin commit.
- **Quantify it.** *"Graph is 39 commits behind main — regen?"* is a decision. *"Graph is stale"* is
  noise, and the commit count is the difference between deferring knowingly and deferring because you
  cannot judge.
- **A decline stores nothing.** No flag, no marker, no "asked already" record. The gap is recomputable
  from the pin file and from the MCP, so the next session simply sees it and asks again. A stored
  decline is a fact that rots — the same reason the MCP keeps expiring facts in its `caveats` block
  rather than writing them somewhere long-lived.
- **Do not re-ask every turn.** Once per session on the first Reality call, and again only if the gap
  materially grows. A prompt that nags gets ignored, which is worse than not asking — it trains people
  past the one signal that matters.

---

## Blocking issue to confirm first

`backend/devtool_jobs.py` documents, in its own comments, that a **stale job row can silently block
every subsequent reality-graph run for a project**:

> *"a corpse silently BLOCKED every new reality-graph run for that project"*

and separately records an ingest pass running ~62 minutes on 2026-08-03.

If that is what has been happening on project 16 since 2026-07-25, then:

- a user who says **yes** to the prompt gets **no graph and no error**, and
- the prompt fires again next session, forever, with nothing able to satisfy it.

**Confirm the job actually runs and clears before wiring a prompt around it.** A prompt in front of a
blocked job is worse than no prompt: it converts a silent failure into a repeating one.

The pin file makes this diagnosable from the repo for the first time — if a regen is triggered and
`.metamax/reality.json` does not move, the job did not complete.

---

## Acceptance

- The ingest job writes `.metamax/reality.json` with `project_id`, `graph_head`, `ingested_at`, `totals`.
- The freshness comparison excludes the pin commit; a just-regenerated repo reads **fresh**, not one
  behind.
- A blocked or failed ingest leaves the pin **unchanged** — it must never advance on a run that did not
  finish, or the file starts lying and is worse than nothing.
- A regen prompt states the commit count, asks at most once per session, and stores nothing on decline.
