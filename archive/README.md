# Archive

Code preserved here is **not part of the ClearBorder build** — it's kept for reference
so nothing is lost after the old feature branches were removed.

## `portail-douane-fr/`

An alternate, highly polished **French customs portal** ("DELTA-X", styled as
*République Française — Direction générale des douanes*), built in Python/FastAPI. It was an
earlier candidate for the Computer Use target before we standardized on the in-repo TypeScript
EU "Single Window" portal (`portal/`) for a single-language monorepo.

It is fully self-contained and still runnable on its own:

```bash
cd archive/portail-douane-fr
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3000
```

If you ever want the French-customs skin instead of the EU one, point
`PORTAL_URL`/`CU_*` in the server's `.env` at it and adapt the selectors in
`server/src/computer-use-live.ts` (the DELTA-X selectors are documented in its
`spec_portail_douane_mock_v2.md`).
