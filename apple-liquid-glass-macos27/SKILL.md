---
name: apple-liquid-glass-macos27
# Keep this description specific because Antigravity uses it to decide when to load the skill.
description: Rebuild or refine an existing app UI to closely match the current macOS 27 Apple Liquid Glass design language, including glass materials, floating functional layers, sidebars, toolbars, controls, interaction states, motion, adaptive tint, accessibility, and performance. Use for UI/UX modernization, Liquid Glass implementation, or Apple-style visual polish in native or web apps.
---

# Apple Liquid Glass macOS 27 Skill

## Mission

Transform the existing application UI into a coherent macOS 27-inspired Liquid Glass interface. Preserve all existing business logic, routes, data flows, APIs, state management, and working functionality unless the task explicitly asks for functional changes.

The objective is NOT to cover every surface in glass. Apple treats Liquid Glass as a distinct functional layer for navigation and controls, while content remains a separate layer. Use glass to create hierarchy, depth, focus, and responsive interaction rather than turning the entire app into translucent cards.

For web applications, reproduce the observable visual and interaction language as closely as technically possible. Do not claim the browser is using Apple's private/system Liquid Glass renderer. When native SwiftUI/AppKit APIs are available, prefer the official system APIs over custom imitation.

## Source of truth

Follow the current Apple design guidance for:

- Human Interface Guidelines: Materials
- Human Interface Guidelines: Designing for macOS
- Human Interface Guidelines: Sidebars
- Human Interface Guidelines: Toolbars
- Human Interface Guidelines: Buttons
- SwiftUI Liquid Glass APIs: glassEffect, GlassEffectContainer, glassEffectID, glassEffectTransition, glassEffectUnion, GlassButtonStyle, GlassProminentButtonStyle, interactive
- SwiftUI accessibilityShowBorders
- SwiftUI backgroundExtensionEffect
- macOS 27 AppKit/SwiftUI design updates, including interactive glass and concentric corner behavior

When Apple guidance conflicts with a custom visual preference, prioritize Apple's documented behavior unless the user explicitly asks for a deliberate deviation.

## Activation decision tree

1. If the project is SwiftUI/AppKit:
   - Prefer native Liquid Glass APIs and system controls.
   - Avoid manually recreating effects that the framework already provides.
   - Use native toolbar, sidebar, navigation, button, and material behavior first.

2. If the project is React/Next/Vite/Svelte/Vue or another browser UI:
   - Implement a reusable CSS/JS Liquid Glass system that approximates the same optical hierarchy and interaction behavior.
   - Use progressive enhancement: backdrop-filter first, then layered gradients, borders, shadows, and motion.
   - Keep content and glass layers structurally separate.

3. If the project uses Electron/Tauri/WebView:
   - Treat the renderer as a web implementation.
   - Preserve native window behavior where the host provides it, but do not fake unavailable system APIs.

4. If the task is only a visual refresh:
   - Do not rewrite application architecture.
   - Inspect the existing component system and modify the smallest set of shared primitives necessary to propagate the new design consistently.

## Non-negotiable design rules

### 1. Two-layer composition

Build the UI as:

- Content layer: opaque or standard-material surfaces, data, lists, tables, images, charts, editors, and primary content.
- Functional glass layer: navigation, toolbar controls, floating actions, transient controls, and important contextual controls.

Do not put Liquid Glass on every card, table row, panel, input, and background. Excess glass destroys hierarchy.

### 2. Glass is optical, not just translucent

A convincing implementation must combine several effects:

- background translucency
- backdrop blur
- saturation/vibrancy adaptation
- subtle specular highlight
- soft edge/rim lighting
- restrained inner highlight
- depth shadow
- background color transmission
- interaction-driven light response
- subtle shape deformation or lensing where technically feasible

Never implement Liquid Glass as a single white rectangle with `opacity` + `backdrop-filter: blur(...)`.

### 3. Regular vs clear

Use two semantic variants:

- `regular`: default functional glass for most floating navigation and controls.
- `clear`: only over visually rich backgrounds where greater background visibility improves the composition.

