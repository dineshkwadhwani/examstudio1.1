# Task 1 — Fetch your colour

1. Open `fetch-colour.mjs` and replace `PASTE_YOUR_API_KEY_HERE` with your exam API key.
2. From the repository root, run with Node.js 20 or newer:

   ```sh
   node test/actors/task-1/fetch-colour.mjs
   ```

3. Read `Your colour:` in the terminal and select that colour on the exam page.

The client sends a GET request with the `X-API-Key` header and prints the returned `magic_code`. It does not submit your colour selection. The exam must be running.

This client is excluded from Git because you will paste your key directly into it.
