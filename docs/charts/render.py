#!/usr/bin/env python3
"""
Art direction: "Funding tape / AI HUD"

One-off visual language for the MEXC USDT-M futures grid + AI regime bot.
NOT the sibling spot-grid canvas kit (no charcoal diagonal, no 42px centered
ui-sans titles, no twin 3D donuts, no isometric shadeBar columns, no green/red
area-line twins, no red underwater + dashed green halt line).

Palette: MEXC orange + deep navy + electric cyan.
Background: vertical navy → ink with a faint horizontal funding-tape tick grid.
Type: Liberation Sans Narrow (titles) + DejaVu Sans Mono (HUD numbers).
Lighting: flat editorial + thin neon strokes.
Layout: asymmetric HUD — left metric stack + right plot.
"""

from __future__ import annotations

import os
import random
from typing import Sequence

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.path.join(ROOT, ".."))
OUT = ROOT

# --- palette (MEXC futures HUD) ------------------------------------------------
ORANGE = (255, 122, 0)
ORANGE_DIM = (180, 86, 8)
NAVY = (7, 20, 40)
INK = (2, 6, 16)
CYAN = (34, 225, 255)
CYAN_DIM = (18, 110, 140)
AMBER = (255, 176, 32)
AMBER_DIM = (140, 96, 18)
SLATE = (92, 118, 148)
GHOST = (28, 48, 72)
WHITE = (232, 242, 255)
MUTED = (154, 172, 196)
CHIP_OK = (56, 196, 120)  # small status chips only
CHIP_HOT = (232, 72, 72)

W, H = 1600, 900
BANNER_W, BANNER_H = 1920, 560

FONT_TITLE = "/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf"
FONT_TITLE_R = "/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Regular.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def vertical_tape_bg(w: int, h: int) -> Image.Image:
    """Vertical navy-to-ink field + horizontal funding-tape ticks. Not a diagonal charcoal gradient."""
    img = Image.new("RGB", (w, h), INK)
    px = img.load()
    assert px is not None
    for y in range(h):
        t = y / max(h - 1, 1)
        c = lerp(NAVY, INK, t ** 0.85)
        for x in range(w):
            px[x, y] = c
    draw = ImageDraw.Draw(img, "RGBA")
    # Horizontal tape: faint tick rows, denser near the top like a funding strip.
    for y in range(28, h - 20, 18):
        alpha = 28 if y < 70 else 16
        draw.line([(0, y), (w, y)], fill=(*GHOST, alpha), width=1)
    for x in range(0, w, 64):
        draw.line([(x, 22), (x, 46)], fill=(*ORANGE, 38), width=1)
    # Left neon spine
    draw.rectangle([0, 0, 4, h], fill=(*ORANGE, 220))
    draw.rectangle([4, 0, 5, h], fill=(*CYAN, 90))
    return img


def rounded(draw: ImageDraw.ImageDraw, box: Sequence[int], r: int, fill=None, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(list(box), radius=r, fill=fill, outline=outline, width=width)


def hud_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], kicker: str, title: str) -> None:
    x, y = xy
    draw.text((x, y), kicker, font=font(FONT_MONO, 13), fill=ORANGE)
    draw.text((x, y + 18), title, font=font(FONT_TITLE, 26), fill=WHITE)


def metric_stack(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    rows: list[tuple[str, str, tuple[int, int, int]]],
) -> None:
    yy = y
    for label, value, color in rows:
        rounded(draw, [x, yy, x + 268, yy + 58], 6, fill=(*GHOST, 180), outline=(*SLATE, 80))
        draw.text((x + 14, yy + 8), label, font=font(FONT_MONO, 12), fill=MUTED)
        draw.text((x + 14, yy + 26), value, font=font(FONT_MONO_B, 18), fill=color)
        yy += 66


def footer(draw: ImageDraw.ImageDraw, text: str, w: int = W) -> None:
    draw.text((28, H - 36), text, font=font(FONT_TITLE_R, 16), fill=SLATE)


def neon_line(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], color, width: int = 2) -> None:
    draw.line([(int(x), int(y)) for x, y in pts], fill=color, width=width, joint="curve")


