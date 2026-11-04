import math
import subprocess
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1920
HEIGHT = 1080
FPS = 30
DURATION = 10
TOTAL_FRAMES = FPS * DURATION

FONT_BOLD_PATH = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG_PATH = "C:/Windows/Fonts/segoeui.ttf"

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

def draw_star(draw, cx, cy, r_outer, r_inner, color, angle=0):
    # 4-pointed curved star (Google Gemini style)
    points = []
    # 4 main points with inward curved arcs
    steps = 40
    for i in range(steps):
        theta = 2 * math.pi * i / steps + angle
        # radius formula for astroid/superellipse-like 4-point star: r = r_outer / (cos^4 + sin^4)^... or parametric
        pass

def draw_gemini_sparkle(draw, cx, cy, size, color_tuple, glow=True):
    # A 4-pointed diamond star
    pts = [
        (cx, cy - size),
        (cx + size * 0.22, cy - size * 0.22),
        (cx + size, cy),
        (cx + size * 0.22, cy + size * 0.22),
        (cx, cy + size),
        (cx - size * 0.22, cy + size * 0.22),
        (cx - size, cy),
        (cx - size * 0.22, cy - size * 0.22)
    ]
    draw.polygon(pts, fill=color_tuple)

def ease_in_out(t):
    return t * t * (3 - 2 * t)

def clamp(v, mn=0.0, mx=1.0):
    return max(mn, min(mx, v))

