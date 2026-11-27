# Build state

## Mission 001 • 27 November 2026

Verified on macOS x86_64, Intel i9-9880H, eight physical cores and 16 GiB RAM. Project Python 3.12.14, Node 24.22.1, Vite 7.3.6. Standalone Codex thread metadata reported GPT-6.2 Astra.

The 24-document TF–IDF/LSA backbone returns actual unit vectors with eight components. The frontend and API ran on loopback ports 5173 and 8000. Verified startup, shutdown, port release, restart, Vite hot update and Uvicorn worker reload. The gate passed 11 model and live HTTP tests, TypeScript, Vite production build and Chrome smoke checks at desktop and mobile widths. Chrome verified backend outage and recovery. Vite flagged the lazy Three.js chunk above 500 kB. Held-out steering and visualization quality were unmeasured.

## Continuation 002 · recovery

Recovered the uncommitted atlas on top of 49b4e48. The named public GitHub repository advertised no refs. Reused Python 3.12.14 and the installed locked frontend tree including Three.js 0.181.2. No physics engine was required. The recovered slice passed 18 model and live HTTP tests. Search, query coefficient inspection, displacement and repeatable latency evidence remain for the review gate.