# --- 1. win / loss mosaic (NOT twin 3D donuts) ---------------------------------

def treemap(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    items: list[tuple[str, float, tuple[int, int, int]]],
) -> None:
    x0, y0, x1, y1 = box
    total = sum(max(v, 0.01) for _, v, _ in items)
    vertical = (x1 - x0) >= (y1 - y0)
    cursor = x0 if vertical else y0
    span = (x1 - x0) if vertical else (y1 - y0)
    for i, (label, value, color) in enumerate(items):
        frac = max(value, 0.01) / total
        chunk = int(span * frac)
        if i == len(items) - 1:
            if vertical:
                xa, xb, ya, yb = cursor, x1, y0, y1
            else:
                xa, xb, ya, yb = x0, x1, cursor, y1
        else:
            if vertical:
                xa, xb, ya, yb = cursor, cursor + chunk, y0, y1
                cursor += chunk
            else:
                xa, xb, ya, yb = x0, x1, cursor, cursor + chunk
                cursor += chunk
        rounded(draw, [xa + 3, ya + 3, xb - 3, yb - 3], 8, fill=(*color, 210), outline=(*WHITE, 30))
        tw = font(FONT_MONO, 13)
        draw.text((xa + 14, ya + 12), label, font=tw, fill=WHITE)
        draw.text((xa + 14, ya + 32), f"${value:,.0f}", font=font(FONT_MONO_B, 20), fill=WHITE)


def render_winloss() -> None:
    img = vertical_tape_bg(W, H)
    d = ImageDraw.Draw(img, "RGBA")
    hud_label(d, (28, 22), "AI HUD  ·  MIX", "Win / loss dollars — mosaic, not pies")
    d.text((28, 78), "Cyan = harvest dollars   Orange = loss dollars   Inner chips = AI sleeves", font=font(FONT_TITLE_R, 16), fill=MUTED)

    metric_stack(
        d,
        28,
        118,
        [
            ("TUNED WR / PAYOFF", "60.5%   R 1.67", CYAN),
            ("TUNED EV / PF", "+$10.63   PF 2.56", CYAN),
            ("OLD-DEFAULT WR", "53.0%   R 1.12", AMBER),
            ("OLD-DEFAULT EV", "+$0.18   PF 1.27", AMBER),
            ("STATUS", "illustrative $10k book", MUTED),
        ],
    )

    # Small OK/HOT chips — green/red allowed only as chips, not the identity.
    rounded(d, [28, 468, 120, 498], 4, fill=(*CHIP_OK, 40), outline=CHIP_OK)
    d.text((40, 474), "WIN", font=font(FONT_MONO_B, 12), fill=CHIP_OK)
    rounded(d, [132, 468, 236, 498], 4, fill=(*CHIP_HOT, 40), outline=CHIP_HOT)
    d.text((144, 474), "LOSS", font=font(FONT_MONO_B, 12), fill=CHIP_HOT)

    d.text((330, 118), "TUNED / HUNT  ·  86 fills", font=font(FONT_MONO, 13), fill=CYAN)
    treemap(
        d,
        (330, 142, 1572, 430),
        [
            ("grid harvest wins", 1240, CYAN_DIM),
            ("scratch wins", 257, (20, 160, 170)),
            ("grid losses", 410, ORANGE_DIM),
            ("trend / SL clips", 174, (120, 48, 12)),
        ],
    )

    d.text((330, 452), "OLD DEFAULT  ·  118 dust clips  ·  74k–81k arithmetic", font=font(FONT_MONO, 13), fill=AMBER)
    treemap(
        d,
        (330, 476, 1572, 720),
        [
            ("tiny wins", 412, AMBER_DIM),
            ("fee-flat losses", 324, (90, 40, 10)),
            ("stale-band idle", 80, GHOST),
        ],
    )

    # AI regime strip (not an inner 3D ring)
    d.text((330, 742), "AI SLEEVE MIX (tuned loops)", font=font(FONT_MONO, 12), fill=MUTED)
    sleeves = [("harvest 74%", 74, CYAN), ("AI stand-down 16%", 16, ORANGE), ("funding halt 10%", 10, AMBER)]
    x = 330
    for label, pct, color in sleeves:
        w = int(1242 * pct / 100)
        rounded(d, [x, 764, x + w - 6, 808], 5, fill=(*color, 160), outline=(*color, 220))
        d.text((x + 10, 776), label, font=font(FONT_MONO_B, 13), fill=WHITE)
        x += w

    footer(d, "Payoff is the story. Tuned keeps ~1.67× winners in cyan dollars. Old 10-contract clips flatten into amber dust.")
    img.save(os.path.join(OUT, "winloss.png"), "PNG")