def render_video():
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    video_path = os.path.join(output_dir, "gemini_4_carbon_intro.mp4")

    # Start ffmpeg pipe
    # We will pipe raw RGB frames to ffmpeg and synthesize audio tone / synth wave
    audio_cmd = (
        'ffmpeg -y -f rawvideo -vcodec rawvideo -s 1920x1080 -pix_fmt rgb24 -r 30 -i - '
        '-f lavfi -i "sine=frequency=120:duration=10[sub];sine=frequency=432:duration=10[lead];[sub][lead]amix=inputs=2:weights=0.7 0.3,afade=t=in:ss=0:d=1,afade=t=out:st=8.5:d=1.5[a]" '
        '-c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -c:a aac -b:a 192k -shortest output/gemini_4_carbon_intro.mp4'
    )

    proc = subprocess.Popen(
        [
            'ffmpeg', '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{WIDTH}x{HEIGHT}',
            '-pix_fmt', 'rgb24',
            '-r', str(FPS),
            '-i', '-',
            '-f', 'lavfi',
            '-i', 'sine=frequency=70:duration=10[sub];sine=frequency=320:duration=10[mid];[sub][mid]amix=inputs=2:weights=0.8 0.2,lowpass=f=400,afade=t=in:ss=0:d=1.5,afade=t=out:st=8.2:d=1.8[a]',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '19',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            video_path
        ],
        stdin=subprocess.PIPE
    )

    f_title_big = get_font(FONT_BOLD_PATH, 86)
    f_title_med = get_font(FONT_BOLD_PATH, 54)
    f_sub = get_font(FONT_REG_PATH, 32)
    f_badge = get_font(FONT_BOLD_PATH, 24)
    f_card_title = get_font(FONT_BOLD_PATH, 34)
    f_card_desc = get_font(FONT_REG_PATH, 22)

    # Pre-generate stars / particles
    np.random.seed(42)
    num_particles = 120
    particles = []
    for _ in range(num_particles):
        particles.append({
            'x': np.random.uniform(0, WIDTH),
            'y': np.random.uniform(0, HEIGHT),
            'speed': np.random.uniform(0.5, 2.5),
            'size': np.random.uniform(1.5, 4.0),
            'phase': np.random.uniform(0, 2 * math.pi),
            'color': (np.random.randint(60, 100), np.random.randint(180, 240), np.random.randint(220, 255))
        })

    print(f"Generating {TOTAL_FRAMES} frames...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS  # 0.0 to 10.0

        # Background base: Deep carbon dark gradient with subtle radial glow
        # Create base image with PIL
        img = Image.new("RGB", (WIDTH, HEIGHT), (11, 14, 20))
        draw = ImageDraw.Draw(img, "RGBA")

        # Background carbon weave pattern & grid lines
        grid_alpha = int(18 + 8 * math.sin(t * 1.5))
        for x in range(0, WIDTH, 80):
            draw.line([(x, 0), (x, HEIGHT)], fill=(30, 42, 60, grid_alpha), width=1)
        for y in range(0, HEIGHT, 80):
            draw.line([(0, y), (WIDTH, y)], fill=(30, 42, 60, grid_alpha), width=1)

        # Ambient floating cyber particles
        for p in particles:
            py = (p['y'] - t * p['speed'] * 25) % HEIGHT
            px = p['x'] + math.sin(t * 1.2 + p['phase']) * 15
            twinkle = (math.sin(t * 3 + p['phase']) + 1) * 0.5
            p_alpha = int(50 + 160 * twinkle)
            c = p['color']
            draw.ellipse([px, py, px + p['size'], py + p['size']], fill=(c[0], c[1], c[2], p_alpha))

        # SCENE ROUTING
        # Scene 1: 0.0s - 3.2s -> Intro: Emergence of Gemini 4 Carbon
        # Scene 2: 3.2s - 7.0s -> Architecture & Super-Speed Capabilities (3 pillars)
        # Scene 3: 7.0s - 10.0s -> Final Reveal & Call to Action

        if t < 3.3:
            s1_t = t / 3.3
            # Fade in from 0 to 0.7s
            alpha_mult = ease_in_out(clamp(t / 0.8))
            if t > 2.7:
                alpha_mult *= (1.0 - ease_in_out(clamp((t - 2.7) / 0.5)))

            # Glow pulse in center
            glow_r = int(220 + 40 * math.sin(t * 4))
            for rad in range(glow_r, 40, -30):
                g_a = int(18 * (1.0 - rad / glow_r) * alpha_mult)
                draw.ellipse(
                    [WIDTH//2 - rad, 440 - rad, WIDTH//2 + rad, 440 + rad],
                    fill=(0, 210, 255, g_a)
                )

            # Central 4-point Gemini Carbon Star
            star_scale = 90 + 15 * math.sin(t * 2.5)
            rot = t * 0.4
            draw_gemini_sparkle(draw, WIDTH//2, 380, star_scale, (0, 230, 255, int(240 * alpha_mult)))
            draw_gemini_sparkle(draw, WIDTH//2, 380, star_scale * 0.5, (255, 255, 255, int(255 * alpha_mult)))

            # Tag badge: "NEXT-GEN QUANTUM-CARBON AI"
            badge_text = "N E X T - G E N   A I   A R C H I T E C T U R E"
            b_w = 460
            b_h = 36
            bx = WIDTH//2 - b_w//2
            by = 510
            draw.rounded_rectangle([bx, by, bx + b_w, by + b_h], radius=18,
                                   fill=(18, 28, 45, int(200 * alpha_mult)),
                                   outline=(0, 200, 255, int(150 * alpha_mult)), width=1)
            draw.text((WIDTH//2, by + 18), badge_text, font=f_badge, fill=(120, 220, 255, int(240 * alpha_mult)), anchor="mm")

            # Main text: GEMINI 4 CARBON
            title_text = "GEMINI 4 CARBON"
            draw.text((WIDTH//2, 600), title_text, font=f_title_big, fill=(255, 255, 255, int(255 * alpha_mult)), anchor="mm")

            # Subtitle
            sub_text = "Sức mạnh bứt phá • Phản hồi tức thì • Tối ưu năng lượng vượt trội"
            draw.text((WIDTH//2, 680), sub_text, font=f_sub, fill=(180, 205, 230, int(210 * alpha_mult)), anchor="mm")

        elif t < 7.2:
            s2_t = (t - 3.2) / 4.0
            alpha_mult = ease_in_out(clamp(s2_t / 0.15))
            if s2_t > 0.85:
                alpha_mult *= (1.0 - ease_in_out(clamp((s2_t - 0.85) / 0.15)))

            # Top Header
            draw.text((WIDTH//2, 130), "ĐỘT PHÁ CÔNG NGHỆ THẾ HỆ MỚI", font=f_badge,
                      fill=(0, 210, 255, int(220 * alpha_mult)), anchor="mm")
            draw.text((WIDTH//2, 190), "Hiệu Năng Carbon Cực Đỉnh", font=f_title_med,
                      fill=(255, 255, 255, int(255 * alpha_mult)), anchor="mm")

            # 3 Feature Cards
            cards = [
                {
                    "title": "Siêu Tốc Độ (Ultra-Low Latency)",
                    "highlight": "< 15ms",
                    "desc": "Xử lý song song đa luồng,\nphản hồi gần như lập tức.",
                    "icon": "⚡",
                    "accent": (0, 210, 255)
                },
                {
                    "title": "Carbon Nano Engine",
                    "highlight": "10M+ Context",
                    "desc": "Khả năng thấu hiểu ngữ cảnh dài\nvới độ chính xác gần như tuyệt đối.",
                    "icon": "🧠",
                    "accent": (160, 110, 255)
                },
                {
                    "title": "Tiết Kiệm Năng Lượng",
                    "highlight": "70% Carbon Saver",
                    "desc": "Kiến trúc xanh đột phá,\ntối ưu hóa tài nguyên đám mây.",
                    "icon": "🌱",
                    "accent": (50, 230, 140)
                }
            ]

            card_w = 480
            card_h = 440
            spacing = 60
            total_cards_w = 3 * card_w + 2 * spacing
            start_x = (WIDTH - total_cards_w) // 2
            card_y = 280

            for i, card in enumerate(cards):
                # stagger entrance
                stagger_delay = i * 0.1
                card_t = clamp((s2_t - stagger_delay) / 0.25)
                c_alpha = ease_in_out(card_t) * alpha_mult
                y_offset = (1.0 - ease_in_out(card_t)) * 50

                cx = start_x + i * (card_w + spacing)
                cy = card_y + y_offset

                # Card background (Glassmorphism dark style)
                acc = card["accent"]
                draw.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=24,
                                       fill=(16, 24, 38, int(190 * c_alpha)),
                                       outline=(acc[0], acc[1], acc[2], int(160 * c_alpha)),
                                       width=2)

                # Glow border top
                draw.line([(cx + 30, cy), (cx + card_w - 30, cy)],
                          fill=(acc[0], acc[1], acc[2], int(240 * c_alpha)), width=3)

                # Icon circle
                icon_cx = cx + 80
                icon_cy = cy + 85
                draw.ellipse([icon_cx - 36, icon_cy - 36, icon_cx + 36, icon_cy + 36],
                             fill=(acc[0]//3, acc[1]//3, acc[2]//3, int(180 * c_alpha)),
                             outline=(acc[0], acc[1], acc[2], int(200 * c_alpha)), width=1)
                draw.text((icon_cx, icon_cy), card["icon"], font=f_card_title,
                          fill=(255, 255, 255, int(255 * c_alpha)), anchor="mm")

                # Highlight Stat
                draw.text((cx + 140, cy + 85), card["highlight"], font=f_card_title,
                          fill=(acc[0], acc[1], acc[2], int(255 * c_alpha)), anchor="lm")

                # Title
                draw.text((cx + 45, cy + 180), card["title"], font=get_font(FONT_BOLD_PATH, 26),
                          fill=(245, 248, 255, int(245 * c_alpha)), anchor="lm")

                # Divider
                draw.line([(cx + 45, cy + 220), (cx + card_w - 45, cy + 220)],
                          fill=(50, 70, 95, int(120 * c_alpha)), width=1)

                # Description
                lines = card["desc"].split("\n")
                for l_idx, line in enumerate(lines):
                    draw.text((cx + 45, cy + 265 + l_idx * 38), line, font=f_card_desc,
                              fill=(170, 190, 210, int(210 * c_alpha)), anchor="lm")

        else:
            # Scene 3: Final Reveal & Outro
            s3_t = (t - 7.0) / 3.0
            alpha_mult = ease_in_out(clamp(s3_t / 0.25))

            # Pulse effect
            pulse = math.sin(s3_t * 5) * 8

            # Large central logo
            draw_gemini_sparkle(draw, WIDTH//2, 360, 110 + pulse, (0, 220, 255, int(240 * alpha_mult)))
            draw_gemini_sparkle(draw, WIDTH//2, 360, 60, (255, 255, 255, int(255 * alpha_mult)))

            # Main Branding
            draw.text((WIDTH//2, 530), "GEMINI 4 CARBON", font=f_title_big,
                      fill=(255, 255, 255, int(255 * alpha_mult)), anchor="mm")

            draw.text((WIDTH//2, 620), "Tương Lai Của Trí Tuệ Nhân Tạo Xanh & Tốc Độ", font=f_sub,
                      fill=(0, 220, 255, int(230 * alpha_mult)), anchor="mm")

            # Call to Action button
            btn_w = 420
            btn_h = 68
            bx = WIDTH//2 - btn_w//2
            by = 700
            # Button gradient background
            draw.rounded_rectangle([bx, by, bx + btn_w, by + btn_h], radius=34,
                                   fill=(0, 160, 240, int(230 * alpha_mult)),
                                   outline=(255, 255, 255, int(180 * alpha_mult)), width=2)
            draw.text((WIDTH//2, by + btn_h//2), "TRẢI NGHIỆM NGAY", font=get_font(FONT_BOLD_PATH, 28),
                      fill=(255, 255, 255, int(255 * alpha_mult)), anchor="mm")

            # Footer
            draw.text((WIDTH//2, 820), "google.com/gemini-carbon  •  Available Now", font=f_badge,
                      fill=(140, 170, 195, int(190 * alpha_mult)), anchor="mm")

        # Convert PIL to raw bytes and stream to ffmpeg
        proc.stdin.write(img.tobytes())

        if (frame + 1) % 60 == 0:
            print(f"Rendered {frame + 1}/{TOTAL_FRAMES} frames...")

    proc.stdin.close()
    proc.wait()
    print("Render complete! Video saved to:", video_path)

if __name__ == "__main__":
    render_video()