The choice must be semantic, not merely based on which tint looks prettier.

### 4. Functional elements float over content

Sidebars and toolbars should read as an elevated functional layer. Important content should visually continue beneath them where appropriate instead of being boxed into an unrelated background region.

For a browser implementation, achieve this with true overlay positioning and content extension, not by simply placing a glass-colored panel beside the content.

### 5. macOS 27 sidebar behavior

For wide desktop layouts:

- Sidebar can extend to the window edge.
- Content should still visually continue beneath/behind the sidebar when appropriate.
- Keep navigation hierarchy shallow and readable.
- Selected state should be obvious without relying only on heavy color fills.
- Respect the active/inactive window concept.

When space becomes constrained, collapse or adapt navigation rather than squeezing everything into the sidebar.

### 6. Toolbar behavior

Toolbars should be deliberate and uncluttered.

- Keep only high-value actions visible.
- Group related controls.
- Use familiar system-like icons.
- Reserve overflow for secondary actions.
- Avoid turning every toolbar item into a large pill.
- Toolbar elements should feel like they belong to one glass surface.

### 7. Buttons and controls

Use semantic component variants instead of ad-hoc styling:

- `glass`
- `glass-prominent`
- `bordered`
- `plain`
- `toolbar`
- `icon-only`

For native SwiftUI, prefer `glassButtonStyle` / `glassProminent` for glass buttons rather than applying a raw `glassEffect` to the button itself.

Every custom interactive control must have clear states:

- idle
- hover
- focus
- pressed
- disabled
- selected/toggled
- loading, where relevant

A click must produce immediate visual feedback.

### 8. macOS pointer interaction

Design for mouse and trackpad, not only touch.

Hover should be subtle and informative. Avoid exaggerated scale changes. Use small changes in luminance, specular highlight, border intensity, shadow, or local lensing.

Pressed interaction should be tactile and short. On macOS 27-inspired surfaces, selected interactive glass controls may use a restrained bounce/deformation effect, but only for controls where it reinforces the action. Never animate every glass surface on every click.

### 9. Concentric corners

Nested surfaces near the edge of a window should visually agree with the parent container's corner geometry.

Do not give every nested panel an unrelated `border-radius`.

Define a shared corner system and derive nested corner values from the container radius plus inset. Near a corner, child geometry should visually follow the parent curve.

### 10. Adaptive tint

Implement Liquid Glass tint as a semantic token rather than hard-coded color values.

Expose a theme variable such as:

`--glass-tint-strength`

and support at least:

- ultra-clear / low tint
- default / balanced
- stronger tint

The default should remain subtle. Tint must not turn the interface into a colored acrylic theme.

### 11. Active vs inactive window

The interface should distinguish the active app/window from an inactive state.

For web apps that simulate multiple panes/windows, reduce non-active chrome emphasis rather than simply hiding it. Text and icons may become slightly less prominent while preserving usability.

### 12. Accessibility is part of the visual system

Support:

- reduced motion
- reduced transparency / low-transparency mode
- increased contrast
- keyboard focus visibility
- visible control boundaries when a 'show borders' preference is enabled
- sufficient text/icon contrast
- pointer accessibility
- scalable text

If the platform provides a system preference equivalent to `accessibilityShowBorders`, custom controls must visibly expose their boundaries when that preference is enabled.

When reduced transparency is active, replace translucent effects with a more opaque semantic surface. Do not merely lower opacity and accidentally reduce readability.

### 13. Typography

Use the platform's system font stack whenever possible.

Web preference:

`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif`

Use typography to establish hierarchy. Do not compensate for weak hierarchy with stronger glass effects.

Maintain Apple-like restraint:

- tight but readable labels
- strong primary title
- subdued secondary metadata
- no unnecessary all-caps UI
- consistent numerical alignment in dense data views

### 14. Icons

Use simple, familiar, optically balanced icons. Icons must align with text baselines and control geometry.

Prefer a single icon language across the application. Do not mix random icon packs, filled emoji, and unrelated stroke styles.