# --- 2. lollipop: expectancy vs leverage (NOT isometric level bars) ------------

def render_expectancy() -> None:
    img = vertical_tape_bg(W, H)
    d = ImageDraw.Draw(img, "RGBA")
    hud_label(d, (28, 22), "AI HUD  ·  KNOB", "Expectancy vs leverage")
    d.text((28, 78), "Same 8-rung geometric hunt book. Leverage changes halt rate and margin-walk risk, not gross step.", font=font(FONT_TITLE_R, 16), fill=MUTED)

    points = [
        (3, 8.20, "cap clips ladder"),
        (5, 10.10, "quiet"),
        (6, 10.40, "shipped"),
        (8, 10.63, "hunt"),
        (10, 8.90, "old default lev"),
        (12, 5.20, "margin events"),
        (15, 1.10, "trend = liq path"),
    ]

    metric_stack(
        d,
        28,
        118,
        [
            ("SHIPPED OP", "6x isolated", ORANGE),
            ("HUNT OP", "8x isolated", CYAN),
            ("OLD DEFAULT", "10x + dust clips", AMBER),
            ("PEAK EV/FILL", "+$10.63 at 8x", CYAN),
            ("FAILURE", "12x+ walks off band", AMBER),
        ],
    )

    plot = (360, 140, 1540, 780)
    x0, y0, x1, y1 = plot
    rounded(d, [x0, y0, x1, y1], 10, fill=(*INK, 160), outline=(*CYAN, 50))

    levs = [p[0] for p in points]
    evs = [p[1] for p in points]
    xmin, xmax = 2.2, 16.2
    ymin, ymax = -0.5, 13.0

    def X(lev: float) -> float:
        return x0 + 70 + (lev - xmin) / (xmax - xmin) * (x1 - x0 - 120)

    def Y(ev: float) -> float:
        return y1 - 50 - (ev - ymin) / (ymax - ymin) * (y1 - y0 - 90)

    # grid
    for ev in range(0, 13, 2):
        yy = Y(ev)
        d.line([(x0 + 60, yy), (x1 - 24, yy)], fill=(*GHOST, 140), width=1)
        d.text((x0 + 16, yy - 8), f"{ev}", font=font(FONT_MONO, 12), fill=SLATE)
    d.text((x0 + 16, y0 + 16), "EV $/fill", font=font(FONT_MONO, 11), fill=MUTED)

    spline = [(X(lv), Y(ev)) for lv, ev, _ in points]
    neon_line(d, spline, (*CYAN, 90), 6)
    neon_line(d, spline, CYAN, 2)

    for lev, ev, note in points:
        xx, yy = X(lev), Y(ev)
        d.line([(xx, Y(0)), (xx, yy)], fill=(*CYAN, 70), width=2)
        r = 11
        fill = ORANGE if lev == 6 else (CYAN if lev == 8 else (AMBER if lev == 10 else WHITE))
        d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=fill, outline=WHITE, width=2)
        d.text((xx - 10, Y(0) + 8), f"{lev}x", font=font(FONT_MONO_B, 13), fill=fill)
        if lev in (6, 8, 10):
            d.text((xx + 14, yy - 28), f"${ev:.2f}", font=font(FONT_MONO_B, 14), fill=fill)
            d.text((xx + 14, yy - 10), note, font=font(FONT_MONO, 11), fill=MUTED)

    d.text((x0 + 70, y1 - 28), "leverage  →   grids lose when a 3% walk becomes a margin event", font=font(FONT_TITLE_R, 15), fill=SLATE)
    footer(d, "Highlighted: orange = shipped 6x operating point. Cyan = hunt 8x. Amber = old 10x. Not a levels bar chart.")
    img.save(os.path.join(OUT, "expectancy.png"), "PNG")


