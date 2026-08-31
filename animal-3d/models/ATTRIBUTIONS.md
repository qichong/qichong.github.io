# Animal 3D model sources

## Existing project models
- `lion.glb`: https://github.com/code4fukui/vr-cats — Lion by kenchoo, CC BY-NC-SA 4.0.
- `tiger.glb`: existing project asset retained as-is; source record not changed.

## Existing fixed-source models
- `fox.glb`: legacy KhronosGroup/glTF-Sample-Assets Fox. PixelMannen model CC0 1.0; tomkranis rigging/animation CC BY 4.0; AsoboStudio/scurest conversion CC BY 4.0. This legacy asset is retained for compatibility; the active catalog uses `fox_-_realistic_3d_model_demo_free.glb`.
- `shark.glb`: Open Water source model by Optic_idealist — CC BY 4.0.
- `whale.glb`: Open Water source model by Bohdan Lvov — CC BY 4.0.
- `seagull.glb`: Open Water source model by The lighthouse keeper / geminga — CC BY-SA 4.0.
- `macaw.glb`: Open Water source model by Mateus Schwaab — CC BY 4.0.
- `starfish.glb`: Open Water source model by Digital Atlas of Ancient Life — CC0 1.0.
- `tuna.glb`: Open Water source model by Quaternius — CC0 1.0.
- `swordfish.glb`: Open Water source model by Quaternius — CC0 1.0.

## Newly uploaded project models
- `fox_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “FOX - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `lioness_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “LIONESS - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `alligator_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “ALLIGATOR - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `horse_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “HORSE - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `deer_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “DEER - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `rabbit_-_realistic_3d_model_demo_free.glb`: WildMesh 3D model published on Sketchfab as “RABBIT - Realistic 3D Model (DEMO FREE)” — CC BY 4.0.
- `black_panther.glb`: user-uploaded model; original source/license is not recorded in the repository and should be confirmed before redistribution.

## Runtime animation inspection
The page does not assume a universal action list. It reads the GLB `animations` array at runtime and displays every embedded animation clip as its own button, including the exact clip name and duration. This is the authoritative list for the copy of each GLB stored in this repository.

Open Water license details: https://github.com/bob6664569/open-water/blob/main/THIRD_PARTY_NOTICES.md
Khronos Fox source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
