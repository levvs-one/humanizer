# Design

Humanizer should feel like a well-made system utility: quiet, precise, and obvious.

The reference is Apple's restraint, not imitation of a specific Apple screen.

## Visual rules

Hierarchy comes from typography, spacing, alignment, and contrast.

Do not use decorative punctuation as layout. Middle dots, bullet separators, ornamental em dashes, and status strings assembled from symbols are not navigation or information architecture.

Do not use gradients, glowing borders, glass panels, badge walls, excessive pills, oversized marketing typography, or decorative charts.

Cards exist only when they represent a real grouping. A page should not become a stack of rounded rectangles because a component library makes that easy.

Controls use one consistent geometry. Primary actions are dark and quiet. Secondary actions are neutral. Color is semantic.

## Typography

Use the native system font stack. On Apple platforms this resolves to San Francisco without bundling font files.

Recommended scale:

- Page title: 30px / 36px, 650
- Section title: 17px / 24px, 600
- Body: 14px / 20px, 400
- Label: 12px / 16px, 600
- Supporting text: 12px / 18px, 400

Avoid all-caps interface labels.

## Spacing

Use a four-pixel base with an intentionally sparse scale:

```text
4  8  12  16  20  24  32  40  48  64
```

Large page boundaries should breathe. Small controls should not.

## Shape

- Major surfaces: 16–18px radius
- Inputs and buttons: 9–11px radius
- Thin neutral borders
- Shadows only when elevation has a functional meaning

A toggle may be pill-shaped because the control requires it. Random metadata should not be.

## Copy

Write interface copy as if a careful product team edited every line.

Bad:

```text
Supercharge your AI with next-level human-like magic.
```

Good:

```text
Describe how the model should work.
```

No exclamation marks by default. No fake enthusiasm. No filler explaining obvious controls.