# --- 3. stepped equity small-multiples (NOT overlapping green/red areas) -------

def step_series(n: int, start: float, end: float, noise: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    eq = start
    out = [eq]
    drift = (end - start) / n
    for _ in range(n):
        eq = max(9300.0, eq + rng.gauss(drift, noise))
        out.append(eq)
    span = max(n // 8, 4)
    for i in range(1, span + 1):
        w = i / span
        out[-i] = out[-i] * (1 - w) + end * w
    out[-1] = end
    return out


def render_equity() -> None:
    img = vertical_tape_bg(W, H)
    d = ImageDraw.Draw(img, "RGBA")
    hud_label(d, (28, 22), "AI HUD  ·  PATH", "Stepped equity — fill stairs")
    d.text((28, 78), "Cyan stairs = tuned hunt. Amber stairs = old 74k–81k arithmetic dust book. Separate panels, no overlapping areas.", font=font(FONT_TITLE_R, 16), fill=MUTED)

    tuned = step_series(86, 10_000, 10_914, 16, seed=7)
    default = step_series(118, 10_000, 10_021, 6, seed=3)

    panels = [
        ("TUNED / HUNT", tuned, CYAN, "+$914   ROI +9.1%   86 fills", (28, 118, 1572, 490)),
        ("OLD DEFAULT", default, AMBER, "+$21   ROI +0.2%   118 dust fills", (28, 512, 1572, 850)),
    ]

    for title, series, color, kicker, box in panels:
        x0, y0, x1, y1 = box
        rounded(d, [x0, y0, x1, y1], 10, fill=(*INK, 150), outline=(*color, 60))
        d.text((x0 + 18, y0 + 12), title, font=font(FONT_MONO_B, 14), fill=color)
        d.text((x0 + 220, y0 + 12), kicker, font=font(FONT_MONO, 13), fill=MUTED)

        px0, py0, px1, py1 = x0 + 70, y0 + 48, x1 - 24, y1 - 36
        lo, hi = 9600, 11200
        d.line([(px0, py1), (px1, py1)], fill=(*SLATE, 80), width=1)
        for usd in (10000, 10500, 11000):
            yy = py1 - (usd - lo) / (hi - lo) * (py1 - py0)
            d.line([(px0, yy), (px1, yy)], fill=(*GHOST, 100), width=1)
            d.text((x0 + 14, yy - 8), f"{usd//1000}k", font=font(FONT_MONO, 11), fill=SLATE)

        n = len(series) - 1
        pts: list[tuple[float, float]] = []
        for i, v in enumerate(series):
            xx = px0 + i / n * (px1 - px0)
            yy = py1 - (v - lo) / (hi - lo) * (py1 - py0)
            pts.append((xx, yy))
        # true stairs
        stairs: list[tuple[float, float]] = []
        for i, (xx, yy) in enumerate(pts):
            if i == 0:
                stairs.append((xx, yy))
            else:
                stairs.append((xx, pts[i - 1][1]))
                stairs.append((xx, yy))
        neon_line(d, stairs, (*color, 70), 5)
        neon_line(d, stairs, color, 2)
        d.text((px0, py1 + 8), "fills (order-fill stairs, not a smoothed area)", font=font(FONT_MONO, 11), fill=SLATE)

    footer(d, "Same MEXC BTC_USDT engine. Different knobs. Dual-panel stairs — not a green-vs-red overlay.")
    img.save(os.path.join(OUT, "equity.png"), "PNG")


# --- 4. underwater bars + funding tape (NOT red area + dashed green -8%) -------

def render_drawdown() -> None:
    img = vertical_tape_bg(W, H)
    d = ImageDraw.Draw(img, "RGBA")
    hud_label(d, (28, 22), "AI HUD  ·  RISK ENVELOPE", "Drawdown bars vs funding print")
    d.text((28, 78), "Underwater is orange bars. Funding tape sits on top. SL / TP / MAX_FUNDING_RATE are HUD callouts — not a copied halt line.", font=font(FONT_TITLE_R, 16), fill=MUTED)

    metric_stack(
        d,
        28,
        118,
        [
            ("TUNED MAX DD", "4.8%", CYAN),
            ("STOP_LOSS_PRICE", "56,800", ORANGE),
            ("TAKE_PROFIT_PRICE", "72,800", CYAN),
            ("MAX_FUNDING_RATE", "0.0008 abs", AMBER),
            ("OLD-DEFAULT DD", "8.1%  no SL", AMBER),
        ],
    )

    plot = (330, 118, 1572, 820)
    x0, y0, x1, y1 = plot
    rounded(d, [x0, y0, x1, y1], 10, fill=(*INK, 150), outline=(*ORANGE, 50))

    rng = random.Random(11)
    n = 86
    dd = []
    funding = []
    for i in range(n):
        wave = abs((i % 17) - 8) * 0.12 + rng.random() * 0.25
        if 46 <= i <= 70:
            wave = 1.6 + (i - 46) * 0.13
        if i > 70:
            wave = max(0.3, 4.8 - (i - 70) * 0.28)
        dd.append(min(wave, 4.8))
        f = abs(0.00010 + rng.gauss(0, 0.00007))
        if 28 <= i <= 32:
            f = 0.00092
        if 58 <= i <= 62:
            f = 0.00055
        funding.append(f)

    tape_y0, tape_y1 = y0 + 16, y0 + 78
    d.text((x0 + 16, y0 + 18), "FUNDING TAPE  |f|", font=font(FONT_MONO, 11), fill=MUTED)
    bw = (x1 - x0 - 40) / n
    for i, f in enumerate(funding):
        xx = x0 + 20 + i * bw
        t = min(f / 0.0012, 1.0)
        col = lerp(CYAN_DIM, ORANGE, t)
        d.rectangle([xx, tape_y0 + 22, xx + bw - 1, tape_y1], fill=(*col, 200))
    # cap marker on tape
    cap_y = tape_y0 + 8
    d.text((x1 - 260, cap_y), "MAX_FUNDING_RATE 0.0008", font=font(FONT_MONO_B, 12), fill=AMBER)

    bar_top, bar_bot = y0 + 110, y1 - 70
    d.text((x0 + 16, y0 + 88), "UNDERWATER %  (tuned path)", font=font(FONT_MONO, 11), fill=MUTED)
    max_dd = 9.0
    for i, v in enumerate(dd):
        xx = x0 + 20 + i * bw
        hgt = (v / max_dd) * (bar_bot - bar_top)
        col = lerp(NAVY, ORANGE, min(v / 5.0, 1.0))
        d.rectangle([xx, bar_bot - hgt, xx + bw - 1, bar_bot], fill=(*col, 220))

    # HUD callouts — boxes, not a dashed green line
    callouts = [
        (x0 + 24, y1 - 54, "SL 56800  ·  floor halt", ORANGE),
        (x0 + 430, y1 - 54, "TP 72800  ·  ceiling halt", CYAN),
        (x0 + 836, y1 - 54, "FUNDING 0.0008  ·  boot gate", AMBER),
    ]
    for cx, cy, text, col in callouts:
        rounded(d, [cx, cy, cx + 370, cy + 36], 4, fill=(*col, 28), outline=col)
        d.text((cx + 12, cy + 10), text, font=font(FONT_MONO, 12), fill=WHITE)

    footer(d, "Orange bars are the drawdown envelope. The funding tape is the second axis. SL/TP/funding are labeled brakes, not a sibling-style -8% dash.")
    img.save(os.path.join(OUT, "drawdown.png"), "PNG")


# --- banner: futures ladder + AI regime + MEXC orange --------------------------

def render_banner() -> None:
    img = vertical_tape_bg(BANNER_W, BANNER_H)
    d = ImageDraw.Draw(img, "RGBA")

    # Geometric ladder on the right — futures rungs, not a spot book.
    last = 64316
    rungs = [58500, 60117, 61778, 63486, 65240, 67043, 68896, 70800]
    lx0, ly0, lx1, ly1 = 980, 70, 1860, 490
    rounded(d, [lx0, ly0, lx1, ly1], 12, fill=(*INK, 120), outline=(*ORANGE, 70), width=2)
    d.text((lx0 + 24, ly0 + 16), "BTC_USDT  PERP  LADDER", font=font(FONT_MONO, 13), fill=ORANGE)
    d.text((lx0 + 320, ly0 + 16), "GEOMETRIC  8  ·  6x ISOLATED", font=font(FONT_MONO, 13), fill=CYAN)

    def PY(p: float) -> float:
        return ly1 - 36 - (p - 57500) / (72000 - 57500) * (ly1 - ly0 - 80)

    last_y = PY(last)
    d.line([(lx0 + 40, last_y), (lx1 - 40, last_y)], fill=(*CYAN, 160), width=2)
    d.text((lx1 - 210, last_y - 22), f"LAST {last:,.0f}", font=font(FONT_MONO_B, 14), fill=CYAN)

    for i, p in enumerate(rungs):
        yy = PY(p)
        below = p < last
        col = CYAN if below else ORANGE
        tag = "OPEN LONG" if below else "CLOSE LONG"
        d.line([(lx0 + 80, yy), (lx1 - 160, yy)], fill=(*col, 180), width=3)
        d.ellipse([lx0 + 72, yy - 6, lx0 + 88, yy + 6], fill=col)
        d.text((lx1 - 150, yy - 8), f"{p:,.0f}", font=font(FONT_MONO, 12), fill=col)
        d.text((lx0 + 96, yy - 18), tag, font=font(FONT_MONO, 11), fill=col)

    # Left copy block
    d.text((40, 70), "MEXC  ·  USDT-M FUTURES", font=font(FONT_MONO, 16), fill=ORANGE)
    d.text((40, 108), "FUTURES GRID", font=font(FONT_TITLE, 64), fill=WHITE)
    d.text((40, 178), "+ AI REGIME", font=font(FONT_TITLE, 64), fill=CYAN)
    d.text(
        (40, 262),
        "Native REST limits  ·  geometric rungs  ·  funding brake",
        font=font(FONT_TITLE_R, 22),
        fill=MUTED,
    )

    chips = [
        ("RANGE", CYAN),
        ("TREND", ORANGE),
        ("VOL", AMBER),
        ("FUNDING", WHITE),
    ]
    x = 40
    for label, col in chips:
        rounded(d, [x, 320, x + 150, 368], 6, fill=(*col, 30), outline=col, width=2)
        d.text((x + 18, 334), label, font=font(FONT_MONO_B, 16), fill=col)
        x += 164

    d.text((40, 400), "BTC_USDT   58500–70800   8 rungs   6x   MAX_FUNDING_RATE 0.0008", font=font(FONT_MONO, 15), fill=SLATE)
    d.text((40, 440), "Fit the band. Cut the rungs. Make spacing beat fees and funding.", font=font(FONT_TITLE_R, 20), fill=WHITE)

    # Bottom funding ticker
    d.rectangle([0, BANNER_H - 36, BANNER_W, BANNER_H], fill=(*INK, 255))
    tape = "  ·  ".join(
        [
            "BTC_USDT 64316.1",
            "FUNDING +0.0034%",
            "MAKER 0 / TAKER 2 bps",
            "CONTRACT 0.0001 BTC",
            "AI REGIME range_bound",
            "GRID geometric 8",
            "LEV 6x isolated",
        ]
    )
    d.text((16, BANNER_H - 26), tape, font=font(FONT_MONO, 13), fill=ORANGE)

    img.convert("RGB").save(os.path.join(DOCS, "banner.jpg"), "JPEG", quality=92, optimize=True)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    render_winloss()
    render_expectancy()
    render_equity()
    render_drawdown()
    render_banner()
    print("rendered: winloss.png expectancy.png equity.png drawdown.png + ../banner.jpg")


if __name__ == "__main__":
    main()
