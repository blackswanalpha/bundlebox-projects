# 01 · Spine
- owes: a thesis sentence and a named unit of work
- prevents: a build that is a pile of features with no way to say it is done

Every system has one sentence that survives when the feature list is deleted.
Write it first, and write it as a claim that could be **wrong**:

> bundlebox answers every question a parse, a count, a path check or a set
> difference can answer *before* the agent opens.

Not "bundlebox is a productivity tool for AI coding." The first can be falsified
by finding one such question it does not answer. The second cannot be falsified
at all, which is why it is worthless in a prompt.

Then name the **unit of work** — the thing that is either done or not done, with
nothing in between. Everything downstream is measured in units:

- a *finding* is not a unit; it is an observation
- a *file* is not a unit; it is a location
- a *unit* is one problem, packed to one window, with one acceptance command

If you cannot say how many units the system is, you cannot budget it, and the
number at the bottom of the prompt is decoration.

**Write into the prompt:** the thesis, the unit definition, the unit count.
