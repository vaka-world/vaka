/**
 * Terminal entrance card and Seed-of-Life animation: same geometry, palette,
 * and animation timing as Vaka's original web CLI (apps/cli/src/ui/banner.ts).
 */

import readline from "node:readline";
import { detectTerminalTheme, supportsColor, type TerminalTheme } from "./terminal-theme";

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

function rgb(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
}

/**
 * Two complete palettes (dark and light), never cross-mixed. A banner forced
 * onto the wrong half (near-white text on a light terminal, or near-black
 * borders on a dark one) is the "invisible banner" failure this avoids.
 */
const PALETTES: Record<
  TerminalTheme,
  { border: string; text: string; muted: string; ring: string; core: string }
> = {
  dark: {
    border: rgb("#2C303D"),
    text: rgb("#F3F4F7"),
    muted: rgb("#9AA1B2"),
    ring: rgb("#9DB0E8"),
    core: rgb("#2E478C"),
  },
  light: {
    border: rgb("#E5E6EB"),
    text: rgb("#1B1D26"),
    muted: rgb("#70747F"),
    ring: rgb("#8E9AC2"),
    core: rgb("#2E478C"),
  },
};

const SEED_FRAMES: string[][] = [
  // Frame 0: The Origin (Point of Intention)
  [
    `                       ·                       `,
    `                                               `,
    `                       ●                       `,
    `                                               `,
    `                       ·                       `,
  ],
  // Frame 1: The Central Sphere (First Circle of Reasoning)
  [
    `                    . ─── .                    `,
    `                  /         \\                  `,
    `                 |     ◈     |                 `,
    `                  \\         /                  `,
    `                    ' ─── '                    `,
  ],
  // Frame 2: The Vertical Polar Axis
  [
    `                    . ─── .                    `,
    `                 ╭─/───┬───\\─╮                 `,
    `                 ││    │    ││                 `,
    `                 ╰─\\───┴───/─╯                 `,
    `                    ' ─── '                    `,
  ],
  // Frame 3: Triad Intersection (State, Schema, Edge Checkpoints)
  [
    `                    . ─── .                    `,
    `                 ╭─/───┬───\\─╮                 `,
    `                ( (  ◸ ┼ ◹  ) )                `,
    `                 ╰─\\───┴───/─╯                 `,
    `                    ' ─── '                    `,
  ],
  // Frame 4: Hexagonal Petals Emerge
  [
    `                  .──.   .──.                  `,
    `                /  ╭──\\ /──╮  \\                `,
    `               |  ( ◸  ✕  ◹ )  |               `,
    `                \\  ╰──/ \\──╯  /                `,
    `                  '──'   '──'                  `,
  ],
  // Frame 5: Fully Assembled Seed of Life
  [
    `                 .──.  ▲  .──.                 `,
    `               ╭─( ◸ ╲ │ / ◹ )─╮               `,
    `               │  ╲─── ◈ ───╱  │               `,
    `               ╰─( ◺ ╱ │ \\ ◿ )─╯               `,
    `                 '──'  ▼  '──'                 `,
  ],
  // Frame 6: Harmonic Pulse Lock
  [
    `                 .──.  ✦  .──.                 `,
    `               ╭─( ◸ ╲ │ / ◹ )─╮               `,
    `               │  ╲─── ◈ ───╱  │               `,
    `               ╰─( ◺ ╱ │ \\ ◿ )─╯               `,
    `                 '──'  ✦  '──'                 `,
  ],
];
const FINAL_FRAME = SEED_FRAMES.length - 1;

function center(text: string, width: number): string {
  const totalPad = Math.max(width - text.length, 0);
  const left = Math.floor(totalPad / 2);
  return " ".repeat(left) + text + " ".repeat(totalPad - left);
}

