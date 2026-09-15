# The patterns

A system is built from these in order. Each file answers one question, declares
what it **owes** the next pattern, and names the **failure** it prevents. The
compiler (`storybook/build.mjs`) reads them in filename order and emits one
prompt per lane, so the order here is the order of the prompt.

| # | pattern | the question it answers |
|---|---|---|
| 01 | spine | what is this, in one sentence, and what is the unit of work |
| 02 | surfaces | what the product has, and what each surface owes |
| 03 | contracts | the data shapes that are the only agreement between stages |
| 04 | states | the six a surface must draw before it is a surface |
| 05 | gates | what proves a change, as a command |
| 06 | lanes | how the work is cut so each piece fits one window |
| 07 | evidence | why the prompt carries findings and not instructions to go looking |
| 08 | budget | the token accounting, and what it costs to not have it |
| 09 | evolve | interview → seed → execute → evaluate → evolve |
| 10 | verify | mechanical, semantic, runtime, consensus — cheapest first |

A pattern that cannot name its failure is a preference, and preferences do not
belong in a prompt that costs six figures of tokens to execute.