For native Apple applications, use SF Symbols where appropriate and supported.

### 15. Motion system

Motion must communicate hierarchy, continuity, and response.

Use:

- short hover transitions
- fast press feedback
- spring-like entrance for floating controls
- smooth shared-element transitions for morphing controls
- subtle position/scale interpolation when navigation changes
- scroll-linked opacity or blur adjustments only where they improve hierarchy

Avoid:

- bounce on every element
- perpetual animation
- large scaling
- slow decorative transitions
- motion that changes layout unexpectedly

Recommended browser defaults as starting points, not rigid laws:

- hover: 120–180ms
- press: 80–140ms
- standard state transition: 180–260ms
- panel appearance: 220–380ms
- spring settle: 350–550ms

Use platform-appropriate easing. Prefer spring physics for tactile state changes when the framework supports it; otherwise use a cubic-bezier curve with a quick response and gentle settle.

### 16. Glass morphing

When multiple glass controls form a related group, treat them as one visual system.

Do not render each glass item as a visually isolated frosted card.

For native SwiftUI, use `GlassEffectContainer` together with glass effects and IDs where appropriate so related glass shapes can blend and morph.

For web apps, approximate this with a shared glass-group layer, shared shadow field, coordinated hover state, and layout-aware interpolation. Use a single backdrop surface where practical rather than stacking many expensive backdrop filters.

## Web implementation architecture

Create reusable primitives before restyling individual screens.

At minimum implement:

- `GlassSurface`
- `GlassToolbar`
- `GlassSidebar`
- `GlassButton`
- `GlassIconButton`
- `GlassToggle`
- `GlassSegmentedControl`
- `GlassMenu`
- `GlassPopover`
- `GlassSearch`
- `GlassGroup`
- `GlassModal`

Every primitive must accept semantic properties such as:

- variant: regular | clear
- tint
- interactive
- prominence
- size
- radius
- disabled
- selected
- emphasis

Use design tokens instead of repeating raw CSS values.

Suggested token families:

```css
:root {
  --glass-radius-xs: 10px;
  --glass-radius-sm: 12px;
  --glass-radius-md: 16px;
  --glass-radius-lg: 20px;
  --glass-radius-xl: 26px;

  --glass-blur-regular: 28px;
  --glass-blur-clear: 34px;

  --glass-saturation: 145%;
  --glass-bg-alpha: 0.46;
  --glass-border-alpha: 0.22;
  --glass-highlight-alpha: 0.28;

  --glass-shadow-y: 12px;
  --glass-shadow-blur: 34px;

  --glass-tint-strength: 0.08;

  --motion-fast: 140ms;
  --motion-base: 220ms;
  --motion-slow: 360ms;
}
```

These values are a starting scaffold only. Tune against the actual background and viewport rather than blindly copying numbers.

### Reference browser pattern

A web glass surface should be composed from layers similar to:

```css
.glass-surface {
  position: relative;
  overflow: clip;
  background:
    linear-gradient(
      135deg,
      rgb(255 255 255 / calc(var(--glass-bg-alpha) + .08)),
      rgb(255 255 255 / var(--glass-bg-alpha))
    );
  -webkit-backdrop-filter:
    blur(var(--glass-blur-regular))
    saturate(var(--glass-saturation));
  backdrop-filter:
    blur(var(--glass-blur-regular))
    saturate(var(--glass-saturation));
  border: 1px solid rgb(255 255 255 / var(--glass-border-alpha));
  box-shadow:
    0 1px 0 rgb(255 255 255 / var(--glass-highlight-alpha)) inset,
    0 var(--glass-shadow-y) var(--glass-shadow-blur) rgb(0 0 0 / .10),
    0 1px 2px rgb(0 0 0 / .08);
}

.glass-surface::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      140% 90% at var(--glass-pointer-x, 50%) var(--glass-pointer-y, 0%),
      rgb(255 255 255 / .18),
      transparent 42%
    );
  opacity: var(--glass-highlight-opacity, .55);
  transition: opacity var(--motion-base) ease;
}
```

