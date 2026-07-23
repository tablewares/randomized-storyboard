# Secondary template root

Empty by default. Pipeline 1's scoring engine checks this directory only
when no template under `/templates` scores >= `THRESHOLD` for a scene.
Add template folders here using the same standard as `/templates`
(`manifest.json`, `index.jsx`, `/assets`), and register any new key in
`src/pipeline3/templateRegistry.js` so it can actually be rendered.
