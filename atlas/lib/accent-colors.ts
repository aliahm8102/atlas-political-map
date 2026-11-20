export const DEFAULT_CUSTOM_ACCENT = "#547b63";
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export type RGB = [number, number, number];
export function hexToRgb(hex: string): RGB {
  const safe = HEX_COLOR.test(hex) ? hex : DEFAULT_CUSTOM_ACCENT;
  return [1, 3, 5].map(index => Number.parseInt(safe.slice(index, index + 2), 16)) as RGB;
}
export function rgbToHex(rgb: RGB) {
  if (rgb.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255)) throw new RangeError("RGB channels must be integers from 0 to 255.");
  return "#" + rgb.map(channel => channel.toString(16).padStart(2, "0")).join("");
}
function mix(color: RGB, target: RGB, amount: number): RGB {
  return color.map((channel, index) => Math.round(channel + (target[index] - channel) * amount)) as RGB;
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = hexToRgb(hex).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
// Match the background/surface/soft tokens of the four themes in globals.css.
const surfaces: Record<string, [string, string, string]> = {
  light: ["#e9eeeb", "#edf1ee", "#e4eae5"], sand: ["#efe9df", "#f6f0e6", "#e9e0d1"],
  dark: ["#232e28", "#29362e", "#253329"], midnight: ["#1c2534", "#253144", "#202c3d"],
};
export function customAccentStyle(settings: { accent: string; customAccent?: string; theme: string }) {
  if (settings.accent !== "custom") return {};
  const color = hexToRgb(settings.customAccent ?? DEFAULT_CUSTOM_ACCENT);
  const backgrounds = surfaces[settings.theme] ?? surfaces.light;
  const dark = settings.theme === "dark" || settings.theme === "midnight";
  const soft = rgbToHex(mix(hexToRgb(backgrounds[1]), color, dark ? .2 : .12));
  const targets = [...backgrounds, soft];
  const contrast = (candidate: string) => Math.min(...targets.map(background => contrastRatio(candidate, background)));
  const target: RGB = dark ? [255, 255, 255] : [0, 0, 0];
  let amount = 0;
  // Preserve the chosen hue; adjust only colours that would disappear against the theme.
  if (contrast(rgbToHex(color)) < 4.5) {
    let low = 0, high = 1;
    for (let step = 0; step < 20; step++) { const mid = (low + high) / 2; if (contrast(rgbToHex(mix(color, target, mid))) >= 4.5) high = mid; else low = mid; }
    amount = high;
  }
  const accent = rgbToHex(mix(color, target, amount));
  const foreground = contrastRatio(accent, "#000000") > contrastRatio(accent, "#ffffff") ? "#000000" : "#ffffff";
  return { "--accent": accent, "--accent-dark": rgbToHex(mix(hexToRgb(accent), target, .15)), "--accent-soft": soft, "--on-accent": foreground };
}
