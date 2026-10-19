/**
 * Web-only CSS for text controls that RN styles can't reach (see components/ui/control.ts):
 *  - Chrome/Safari autofill paints a blue/yellow background; keep the white field and dark text
 *    (the transition trick leaves our box-shadow focus ring alone).
 *  - Selection highlight in the ring colour, like the native selectionColor.
 *  - No browser focus outline on inputs; the control draws its own ring.
 */
import { lightColors, withAlpha } from './tokens';

const CSS = `
input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus,
textarea:-webkit-autofill, select:-webkit-autofill {
  -webkit-text-fill-color: #101828;
  caret-color: ${lightColors.ring};
  transition: background-color 100000s ease-in-out 0s;
}
input::selection, textarea::selection { background: ${withAlpha(lightColors.ring, 0.2)}; }
input:focus, input:focus-visible, textarea:focus, textarea:focus-visible { outline: none; }
input::placeholder, textarea::placeholder { color: #99a1af; opacity: 1; }
`;

if (typeof document !== 'undefined' && !document.getElementById('sd-input-css')) {
  const el = document.createElement('style');
  el.id = 'sd-input-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export {};
