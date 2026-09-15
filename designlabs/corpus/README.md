# corpus/

What `bb designlabs collect` and `bb designlabs intake` write. One JSON file per
reference, in the shape `bb designlabs intake` validates:

    { "id", "source", "url", "captured", "kind", "observed": [], "taken": [], "refused": [], "license" }

`observed` is what is actually on the page. `taken` is what you are carrying into
this system and why. `refused` is what you looked at and decided against — the
most useful field, and the one that stops a corpus becoming a mood board.
