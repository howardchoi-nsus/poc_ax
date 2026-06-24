from PIL import Image, ImageDraw, ImageFont

OUT = "docs/ai-promotion-builder-workflow.png"
W, H = 2600, 1600


def font(size, bold=False):
    for path in [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


FONT_TITLE = font(44, True)
FONT_ZONE = font(25, True)
FONT_BOX_TITLE = font(20, True)
FONT_BOX = font(18)
FONT_SMALL = font(15)


def size(draw, text, fnt):
    b = draw.textbbox((0, 0), text, font=fnt)
    return b[2] - b[0], b[3] - b[1]


def text(draw, value, rect, fnt, fill=(31, 41, 55), gap=7):
    x, y, w, h = rect
    lines = []
    for raw in value.split("\n"):
        cur = ""
        for ch in raw:
            trial = cur + ch
            if size(draw, trial, fnt)[0] <= w - 26:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = ch
        if cur:
            lines.append(cur)
    th = sum(size(draw, line, fnt)[1] for line in lines) + max(0, len(lines) - 1) * gap
    cy = y + (h - th) / 2
    for line in lines:
        tw, lh = size(draw, line, fnt)
        draw.text((x + (w - tw) / 2, cy), line, font=fnt, fill=fill)
        cy += lh + gap


def rounded(draw, rect, fill, outline, width=2, radius=20):
    draw.rounded_rectangle(rect, radius=radius, fill=fill, outline=outline, width=width)


def zone(draw, rect, title, fill, outline):
    rounded(draw, rect, fill, outline, width=3, radius=24)
    x1, y1, x2, _ = rect
    draw.rectangle((x1, y1, x2, y1 + 58), fill=fill, outline=outline, width=3)
    text(draw, title, (x1, y1 + 8, x2 - x1, 42), FONT_ZONE)


def box(draw, rect, title, body, fill, outline):
    rounded(draw, rect, fill, outline, width=2, radius=18)
    x1, y1, x2, y2 = rect
    text(draw, title, (x1 + 10, y1 + 12, x2 - x1 - 20, 28), FONT_BOX_TITLE)
    text(draw, body, (x1 + 12, y1 + 44, x2 - x1 - 24, y2 - y1 - 52), FONT_BOX, fill=(75, 85, 99))


def right(r):
    return (r[2], (r[1] + r[3]) / 2)


def left(r):
    return (r[0], (r[1] + r[3]) / 2)


def top(r):
    return ((r[0] + r[2]) / 2, r[1])


def bottom(r):
    return ((r[0] + r[2]) / 2, r[3])


def head(draw, a, b, color):
    x1, y1 = a
    x2, y2 = b
    if abs(x2 - x1) >= abs(y2 - y1):
        s = 1 if x2 >= x1 else -1
        pts = [(x2, y2), (x2 - 16 * s, y2 - 9), (x2 - 16 * s, y2 + 9)]
    else:
        s = 1 if y2 >= y1 else -1
        pts = [(x2, y2), (x2 - 9, y2 - 16 * s), (x2 + 9, y2 - 16 * s)]
    draw.polygon(pts, fill=color)


def line(draw, pts, color=(55, 65, 81), width=3):
    for a, b in zip(pts, pts[1:]):
        draw.line([a, b], fill=color, width=width)
    head(draw, pts[-2], pts[-1], color)


def label(draw, xy, value, color=(75, 85, 99)):
    draw.text(xy, value, font=FONT_SMALL, fill=color)


img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
d.text((W / 2, 60), "AI Promotion Page Builder 영역 구분 워크플로우", font=FONT_TITLE, anchor="mm", fill=(17, 24, 39))

zones = {
    "web": ((70, 130, 560, 720), "Web 서비스 영역\n운영자 화면 / 미리보기", (234, 244, 255), (59, 130, 246)),
    "ai": ((620, 130, 1590, 720), "AI 하네스 영역\n현재 기준: n8n 오케스트레이션", (238, 248, 239), (34, 197, 94)),
    "out": ((1650, 130, 2260, 720), "출력 / 연동 후보", (243, 236, 255), (147, 51, 234)),
    "wp": ((70, 830, 980, 1180), "WordPress 영역\n현재 GG Promo 운영 기준", (245, 245, 245), (100, 116, 139)),
    "data": ((1040, 830, 2260, 1180), "DB / 데이터 영역", (255, 244, 229), (217, 119, 6)),
}

for args in zones.values():
    zone(d, *args)

nodes = {
    # Web
    "input": ((120, 245, 330, 345), "운영자 입력", "자연어 또는\n표준 입력 폼", (255, 255, 255), (59, 130, 246)),
    "review": ((120, 455, 330, 555), "Review UI", "미리보기 / JSON\nRule 결과 / 수정", (255, 255, 255), (59, 130, 246)),
    "preview": ((350, 455, 520, 555), "웹 미리보기", "검수용 렌더링", (255, 255, 255), (59, 130, 246)),
    # AI
    "n8n": ((670, 235, 875, 335), "n8n Workflow", "작업 순서 제어\n교체 가능 하네스", (255, 255, 255), (34, 197, 94)),
    "nlp": ((945, 235, 1150, 335), "NLP 분석", "요구사항 해석\nContext 추출", (255, 255, 255), (34, 197, 94)),
    "rule": ((1220, 235, 1430, 335), "Rule Base", "필수 구조 / 정책\n보안 / 운영 통제", (255, 255, 255), (217, 119, 6)),
    "planner": ((670, 475, 875, 575), "Page Planner", "Template Family\n섹션 구조 생성", (255, 255, 255), (34, 197, 94)),
    "json": ((945, 475, 1150, 575), "Page JSON", "Sections / Assets\nRules / CTA", (255, 255, 255), (34, 197, 94)),
    "validator": ((1220, 475, 1430, 575), "Policy Validator", "Affiliate / Bonus Code\nQ-TAG / XSS / RG", (255, 255, 255), (217, 119, 6)),
    # Output
    "wp_export": ((1705, 235, 1925, 335), "WordPress Export", "현재 시스템 연동 후보", (255, 255, 255), (147, 51, 234)),
    "cms": ((1985, 235, 2205, 335), "내부 CMS 연동", "사내 CMS 확장 후보", (255, 255, 255), (147, 51, 234)),
    "standalone": ((1705, 475, 1925, 575), "독립 Builder", "Next.js 등 별도 서비스", (255, 255, 255), (147, 51, 234)),
    "deploy": ((1985, 475, 2205, 575), "배포 자동화", "GitHub / Vercel 향후 후보", (255, 255, 255), (147, 51, 234)),
    # WordPress
    "wp_admin": ((125, 950, 330, 1050), "WP Admin", "기존 GG Promo Builder", (255, 255, 255), (100, 116, 139)),
    "wp_template": ((410, 950, 620, 1050), "WP 템플릿", "Template 4\npromo_001 / promo_002", (255, 255, 255), (100, 116, 139)),
    "wp_render": ((700, 950, 920, 1050), "WP 렌더링", "PHP 템플릿\n메타 기반 출력", (255, 255, 255), (100, 116, 139)),
    # Data
    "campaign_db": ((1100, 950, 1310, 1050), "Campaign DB", "요청 / Page JSON\n검수 이력", (255, 255, 255), (217, 119, 6)),
    "rule_db": ((1390, 950, 1600, 1050), "Rule DB", "CTA / 약관\nAffiliate 규칙", (255, 255, 255), (217, 119, 6)),
    "ref_db": ((1680, 950, 1890, 1050), "Reference DB", "기존 페이지\n템플릿 패밀리", (255, 255, 255), (217, 119, 6)),
    "affiliate_db": ((1970, 950, 2185, 1050), "Affiliate DB", "Q-TAG / Bonus Code\n로컬 매핑", (255, 255, 255), (217, 119, 6)),
}

for rect, title, body, fill, outline in nodes.values():
    box(d, rect, title, body, fill, outline)

R = {k: v[0] for k, v in nodes.items()}

# AI POC main flow
line(d, [right(R["input"]), (590, 295), left(R["n8n"])], color=(37, 99, 235))
line(d, [right(R["n8n"]), left(R["nlp"])])
line(d, [right(R["nlp"]), left(R["rule"])])
line(d, [bottom(R["n8n"]), top(R["planner"])])
line(d, [right(R["planner"]), left(R["json"])])
line(d, [right(R["json"]), left(R["validator"])])
line(d, [left(R["validator"]), (1160, 525), (1160, 630), (460, 630), bottom(R["review"])], color=(37, 99, 235))
line(d, [right(R["review"]), left(R["preview"])], color=(37, 99, 235))
line(d, [left(R["review"]), (95, 505), (95, 295), left(R["input"])], color=(37, 99, 235))

# Output candidates from validated artifact
line(d, [right(R["validator"]), (1620, 525), (1620, 285), left(R["wp_export"])], color=(147, 51, 234))
line(d, [right(R["validator"]), (1620, 525), (1620, 525), left(R["standalone"])], color=(147, 51, 234))
line(d, [right(R["wp_export"]), left(R["cms"])], color=(147, 51, 234))
line(d, [right(R["standalone"]), left(R["deploy"])], color=(147, 51, 234))

# Current WordPress flow
line(d, [right(R["wp_admin"]), left(R["wp_template"])], color=(100, 116, 139))
line(d, [right(R["wp_template"]), left(R["wp_render"])], color=(100, 116, 139))
line(d, [top(R["wp_template"]), (515, 800), (1815, 800), bottom(R["wp_export"])], color=(100, 116, 139))

# Data references into AI harness
line(d, [top(R["campaign_db"]), (1205, 760), bottom(R["json"])], color=(217, 119, 6))
line(d, [top(R["rule_db"]), (1495, 760), bottom(R["rule"])], color=(217, 119, 6))
line(d, [top(R["ref_db"]), (1785, 760), bottom(R["planner"])], color=(217, 119, 6))
line(d, [top(R["affiliate_db"]), (2078, 760), bottom(R["validator"])], color=(217, 119, 6))

label(d, (365, 265), "생성 요청", color=(37, 99, 235))
label(d, (690, 620), "검증 결과 / 수정 루프", color=(37, 99, 235))
label(d, (1625, 495), "검증 산출물", color=(147, 51, 234))
label(d, (1030, 780), "AI 하네스가 참조", color=(154, 52, 18))
label(d, (820, 780), "현재 WP 기준", color=(71, 85, 105))

rounded(d, (380, 1300, 2220, 1410), (255, 242, 204), (214, 182, 86), width=2, radius=24)
text(
    d,
    "구분 원칙: Web 서비스는 운영자 경험과 검수 화면, WordPress는 현재 운영/렌더링 기준, AI 하네스는 n8n 기반 오케스트레이션, DB/데이터는 규칙/레퍼런스/제휴사 매핑을 담당한다.",
    (420, 1328, 1760, 54),
    FONT_BOX_TITLE,
)

img.save(OUT)
print(OUT)
