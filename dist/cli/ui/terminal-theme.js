"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTerminalTheme = detectTerminalTheme;
exports.supportsColor = supportsColor;
/**
 * Most terminal emulators (iTerm2, Terminal.app, VS Code, Windows Terminal)
 * never expose their actual background color to a running process — querying
 * one directly (OSC 11) needs raw-mode stdin and a response timeout, which is
 * too fragile to gate a CLI's startup banner on. So this is a best-effort
 * heuristic (the COLORFGBG convention some terminals like rxvt/mintty set),
 * with an explicit override for everyone else, including for a reliable demo.
 */
function detectTerminalTheme(env = process.env) {
    const override = env.COGNITION_THEME?.toLowerCase();
    if (override === "light" || override === "dark") {
        return override;
    }
    const colorFgBg = env.COLORFGBG;
    if (colorFgBg) {
        const bg = Number.parseInt(colorFgBg.split(";").pop() ?? "", 10);
        if (!Number.isNaN(bg)) {
            // ANSI 16-color palette: 0-6 and 8 are the dark half, 7 and 9-15 are light.
            return bg === 7 || bg >= 9 ? "light" : "dark";
        }
    }
    // No signal either way: most developer terminals default to a dark theme.
    return "dark";
}
function supportsColor(stream = process.stdout, env = process.env) {
    if (env.NO_COLOR !== undefined) {
        return false;
    }
    if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") {
        return true;
    }
    if (!stream.isTTY) {
        return false;
    }
    return env.TERM !== "dumb";
}