Then add pointer-aware local lighting, pressed deformation, selected-state emphasis, and clear/regular variants in a controlled component layer. Do not copy this snippet blindly into every project.

## Background strategy

Liquid Glass needs something meaningful behind it.

Prefer a content background with:

- real images, gradients, charts, data, or color fields
- enough visual variation to reveal translucency
- good contrast beneath controls
- no artificial noisy texture added solely to make blur visible

When a glass element has nothing interesting beneath it, use a simpler opaque/standard material instead of forcing a transparent panel.

## Performance rules

Liquid Glass effects can be expensive, especially in the browser.

- Avoid large full-screen `backdrop-filter` regions unless necessary.
- Avoid stacking many nested blur layers.
- Prefer one shared backdrop surface for grouped controls.
- Use pseudo-elements for highlights instead of additional DOM nodes where practical.
- Avoid filter animations when transform/opacity can communicate the same state.
- Respect reduced-motion preferences.
- Use `contain`, clipping, and compositing carefully.
- Test scrolling performance with realistic data, not an empty demo page.
- Do not trade away interaction responsiveness for prettier blur.

## Responsive behavior

The design must remain coherent at:

- small laptop windows
- large desktop windows
- maximized windows
- split-screen layouts
- high-DPI displays
- browser zoom above 100%

Never let glass controls overlap essential content merely to preserve a screenshot-like composition.

## Implementation workflow

1. Inspect the existing project and identify framework, design system, routing, component library, and current CSS architecture.
2. Run the app before changing it and record the current visual state.
3. Identify the highest-level structural surfaces: app window, sidebar, toolbar, content region, overlays.
4. Build or refactor shared Liquid Glass primitives.
5. Apply the two-layer architecture.
6. Convert navigation and high-value controls to semantic glass variants.
7. Add pointer, pressed, selected, keyboard-focus, and inactive states.
8. Add adaptive tint and accessibility modes.
9. Add motion only after layout and hierarchy are correct.
10. Test the UI on bright, dark, colorful, low-contrast, and image-heavy backgrounds.
11. Test reduced motion, reduced transparency, increased contrast/show borders, keyboard navigation, and narrow widths.
12. Profile rendering and remove unnecessary blur layers.
13. Visually compare the result against current Apple macOS 27 guidance and fix the largest mismatches first.
14. Preserve all existing app functionality and verify no regressions.

## Visual QA checklist

The implementation is not complete until all of the following are true:

- Glass is limited to functional/navigation surfaces rather than applied indiscriminately.
- Background content can visually continue beneath floating functional surfaces where appropriate.
- Glass looks translucent and optically layered, not like flat frosted plastic.
- Regular and clear variants are visibly but appropriately different.
- Hover, focus, pressed, selected, disabled, and inactive states are distinct.
- Controls respond quickly to mouse/trackpad interaction.
- Related glass controls feel like one group rather than separate cards.
- Nested corners visually agree with the parent container.
- Sidebar and toolbar hierarchy feels native to macOS.
- Text remains legible over changing backgrounds.
- Show-borders/increased-contrast behavior remains usable.
- Reduced-motion and reduced-transparency modes remain fully functional.
- No major scroll-jank appears during real data rendering.
- No existing app feature is broken.

## Anti-patterns

Do NOT:

- make every component translucent
- use glass cards as a replacement for layout hierarchy
- use giant corner radii everywhere
- add heavy white borders around everything
- use strong neon gradients behind every panel
- animate blur continuously
- make every click bounce dramatically
- copy iOS mobile navigation conventions into a desktop Mac app without adaptation
- use raw `glassEffect` on native buttons when a native glass button style is the correct API
- fake missing native APIs with misleading labels or claims
- rewrite business logic during a visual task

## Completion rule

When the visual result is not convincing, do not add more decoration first. Diagnose the mismatch in this order:

1. hierarchy
2. geometry
3. content-under-glass relationship
4. material/translucency
5. typography and iconography
6. interaction states
7. motion
8. micro-highlights

The final result should feel like a coherent Apple platform interface rather than a collection of glass effects.
