# Engine Audit Report

Date: 2026-02-10
Scope: PlayCanvas engine only (engine/)
Method: Automated tests (mocha) + manual checklist placeholder

Status legend:
- PASS: Tests passed for this area
- FAIL: Tests failed for this area
- PENDING: Tests skipped or pending
- NOT_TESTED: No automated coverage verified yet
- WARN: Non-fatal warning observed

## Environment
- OS: macOS
- Node: Using repo scripts (engine/package.json)
- Test command: npm --prefix engine test

## Test Summary
- Passing: 1605
- Pending: 2
- Failing: 0

## Warnings Observed (non-fatal)
- WARN: No support for 3D audio found (test environment)
- WARN: Ammo.js not loaded (JointComponent asserts in tests)

## Coverage by Area (initial)
| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Core event handler | PASS | event-handler tests |  |
| Core math (vec/mat/quat/curve) | PASS | math tests |  |
| Core utils (guid/hash/path/uri) | PASS | core tests |  |
| GraphNode / hierarchy | PASS | graph-node tests |  |
| Scene registry | PASS | scene-registry tests |  |
| Layer composition | PASS | layer-composition tests |  |
| Graphics state (Blend/Depth) | PASS | graphics tests |  |
| Input (keyboard/mouse) | PASS | input tests |  |
| Http | PASS | net/http tests |  |
| Materials (Material/StandardMaterial) | PASS | material tests |  |
| Components: entity/component system | PASS | entity/component tests |  |
| Assets: registry, reference, loaders | PASS | asset tests |  |
| UI: element (image/text) | PASS | element tests |  |
| Particles | PASS | particlesystem tests |  |
| Sprites (component/handler) | PASS | sprite tests |  |
| I18n | PASS | i18n tests |  |
| Audio | WARN | runtime warning | test env lacks 3D audio |
| Physics (Ammo.js) | WARN | joint component asserts | Ammo not loaded |
| XR | NOT_TESTED | no tests observed |  |
| Animation | NOT_TESTED | not verified in this run |  |
| Script system | PASS | script tests |  |

## Module Checklist (by engine/src)

### core/
- event-handler: PASS
- guid/hash/path/uri/string/set-utils: PASS
- math/*: PASS
- preprocessor: PASS
- shape/*: PASS
- sorted-loop-array/indexed-list: PASS

### platform/
- graphics/*: PASS (BlendState/DepthState)
- input/*: PASS (Keyboard/Mouse)
- net/*: PASS (Http)
- sound/*: WARN (3D audio not supported in test env)

### scene/
- composition/layer-composition: PASS
- graph-node: PASS
- materials/*: PASS (Material/StandardMaterial)

### framework/
- application/app-base: PASS (coverage via tests)
- scene-registry: PASS
- entity: PASS
- component system: PASS
- asset/*: PASS
- handlers/sprite-handler: PASS
- components:
  - anim: NOT_TESTED
  - animation: NOT_TESTED
  - audio-listener: WARN (audio support missing)
  - button: NOT_TESTED
  - camera: NOT_TESTED
  - collision: NOT_TESTED
  - element (image/text): PASS
  - gsplat: NOT_TESTED
  - joint: WARN (Ammo not loaded)
  - layout-child: NOT_TESTED
  - layout-group: PASS (tests exist)
  - light: NOT_TESTED
  - model: NOT_TESTED
  - particle-system: PASS
  - render: NOT_TESTED
  - rigid-body: NOT_TESTED
  - screen: NOT_TESTED
  - script: PASS
  - scroll-view: NOT_TESTED
  - scrollbar: NOT_TESTED
  - sound: NOT_TESTED
  - sprite: PASS
  - zone: NOT_TESTED
- i18n: PASS
- input/*: NOT_TESTED (framework input wrappers)
- xr/*: NOT_TESTED
- gsplat/*: NOT_TESTED
- lightmapper/*: NOT_TESTED
- parsers/*: NOT_TESTED
- bundle/*: PASS (bundle-registry tests)

## Manual Checklist (pending)
- Render a basic scene (camera + light + cube)
- Load a texture asset via AssetRegistry.loadFromUrl
- Create sprite asset and assign to SpriteComponent
- Add ImageElement and TextElement to UI
- Spawn ParticleSystemComponent
- Validate I18n load/unload without errors
- Validate AudioListener + SoundComponent in browser
- Validate physics (rigid-body + collision) with Ammo.js loaded

## Fixes Applied
1) Added jsdom Image and canvas 2D context shims for test asset loading.
2) Guarded i18n parsing during teardown to avoid null parser errors.

## Next Actions
1) Add or enable environment setup for audio and Ammo.js if required.
2) Consider adding explicit tests for XR, gsplat, lightmapper, and parsers.
