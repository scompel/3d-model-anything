# Local RoomPlan scans

The development viewer can open RoomPlan USDZ exports, including models embedded in Morpholio Trace projects. It preserves geometry and metric scale, translates the floor to zero, and provides orbit, top/front/side, wireframe, furniture inventory and floor-constrained walking views. Scan geometry and illustrative surface colors are explicitly labeled. These imports are not detailed reconstructions or photographic textures. The Layout and physics playground features are unavailable for these imports.

Keep models inside the ignored `data/scans/` directory. Add an ignored `data/scans/rooms.json`:

```json
[
  { "id": "local-example", "label": "My room", "file": "example.usdz" }
]
```

IDs must be unique and start with `local-`. Files must resolve inside `data/scans/`, including through symlinks. Restart `npm run dev` after changing the manifest; local rooms appear before the office demo. Original scan files are not modified.

Local rooms are available only through the development server, which binds to loopback by default. The Vite plugin returns an empty registry for production builds without reading the private manifest. Scans live outside the public asset directory, so `npm run build` does not copy them into the distributable viewer. Do not put personal scans into `data/web-assets/` or commit them.

For realistic materials, use reference photos or new captures with posed photography. A saved drawing or an orbital camera stored by a sketch app is not a photograph with a known capture pose. Old room geometry can remain useful even when new photos are needed.

Validation: `npm run test:local-rooms`, `npm run build`, and `python3 tools/audit-public.py`. Also inspect actual imported rooms in the browser; a build alone does not verify their appearance.