function padEndSafe(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function buildVakaCard(
  frameIndex: number,
  isPulsing: boolean,
  theme: TerminalTheme,
  colorEnabled: boolean,
  version: string
): string {
  const palette = PALETTES[theme];
  const glyph = SEED_FRAMES[frameIndex] ?? SEED_FRAMES[FINAL_FRAME]!;
  const ringColor = isPulsing ? palette.text : palette.ring;
  const coreColor = isPulsing ? palette.ring : palette.core;

  const title = "YOUR MIND IS THE ARCHITECT";
  const subtitleLines = [
    "Reason through design, data flow, and failure modes",
    "before a single line of code is written.",
  ];
  const footer = `v${version} · Claude Code + Codex`;

  const innerWidth = Math.max(
    ...glyph.map((line) => line.length),
    title.length,
    ...subtitleLines.map((line) => line.length),
    footer.length
  );

  const colorWrap = (code: string, text: string, bold = false) =>
    colorEnabled ? `${bold ? BOLD : ""}${code}${text}${RESET}` : text;
  const border = (char: string) => colorWrap(palette.border, char);
  const contentRow = (text: string) => `${border("│")} ${text} ${border("│")}`;

  const glyphRow = (line: string, color: string) =>
    contentRow(colorWrap(color, padEndSafe(line, innerWidth)));

  const lines = [
    `${border("┌")}${border("─".repeat(innerWidth + 2))}${border("┐")}`,
    contentRow(" ".repeat(innerWidth)),
    glyphRow(glyph[0]!, ringColor),
    glyphRow(glyph[1]!, ringColor),
    glyphRow(glyph[2]!, coreColor),
    glyphRow(glyph[3]!, ringColor),
    glyphRow(glyph[4]!, ringColor),
    contentRow(" ".repeat(innerWidth)),
    contentRow(colorWrap(palette.text, center(title, innerWidth), true)),
    ...subtitleLines.map((line) => contentRow(colorWrap(palette.muted, center(line, innerWidth)))),
    contentRow(" ".repeat(innerWidth)),
    contentRow(colorWrap(palette.muted, center(footer, innerWidth))),
    `${border("└")}${border("─".repeat(innerWidth + 2))}${border("┘")}`,
  ];

  return lines.join("\n");
}

function buildMinimalBanner(version: string): string {
  return `Vaka v${version} — Your mind is the architect.`;
}

export interface AnimateOptions {
  stdout?: NodeJS.WriteStream;
  env?: NodeJS.ProcessEnv;
  version?: string;
}

export async function animateVakaEntrance(options: AnimateOptions = {}): Promise<void> {
  const stdout = options.stdout ?? process.stdout;
  const env = options.env ?? process.env;
  const version = options.version ?? "0.1.0";

  const theme = detectTerminalTheme(env);
  const colorEnabled = supportsColor(stdout, env);
  const interactive = stdout.isTTY === true;

  const finalCard = buildVakaCard(FINAL_FRAME, false, theme, colorEnabled, version);
  const cardWidth = Math.max(...finalCard.split("\n").map((line) => stripAnsi(line).length));
  const columns = stdout.columns ?? cardWidth;

  // Piped/CI/non-interactive: print once, no cursor tricks, no animation delay.
  if (!interactive) {
    stdout.write(`${finalCard}\n`);
    return;
  }

  // The card can't fit without wrapping into garbage; a plain line always fits.
  if (columns < cardWidth) {
    stdout.write(`${buildMinimalBanner(version)}\n`);
    return;
  }

  stdout.write(HIDE_CURSOR);
  readline.cursorTo(stdout, 0, 0);
  readline.clearScreenDown(stdout);

  for (let i = 0; i < SEED_FRAMES.length; i++) {
    readline.cursorTo(stdout, 0, 0);
    stdout.write(`${buildVakaCard(i, false, theme, colorEnabled, version)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 85));
  }

  const pulseRhythm = [true, false, true, false];
  for (const pulse of pulseRhythm) {
    readline.cursorTo(stdout, 0, 0);
    stdout.write(`${buildVakaCard(FINAL_FRAME, pulse, theme, colorEnabled, version)}\n`);
    await new Promise((resolve) => setTimeout(resolve, pulse ? 130 : 90));
  }

  stdout.write(SHOW_CURSOR);
}
