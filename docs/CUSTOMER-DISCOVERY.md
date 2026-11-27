# Search and RAG engineering interviews

Status: discovery plan. Interviews conducted for this release: 0. Customer count, revenue and willingness to pay are unknown.

## Hypotheses to test

| Proposed user | Suspected pain | Competing workflow to investigate |
| --- | --- | --- |
| Search engineer | Relevance regressions escape aggregate dashboards. | In-house judgments, offline evaluators and ranking diffs in notebooks. |
| RAG developer | A poor answer is difficult to attribute to retrieval versus generation. | Tracing platforms, vector database consoles and manual inspection of retrieved chunks. |
| ML researcher | Ranking gains can conceal drift or low coverage. | Benchmark scripts, ablation studies and per-query error analysis. |
| Retrieval QA lead | Reviewers lack replayable evidence for a release decision. | CI thresholds, spreadsheets, saved requests and manual sign-off. |

## A 15-minute interview

Begin with a recent incident. Ask permission before recording. Invite the participant to describe the case without disclosing private queries, documents or customer identifiers.

1. Walk me through the last search change that made a previously good result worse. Who noticed, and how?
2. Which record told you what the query should have retrieved? Who supplied and maintained those judgments?
3. Can you trace the last investigation from first alert to diagnosis? Which tools did you open, how long did it take, and where did you repeat work?
4. How did you distinguish missing documents, weak retrieval, reranking and generation errors? Describe a case your current tools handled well.
5. Which thresholds, regressions or exceptions could stop your next release? Who owns that decision?
6. What would a colleague need to independently replay the incident? Which data must stay on your infrastructure?
7. If you could change one step in that workflow, which one would it be? What would make a separate debugger unnecessary?
8. What do you spend today in engineering time or tools on this problem? Which budget would fund an alternative, who approves it, and at what price would a pilot cease to be worth considering?
9. Would you commit a sanitized task and a reviewer to a time-boxed trial? What observable result would justify continuing or paying?

Record concrete past behavior separately from estimates and hypothetical interest. With permission, compare current-tool and prototype runs on the same independently supplied incident. A budget estimate or a positive interview is weaker evidence than an approved paid pilot.
