# Focus Party — React frontend

Vite + React. See the main [README](../README.md).

```bash
npm install
npm run dev      # http://localhost:5173, mock backend by default (VITE_USE_MOCK=false for the real API)
npm run build    # writes the app into ../web
```

- `src/api/client.js`: every network call (mock or real Yii API)
- `src/api/mock.js`: full fake backend in localStorage
- `src/rules.js`: game formulas (mirrored in `components/Rules.php`)
- `src/avatar`, `src/pets`, `src/scene`: pixel art recolouring and scene helpers
