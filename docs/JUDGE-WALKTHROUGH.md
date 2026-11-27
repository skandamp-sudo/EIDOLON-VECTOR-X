# Judge walkthrough

## Choose the demonstration build

Use the local FOCUS candidate for the Retrieval Debugger. Public Mission Control serves the released workspaces. Open the sidebar on desktop or **Open workspace menu** on a phone to reach all six workspaces. [Public Mission Control](https://eidolon-vector-x.vercel.app/#mission-control) · [Local Mission Control](http://localhost:5173/#mission-control)

Choose **Start Guided Demo** for the staged tour or **Explore Semantic Universe** for PS-05. In SUPPLY, **Delay supplier** changes the dated lot in the delivery timeline. In Intelligence, focus a view and press Right Arrow to rotate original, naive, learned and locked views together. In Research Lab, **Ranking metric** switches the archived retrieval chart between Recall@3 and nDCG@3. **Inspect a QASPER paper** shows family-level coverage and retrieval.

For a private local import, use only the loopback Data Foundry. For an offline presentation, use a previously generated local study portal or PDF and label screenshots and benchmark tables as recorded observations. If a live query fails, state the error before switching to the recorded result.

## One minute with the Retrieval Debugger

1. Open **Open Retrieval Debugger** in local Mission Control. Use the calibration collection and the query `telescope light`. Under **Expected relevant documents**, leave #6 selected. It describes a telescope mirror gathering light from the night sky.
2. Choose **Dense cosine** for both baseline and candidate. Keep K=3 and select **Run comparison**. Row #6 ranks first, Recall@3 and nDCG@3 are both 1, and the gate shows **PASS**.
3. Clear #6 and mark #24, the forest water-level record, as the only expected document. This deliberately tests how a missed judgment appears. Set **Minimum candidate Recall@K** to 1 and run again. The ranking stays the same. Row #24 ranks eighth, both metrics fall to 0, and **BLOCK** identifies the failed recall threshold.
4. Expand **Report identity** and select **Export reproducible report**. With the local service running, replay the downloaded file from the repository root using `python3 scripts/replay_focus.py /path/to/report.json`. An exact replay confirms the recorded calculation. Private-dataset exports contain the mapped text and judgments.

To investigate a real retrieval failure, keep the judgments fixed while changing the candidate method. Inspect the missed IDs, rank changes, protected-direction drift and abstentions together. This demonstration uses authored judgments on calibration sentences. Independent retrieval quality remains unmeasured.

## Three minutes with PS-05

| Time | Operator action | What to explain |
| --- | --- | --- |
| 0:00–0:35 | Open VECTOR-X from Mission Control. Embed “A telescope records light from a distant star.” Set strength to zero and inspect the original top three. | The same fitted encoder maps the query and the calibration documents to eight dimensions. At zero strength the vector and ranking should agree with the original. |
| 0:35–1:15 | Select Ocean, raise the signed strength, inspect a displaced document and read the retained cosine and overlap. | Ranking uses full-space cosine. The three-coordinate PCA view helps exploration and has measurable distortion. Report what changes on screen, including ties or unchanged ranks. |
| 1:15–2:10 | Open Intelligence. Compare naive, learned and locked settings with a protected concept. In the frontier, inspect gain, drift and applied strength. | The governor tests candidate endpoints and may reduce the strength to zero. A measured geometric gain alone does not establish better retrieval. |
| 2:10–3:00 | Open Evidence Vault. Show QASPER and the SciFact review notice. | On the 15 QASPER questions with relevance evidence, BM25 led unsteered nDCG@3 at 0.22295, ahead of expanded LSA at 0.14355 and MiniLM at 0.02044. The two new encoders met the geometric limits on 32/32 represented endpoints. Neither increased the share of methodology-labeled passages in the governed top three. |

## Five minutes across the six workspaces

| Time | Action |
| --- | --- |
| 0:00–0:40 | In CORTEX, search the coastal notes for water levels. Follow a source offset. Mark a passage and explain why different measurement sites weaken a claim of contradiction. |
| 0:40–1:20 | Open SUPPLY. Delay the membrane shipment, trace the projected ship date to its lot and review a simulated purchase proposal. Reset the ledger after the demonstration. |
| 1:20–2:00 | In SYMBIOSIS, change a protected concept, inspect the feasible alternatives and approve or reject one. Demonstrate undo. |
| 2:00–2:40 | In MORPH, opt in, record a preferred destination, accept its shortcut, restore the static layout and undo the change. Clear the local history afterward. |
| 2:40–3:45 | In VECTOR-X, compare the original and steered neighbors, then inspect signed gain and protected drift. Explain the equation below. |
| 3:45–4:25 | In CLARITY, inspect “Compare waves near the bank.” Select the intended reading and compare its real retrieved passages. A consequential unresolved instruction defers in the simulator. |
| 4:25–5:00 | Finish in Evidence Vault. Show the retrieval ranking above, the three SciFact 16D third-place discrepancies and the limits of the six authored inventory snapshots and eight ambiguity fixtures. |

## Architecture and mathematics

The React frontend calls a FastAPI service. The public process registers a restricted calibration API and checks the configured frontend origin. Local Foundry validates and hashes files, then batches text into the local encoder. The browser holds the dataset and its index for the view. SUPPLY replays a bounded deterministic event log. MORPH uses opt-in local rewards. Neither workflow requires an external model service.

For a unit query vector **x**, target direction **d** and signed strength **a**, the candidate is **y = (x + a d) / ‖x + a d‖**. Reject a path that crosses the zero vector. Semantic Lock takes an orthonormal basis **B** for the row space of protected directions **P** and uses **d′ = d − BᵀBd**. Normalizing the endpoint can still move a protected score. The governor therefore tests a descending grid for sufficient retained cosine **x·y**, bounded drift **max |P(y − x)|**, and positive signed target gain. The chosen point is feasible on that discrete grid. A conflicting direction can yield an unchanged query.

## Questions judges may ask

- **What improved on measured data?** At matched target gain, mean protected-axis drift fell from 0.33340 to 0.02267 for expanded LSA and from 0.30323 to 0.01977 for MiniLM. The independent change in results-section share worsened for both models. See the registered comparisons in [the research report](../REVIEW_PHASE_3.md).
- **Which encoder runs on the public site?** Public live inference uses the 8D calibration encoder. The local research runtime also supports 16D calibration LSA, 128D expanded LSA and 384D quantized MiniLM. Each probe checks the expected model identity. The public evidence panels show archived outcomes.
- **Are the suggestions verified scientific facts or supplier commitments?** Passage links express lexical or semantic similarity. Planner approvals update a simulated ledger. A participant study and independently labeled domain cases are still needed to assess efficacy.
- **Why is the Phase 3 tag absent?** The frozen SciFact reproduction exchanged third-place IDs in three 16D comparisons. The exchanged documents were irrelevant to the affected claims. Only 16 of 164 claims were represented. Reviewers can inspect both preserved runs.

## Local fallback

From the prepared checkout, run `./scripts/start`, open [Mission Control](http://localhost:5173/#mission-control), and check [API health](http://localhost:8000/api/v1/health). If an optional encoder is unavailable, use the calibration atlas for live inference and Evidence Vault for the archived comparison. The four-encoder local demonstration requires the hash-verified model assets and operational wheel lock described in the [README](../README.md). Use synthetic field notes on the projector. For the hosted demonstration, open [public Mission Control](https://eidolon-vector-x.vercel.app/#mission-control).

## Five-minute ASCENSION path

1. Open #system-flow, choose VECTOR-X and inspect the representability decision and the PCA display branch.
2. In #retrieval-debugger select 16D LSA, telescope light, relevant ID 6, Ocean target, Botanical protection, strength −1, K=3, drift cap 0.05 and cosine floor 0.8. Compare dense with constrained steering. Top three: 1, 6, 4 → 6, 1, 4. Recall remains 1, nDCG rises from 0.63093 to 1 on this authored task.
3. In local Data Foundry map the body column of /evidence/judge/vocabulary-gap.csv, then debug xylolith with relevant ID 1. Dense abstains. Fusion retrieves ID 1. Keeping the judgments fixed, requiring geometry blocks the fusion candidate.
4. Export the report and run .venv/bin/python scripts/replay_focus.py REPORT.json with the verified local model and API.
5. Open #evidence-vault. Show BM25 nDCG 0.22295, the independent results-section deterioration and the 16/164 SciFact coverage. If local inference is unavailable, identify the downloadable report as archived. Use #guided-demo for the overview or six-workspace tour.
