# Hello Team Brand Guidelines

## Brand Identity

Hello Team is a workforce management platform that helps businesses manage remote workforce activity, client approvals, payroll preparation, and employee engagement.

---

## Color Palette

### Primary Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Primary Orange | `#f7a816` | rgb(247, 168, 22) | Main brand color, sidebar, buttons, links, active states |
| Primary Light | `#f9bc4a` | rgb(249, 188, 74) | Hover states, backgrounds |
| Primary Dark | `#db8a0a` | rgb(219, 138, 10) | Active/pressed states |

### Secondary Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Secondary Teal | `#3be8e0` | rgb(59, 232, 224) | Accents, success states, highlights |
| Secondary Light | `#6aeee8` | rgb(106, 238, 232) | Hover states |
| Secondary Dark | `#21e5dc` | rgb(33, 229, 220) | Active states |

### Accent Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Accent Yellow | `#f1c50e` | rgb(241, 197, 14) | Warnings, highlights, CTAs |
| Accent Light | `#f5d54a` | rgb(245, 213, 74) | Hover states |
| Accent Dark | `#d9b10d` | rgb(217, 177, 13) | Active states |

### Neutral Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Dark Text | `#111111` | Primary text |
| Body Text | `#374151` | Secondary text (gray-700) |
| Muted Text | `#6b7280` | Tertiary text (gray-500) |
| Border | `#e5e7eb` | Borders, dividers (gray-200) |
| Background | `#f9fafb` | Page backgrounds (gray-50) |
| White | `#ffffff` | Cards, surfaces |

### Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Success | Green | `#10b981` |
| Warning | Yellow | `#f59e0b` |
| Error | Red | `#ef4444` |
| Info | Blue | `#3b82f6` |

---

## Typography

### Font Families

```css
--font-heading: 'Roboto', sans-serif;
--font-body: 'Open Sans', sans-serif;
--font-condensed: 'Roboto Condensed', sans-serif;
```

### Usage

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 | Roboto | 700 | 2.25rem (36px) |
| H2 | Roboto | 700 | 1.875rem (30px) |
| H3 | Roboto | 600 | 1.5rem (24px) |
| H4 | Roboto | 600 | 1.25rem (20px) |
| H5 | Roboto | 600 | 1.125rem (18px) |
| H6 | Roboto | 600 | 1rem (16px) |
| Body | Open Sans | 400 | 1rem (16px) |
| Small | Open Sans | 400 | 0.875rem (14px) |
| Caption | Open Sans | 400 | 0.75rem (12px) |
| Button | Open Sans | 600 | 0.875rem (14px) |

---

## Spacing

### Base Scale (rem)

| Name | Value | Pixels |
|------|-------|--------|
| xs | 0.25rem | 4px |
| sm | 0.5rem | 8px |
| md | 1rem | 16px |
| lg | 1.5rem | 24px |
| xl | 2rem | 32px |
| 2xl | 3rem | 48px |
| 3xl | 4rem | 64px |

---

## Border Radius

| Name | Value | Usage |
|------|-------|-------|
| sm | 0.375rem (6px) | Small elements |
| md | 0.5rem (8px) | Inputs, small cards |
| lg | 0.75rem (12px) | Cards, modals |
| xl | 1rem (16px) | Large cards |
| pill | 50px | Buttons, badges |
| full | 9999px | Avatars, icons |

---

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
--shadow-sidebar: 2px 0 8px rgba(0, 0, 0, 0.05);
```

---

## Components

### Buttons

**Primary Button**
- Background: `#478ac9`
- Text: White, uppercase, 600 weight
- Border Radius: 50px (pill)
- Padding: 10px 24px
- Letter Spacing: 0.05em
- Hover: `#387cbd`

**Secondary Button**
- Background: `#3be8e0`
- Text: Dark (#111111), uppercase
- Hover: `#21e5dc`

**Accent Button**
- Background: `#f1c50e`
- Text: Dark (#111111), uppercase
- Hover: `#d9b10d`

**Outline Button**
- Background: Transparent
- Border: 2px solid primary
- Text: Primary color

### Cards

- Background: White
- Border Radius: 12px
- Shadow: `0 2px 8px rgba(0, 0, 0, 0.08)`
- Padding: 24px
- Hover Shadow: `0 4px 16px rgba(0, 0, 0, 0.12)`

### Inputs

- Border: 1px solid `#e5e7eb`
- Border Radius: 8px
- Padding: 10px 16px
- Focus: 2px ring primary color
- Placeholder: `#9ca3af`

### Badges

- Border Radius: 50px
- Padding: 4px 12px
- Font Size: 12px
- Font Weight: 500

---

## Icons

- Icon Library: Lucide React
- Default Size: 20px (w-5 h-5)
- Small Size: 16px (w-4 h-4)
- Large Size: 24px (w-6 h-6)
- Stroke Width: 2px

---

## Animation

### Transitions

```css
transition-all: 0.2s ease;
transition-colors: 0.15s ease;
transition-transform: 0.2s ease-out;
```

### Keyframes

- `fadeIn`: Opacity 0 to 1 (0.3s)
- `slideIn`: TranslateX -10px to 0 with fade (0.3s)
- `pulseSoft`: Opacity pulse 1 to 0.7 (2s infinite)

---

## Responsive Breakpoints

| Name | Min Width | Usage |
|------|-----------|-------|
| sm | 640px | Small tablets |
| md | 768px | Tablets |
| lg | 1024px | Laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large screens |

---

## Logo Usage

- Minimum Size: 32px height
- Clear Space: Equal to logo height on all sides
- File: `/public/logo.png`
- Do not distort or change colors

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Focus states must be visible
- Interactive elements: minimum 44x44px touch target
- Alt text required for all images
