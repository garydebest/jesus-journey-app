"""
comments_wordcloud.py -- the Comments Wordcloud companion to the Comments Report.

Source of truth is the church's saved Comments Report PDF. That document holds
only comments that already passed the comment-privacy rules (obvious
identifiers withheld, five-comment pool), so the cloud can never show anything
the church cannot already read, and it works for every closed survey, including
ones whose raw responses were purged long ago.

The cloud shows survey-relevant themes, not raw word frequency:
  * a curated lexicon maps wording to themes (e.g. "ask blunt questions without
    judging" -> "Safe space for questions");
  * standalone background words (church, pastor, God, Jesus, faith, the
    church's own name, ...) never appear on their own;
  * each theme counts once per comment, so one long comment cannot dominate;
  * themes are coloured as a request, an experience, or an appreciation, and a
    few themes switch to an appreciation label only when the same sentence says
    something is already helping ("prayer support ... has carried me").

Deterministic and offline: no comment text leaves the server.
"""
import math
import re
from collections import OrderedDict

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

import build_comments_report as chrome

ENGINE_VERSION = "jj-wordcloud-v1"
MIN_COMMENT_POOL = 5  # matches the Comments Report pool protection

REQUEST, EXPERIENCE, APPRECIATION, OTHER = "request", "experience", "appreciation", "other"
CATEGORY_COLORS = {
    REQUEST: HexColor("#A8532A"),       # rust: help people are asking for
    EXPERIENCE: HexColor("#2C5A85"),    # blue: experiences and struggles
    APPRECIATION: HexColor("#1B6F78"),  # teal: help already received
    OTHER: HexColor("#5B6B6B"),         # grey: other recurring words
}
CATEGORY_LABELS = {
    REQUEST: "Requests or desired help",
    EXPERIENCE: "Experiences or personal struggles",
    APPRECIATION: "Appreciation for what already helps",
    OTHER: "Other recurring words",
}

# Same-sentence markers that something is already helping.
APPRECIATION_MARKERS = re.compile(
    r"\b(thank\w*|grateful|appreciat\w*|keep (doing|pointing|going)|"
    r"(has|have|had) (really )?(carried|shaped|helped|kept|blessed|anchored|sustained|changed)|"
    r"carried me|kept me|shaped (me|my|us)|been a (blessing|gift)|love (the|our|how|that|being)|"
    r"blessed by|so glad|valued?)\b", re.I)

REQUEST_MARKERS = re.compile(
    r"\b(want|wants|wanted|need|needs|more|would|wish|hope|hoping|i'?d|please|could|should|like to|ready for|help me)\b", re.I)

# (key, category, pattern, appreciation_label_or_None, request_label)
# Order matters only for display ties; every matching theme counts.
THEMES = [
    # --- Requests -----------------------------------------------------------
    ("questions", REQUEST, r"\bquestions?\b|\bwithout judg", None, "Safe space for questions"),
    ("doubt", REQUEST, r"\bdoubts?\b|\bdoubting\b", None, "Honesty about doubt"),
    ("belong", REQUEST, r"\bbelong\w*|\bwelcom\w*|\bless alone\b|\blonely\b|\bloneliness\b|\bisolat\w*|\bfriendships?\b|\bconnect(ed|ion)? with (other )?people", None, "A place to belong"),
    ("small_groups", REQUEST, r"\bsmall(er)? (group|setting)s?\b|\b(home|life|cell|connect|growth) groups?\b", "Small group valued", "Small groups"),
    ("bible_study", REQUEST, r"\bbible stud(y|ies)\b|\b(weekday|weeknight|women'?s|men'?s) stud(y|ies)\b|\bjoin(ing)? (a|one) stud(y|ies)\b", None, "Accessible Bible study"),
    ("timing_fit", REQUEST, r"\btimes? that (actually )?works?\b|\bonly time\b|\bearly mornings?\b|\bschedul\w*|\bmeets? at a time\b|\bweeknights?\b|\bevenings?\b", None, "Times that work"),
    ("childcare", REQUEST, r"\bchild ?care\b|\bbabysit\w*|\bnursery\b", None, "Childcare"),
    ("mens", REQUEST, r"\bmen'?s (group|discipleship|ministry|breakfast|study)\b|\bguys like me\b", None, "Men's groups"),
    ("womens", REQUEST, r"\bwomen'?s (group|discipleship|ministry|bible|study)\b", None, "Women's groups"),
    ("parents", REQUEST, r"\bmoms?\b|\bmothers?\b|\bdads?\b|\bparenting\b|\byoung kids\b|\bmy kids\b|\bour kids\b|\bthe kids\b|\bchildren\b", None, "Parents and kids"),
    ("single_parents", REQUEST, r"\bsingle (moms?|mothers?|dads?|fathers?|parents?)\b", None, "Single parents"),
    ("family", REQUEST, r"\bas a family\b|\bfamil(y|ies)\b", None, "Faith as a family"),
    ("couples", REQUEST, r"\bhusband\b|\bwife\b|\bspouse\b|\bmarriages?\b|\bmarried couples?\b|\bcouples\b", None, "Growing together as a couple"),
    ("youth", REQUEST, r"\byouth\b|\bteens?\b|\bteenagers?\b|\byoung adults?\b|\bstudents?\b", None, "Youth & young adults"),
    ("accountability", REQUEST, r"\baccountab\w*|\bchecking in\b|\bcheck(s)? in on\b", None, "Accountability"),
    ("find_mentor", REQUEST, r"\ba mentor\b|\bmentor (for|to) me\b|\bfurther along than me\b|\bwho'?s walked through\b", None, "Finding a mentor"),
    ("mentor_others", REQUEST, r"\bmentor(ing)? (younger|others|new)\b|\binvest in (younger|others|new)\b|\bdisciple (younger|others|new)\b|\bpour (that |it )?back\b|\bone-on-one\b", None, "Mentoring others"),
    ("pathways", REQUEST, r"\bdiscipleship\b|\bdiscipling\b|\bpathways?\b|\bstructured\b|\bentry-level\b", None, "Discipleship pathways"),
    ("next_steps", REQUEST, r"\bnext steps?\b|\bclear(er)? (next )?steps?\b|\bpractical steps\b|\bwhat to do with\b", None, "Clear next steps"),
    ("deeper_teaching", REQUEST, r"\bdeeper\b|\bdepth\b|\bmore than the basics\b|\bwater (it )?down\b|\bin-depth\b", "Depth valued", "Deeper teaching"),
    ("everyday", REQUEST, r"\bday to day\b|\bday-to-day\b|\bdaily\b|\beveryday\b|\bsunday to monday\b|\bduring the week\b|\breal life\b", None, "Everyday faith"),
    ("practical", REQUEST, r"\bpractical\b|\bhow to\b|\bnot just .{0,30}\bbut how\b", None, "Practical teaching"),
    ("listening_prayer", REQUEST, r"\blisten(ing)? (prayer|to god)\b|\bactually listening\b|\bhearing god\b|\bgod'?s voice\b|\bbe still\b|\bsilence\b|\bcontemplat\w*", None, "Listening prayer"),
    ("prayer_support", REQUEST, r"\bprayer (support|team|partners?|ministry)\b|\bpray(ed|ing)? (for|with) (me|us)\b", "Prayer support received", "Prayer support"),
    ("learning_prayer", REQUEST, r"\bpray(er|ers|ing)?\b", None, "Learning to pray"),
    ("scripture", REQUEST, r"\bscriptures?\b|\bbible\b(?! stud)|\bword of god\b|\bgod'?s word\b", "Anchored in Scripture", "Scripture engagement"),
    ("serving", REQUEST, r"\bserv(e|es|ing)\b|\bvolunteer\w*|\bstretch(es)? me\b|\bspiritual gifts\b", None, "Meaningful serving"),
    ("mission", REQUEST, r"\bmissions?\b|\boutreach\b|\boverseas\b|\bevangel\w*|\bshare (my|our) faith\b|\bneighbou?rs?\b|\bjustice\b", None, "Mission & outreach"),
    ("grace", REQUEST, r"\bgrace\b|\bguilt\w*|\bshame\b|\bforgiv\w*|\bmy past\b", None, "Understanding grace"),
    ("encouragement", REQUEST, r"\bencourag\w*", None, "Encouragement"),
    ("beginners", REQUEST, r"\bbeginners?\b|\bnew (to|in) (the )?faith\b|\bfoundations?\b|\bnew believers?\b", None, "Help for beginners"),
    ("consistency", REQUEST, r"\bconsisten\w*|\bfollow through\b|\bhabits?\b|\bdiscipline\b", "Consistency valued", "Consistency"),
    ("worship", REQUEST, r"\bworship\w*|\bsinging\b", "Worship valued", "Worship"),
    ("care", REQUEST, r"(?<!prayer )\bsupport\b|\bcared for\b|\bpastoral care\b|\bcounsel\w*", "Care received", "More care & support"),
    ("leadership_honesty", REQUEST, r"\b(honesty|transparen\w*) from (the )?leadership\b|\btransparen\w*", "Leadership honesty valued", "Honest leadership"),
    # --- Experiences --------------------------------------------------------
    ("busy", EXPERIENCE, r"\bbusy\b|\bdistract\w*|\bno time\b|\btime is my\b|\bquiet minute\b|\boverwhelm\w*|\bexhaust\w*|\btired\b|\bgetting in the way\b", None, "Busy, distracted lives"),
    ("trust", EXPERIENCE, r"\btrust(ing|ed)?\b", None, "Learning to trust God"),
    ("hard_seasons", EXPERIENCE, r"\bsuffering\b|\bhard (season|year|time|thing)s?\b|\bhardest\b|\bhealth\b|\billness\b|\bcancer\b|\bgrie(f|ving)\b|\bloss\b|\bjob situation\b|\bdivorce\b|\bdidn'?t work out\b|\baging parent\b|\bdifficult (season|time)s?\b|\bstruggl\w*", None, "Hard seasons"),
    ("wrestling", EXPERIENCE, r"\bnot sure\b|\bback and forth\b|\bfigure (it )?out\b|\bfigured out\b|\bproof\b|\bwhat'?s (actually )?true\b|\bwant to believe\b|\bstopped believing\b|\bmade sense\b", None, "Wrestling with belief"),
    ("authentic", EXPERIENCE, r"\breal\b(?! accountab)|\bauthentic\w*|\bgenuine\w*|\bgoing through the motions\b|\bsunday routine\b", None, "Authentic faith"),
    ("control", EXPERIENCE, r"\bcontrol\b|\bhand (it )?over\b|\bcan'?t fix\b|\blet(ting)? go\b|\bsurrender\w*", None, "Letting go of control"),
    ("timing", EXPERIENCE, r"\bgod'?s timing\b|\btiming\b|\bwaiting on god\b", None, "God's timing"),
    ("distant", EXPERIENCE, r"\bfar from god\b|\bdry (season|spell)\b|\bnumb\b|\bdisconnected\b", None, "Feeling far from God"),
]
_COMPILED = [(k, cat, re.compile(p, re.I), appr, req) for k, cat, p, appr, req in THEMES]

# Background words never shown on their own (meaningful phrases that contain
# them are still recognised by the theme lexicon above).
BACKGROUND_WORDS = {
    "church", "churches", "pastor", "pastors", "congregation", "service", "services",
    "sunday", "sundays", "god", "jesus", "christ", "lord", "faith", "christian",
    "christians", "ministry", "spiritual", "spiritually", "walk", "closer", "help",
}
# Common verbs and adjectives that recur without carrying a theme on their own.
GENERIC_WORDS = set("""
believe believed believer believing grow growing grew continue continued continuing kept keeping talk talking
learn learning teach teaching opportunity opportunities start started ready hard easy change changed hope hoped
love loved deeper deep wish want wanted needed trying tried coming come came went bring brought hear hearing
heard open opened understand understood listen listening share shared live living walking walked follow following
show showing stay staying matter mattered biggest small big real whole together different important
""".split())
STOPWORDS = set("""
a about above actually after again against all almost alone along already also although always am among an and
another any anyone anything are aren't around as at away back be because been before being below between beyond
both but by can can't cannot could couldn't did didn't do does doesn't doing don't done down during each either
else enough especially even ever every everyone everything far feel feels felt few find for from further get gets
getting give go goes going gone good got great had hasn't has have haven't having he her here hers him his honestly
how however i i'd i'll i'm i've if in instead into is isn't it it's its itself just keep kind know knowing least
less let lets like likely little lot lots made make makes making many may maybe me might mine more most much must my
myself need needs never new no nor not nothing now of off often on once one only or other others our ours ourselves
out over own part people person place please pretty quite rather really right said same see seem seems she should
shouldn't since so some someone something sometimes somewhere still such sure take than that that's the their theirs
them themselves then there these they they're thing things think this those though through thus time times to too
toward towards try trying under until up upon us use used very want wants was wasn't way ways we we're well were
what what's when where whether which while who whole whom whose why will with within without won't would wouldn't
yet you you're your yours yourself year years week weeks day days today life lives able better bit day really
truly seems gets told stage point right whatever etc else ok okay yes thing still also yeah others other
""".split())


# ============================================================
# 1. Read comments back out of a saved Comments Report PDF
# ============================================================

_TAG_WORDS = {"MALE", "FEMALE", "UNKNOWN", "OTHER", "NOT ANSWERED", "PREFER NOT TO SAY"}
_NON_COMMENT_PREFIXES = (
    "Comments are presented without",
    "Insufficient responses to protect confidentiality",
)


def _page_runs(page):
    runs = []

    def visit(text, cm, tm, font_dict, font_size):
        if text and text.strip():
            size = round(float(font_size) * float(tm[0] or 1) * float(cm[0] or 1), 1)
            y = float(tm[5]) * float(cm[3] or 1) + float(cm[5])
            x = float(tm[4]) * float(cm[0] or 1) + float(cm[4])
            runs.append({"x": x, "y": y, "size": size, "text": text.replace("\n", " ").strip()})

    page.extract_text(visitor_text=visit)
    return runs


def read_report_identity(path):
    """(church_name, report_date) from the Comments Report footer, or (None, None)."""
    from pypdf import PdfReader
    reader = PdfReader(path)
    for page in reader.pages[1:3] or reader.pages[:1]:
        for r in _page_runs(page):
            m = re.match(r"^(.+?)\s+\u2022\s+(.+)$", r["text"])
            if m and abs(r["size"] - 9.0) < 0.05:
                return m.group(1).strip(), m.group(2).strip()
    return None, None


def extract_comments_from_pdf(path):
    """Return the list of comment strings in a saved Comments Report PDF.

    Handles both layouts the app has produced: the original grouped layout
    (gender tag beside each comment) and the current unlabelled layout (one
    paragraph per comment). Comment body text is the only 10 pt text in both.
    """
    from pypdf import PdfReader

    reader = PdfReader(path)
    comments = []
    current = None
    last_y = None
    for page in reader.pages:
        runs = _page_runs(page)
        joined = " ".join(r["text"] for r in runs)
        if "INTERPRETING YOUR COMMENTS REPORT" in joined.upper() and "Q:" not in joined:
            continue
        tag_ys = {round(r["y"], 1) for r in runs if r["text"].upper() in _TAG_WORDS}
        body = [r for r in runs if abs(r["size"] - 10.0) < 0.05 and r["y"] > 0.8 * inch]
        # Merge runs that share a baseline into lines, top to bottom.
        lines = OrderedDict()
        for r in sorted(body, key=lambda r: (-r["y"], r["x"])):
            key = round(r["y"], 1)
            lines.setdefault(key, []).append(r["text"])
        page_first = True
        for y, parts in lines.items():
            text = " ".join(parts).strip()
            if not text:
                continue
            starts_new = (
                current is None
                or y in tag_ys
                or (not page_first and last_y is not None and (last_y - y) > 17.5)
                or (page_first and (bool(tag_ys) or re.search(r"[.!?\u201d\"')]$", current)))
            )
            if starts_new:
                if current:
                    comments.append(current)
                current = text
            else:
                current = (current + " " + text).strip()
            last_y = y
            page_first = False
    if current:
        comments.append(current)
    cleaned = []
    for c in comments:
        c = re.sub(r"\s+", " ", c).strip()
        if not c or c.startswith(_NON_COMMENT_PREFIXES):
            continue
        cleaned.append(c)
    return cleaned


# ============================================================
# 2. Theme analysis
# ============================================================

def _strip_church_name(text, church_name):
    generic = {"church", "community", "the", "of", "and", "fellowship-church"}
    for token in re.findall(r"[A-Za-z']+", church_name or ""):
        if token.lower() in generic or len(token) < 3:
            continue
        text = re.sub(r"\b" + re.escape(token) + r"\b", " ", text, flags=re.I)
    return text


def _sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\s+[\u2014\u2013-]\s+", text)
    return [p for p in parts if p.strip()]


def _simple_lemma(word):
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def analyse_comments(comments, church_name=""):
    """Return {"terms": [...], "comment_count": n, "min_count": k}.

    Each term: {"label", "category", "count"} where count is the number of
    separate comments that mention the theme (once per comment)."""
    counts, categories, first_seen = {}, {}, {}
    covered_spans_by_comment = []
    order = 0
    for comment in comments:
        text = _strip_church_name(comment, church_name)
        labels_here = {}
        covered = []
        sentences = _sentences(text)
        for idx, sentence in enumerate(sentences):
            appreciative = bool(APPRECIATION_MARKERS.search(sentence))
            # "Continued depth and honesty from leadership. That transparency has
            # kept me here." The appreciation can follow in the next sentence,
            # but never overrides a sentence that is itself asking for something.
            if not appreciative and idx + 1 < len(sentences) and not REQUEST_MARKERS.search(sentence):
                appreciative = bool(APPRECIATION_MARKERS.search(sentences[idx + 1]))
            for key, cat, rx, appr_label, req_label in _COMPILED:
                m = rx.search(sentence)
                if not m:
                    continue
                covered.extend(mm.group(0) for mm in rx.finditer(sentence))
                if appreciative and appr_label:
                    label, category = appr_label, APPRECIATION
                else:
                    label, category = req_label, cat
                # A theme that is both requested and appreciated in one comment
                # keeps the appreciation; otherwise first match wins.
                if label not in labels_here:
                    labels_here[label] = category
        # Prayer specificity: a specific prayer theme replaces the generic one.
        if "Learning to pray" in labels_here and ({"Listening prayer", "Prayer support", "Prayer support received"} & labels_here.keys()):
            del labels_here["Learning to pray"]
        for label, category in labels_here.items():
            counts[label] = counts.get(label, 0) + 1
            categories[label] = category
            if label not in first_seen:
                first_seen[label] = order
                order += 1
        covered_spans_by_comment.append((text, covered))

    n = len(comments)
    min_count = max(1, n // 50)
    terms = [
        {"label": label, "category": categories[label], "count": c}
        for label, c in counts.items() if c >= min_count
    ]

    # Recurring meaningful words the lexicon did not already cover.
    word_docs = {}
    for text, covered in covered_spans_by_comment:
        covered_words = {w.lower() for span in covered for w in re.findall(r"[A-Za-z']+", span)}
        seen = set()
        for raw in re.findall(r"[A-Za-z][A-Za-z'-]+", text):
            w = raw.lower().strip("'-")
            if w.endswith("'s"):
                w = w[:-2]
            if len(w) < 4 or w in STOPWORDS or w in BACKGROUND_WORDS or w in GENERIC_WORDS or w in covered_words:
                continue
            lemma = _simple_lemma(w)
            if lemma in STOPWORDS or lemma in BACKGROUND_WORDS or lemma in GENERIC_WORDS:
                continue
            seen.add(lemma)
        for lemma in seen:
            word_docs[lemma] = word_docs.get(lemma, 0) + 1
    other_floor = max(4, math.ceil(0.06 * n))
    theme_words = {w.lower() for t in terms for w in re.findall(r"[A-Za-z]+", t["label"])}
    extras = sorted(
        ((w, c) for w, c in word_docs.items() if c >= other_floor and w not in theme_words),
        key=lambda wc: (-wc[1], wc[0]))[:8]
    for w, c in extras:
        terms.append({"label": w.capitalize(), "category": OTHER, "count": c})

    terms.sort(key=lambda t: (-t["count"], first_seen.get(t["label"], 999), t["label"]))
    # Keep the picture readable, but never let the cap silently remove every
    # appreciation: what is already helping matters as much as what is asked.
    cap = 48
    kept = terms[:cap]
    missing_appreciation = [t for t in terms[cap:] if t["category"] == APPRECIATION]
    if missing_appreciation:
        removable = [t for t in reversed(kept) if t["category"] != APPRECIATION]
        for t, drop in zip(missing_appreciation, removable):
            kept.remove(drop)
            kept.append(t)
        kept.sort(key=lambda t: (-t["count"], first_seen.get(t["label"], 999), t["label"]))
    return {"terms": kept, "comment_count": n, "min_count": min_count, "omitted": max(0, len(terms) - len(kept))}


# ============================================================
# 3. Layout: deterministic spiral packing of horizontal phrases
# ============================================================

def _font_for(size):
    return "DMSans-Bold" if size >= 15 else "Inter-SemiBold"


def layout_cloud(c, terms, box_w, box_h, max_size=36, min_size=11.5):
    if not terms:
        return []
    top = max(t["count"] for t in terms)
    low = min(t["count"] for t in terms)
    placed, boxes = [], []
    pad = 3.0
    cx, cy = box_w / 2, box_h / 2

    def size_for(count, scale):
        if top == low:
            frac = 1.0
        else:
            frac = math.sqrt((count - low) / (top - low))
        return (min_size + (max_size - min_size) * frac) * scale

    def fits(x, y, w, h):
        if x < 0 or y < 0 or x + w > box_w or y + h > box_h:
            return False
        for bx, by, bw, bh in boxes:
            if x < bx + bw + pad and x + w + pad > bx and y < by + bh + pad and y + h + pad > by:
                return False
        return True

    for scale in (1.0, 0.9, 0.8, 0.72, 0.65, 0.58):
        placed, boxes = [], []
        ok = True
        for term in terms:
            size = size_for(term["count"], scale)
            font = _font_for(size)
            w = c.stringWidth(term["label"], font, size)
            h = size * 0.98
            spot = None
            t = 0.0
            while t < 260:
                r = 2.2 * t
                x = cx + r * math.cos(t) * (box_w / box_h) * 0.85 - w / 2
                y = cy + r * math.sin(t) * 0.85 - h / 2
                if fits(x, y, w, h):
                    spot = (x, y)
                    break
                t += 0.07
            if spot is None:
                ok = False
                break
            boxes.append((spot[0], spot[1], w, h))
            placed.append({**term, "x": spot[0], "y": spot[1], "w": w, "h": h, "size": size, "font": font})
        if ok:
            return placed
    return placed


# ============================================================
# 4. PDF rendering
# ============================================================

PAGE_W, PAGE_H = letter
MARGIN = chrome.MARGIN


def _legend(c, x, y, categories_present):
    c.setFont("Inter", 9.4)
    for cat in (REQUEST, EXPERIENCE, APPRECIATION, OTHER):
        if cat not in categories_present:
            continue
        c.setFillColor(CATEGORY_COLORS[cat])
        c.roundRect(x, y - 1, 9, 9, 2, fill=1, stroke=0)
        c.setFillColor(chrome.INK)
        label = CATEGORY_LABELS[cat]
        c.drawString(x + 14, y, label)
        x += 14 + c.stringWidth(label, "Inter", 9.4) + 18


def _page_cloud(c, church_name, report_date, analysis):
    chrome.new_page(c, 1, "Comments Wordcloud", "What Your People Are Saying", church_name, report_date, title_size=22)
    y = PAGE_H - MARGIN - 0.95 * inch
    q = f"Themes drawn from written answers to: \u201c{chrome.QUESTION_TEXT}\u201d"
    y = chrome.draw_body_paragraph(c, MARGIN, y, q, PAGE_W - 2 * MARGIN, size=10, leading=14)

    box_x, box_top = MARGIN, y - 0.12 * inch
    box_w = PAGE_W - 2 * MARGIN
    box_h = 5.75 * inch
    box_y = box_top - box_h
    c.setFillColor(chrome.SURFACE)
    c.roundRect(box_x, box_y, box_w, box_h, 10, fill=1, stroke=0)

    terms = analysis["terms"]
    if not terms:
        c.setFont("Inter", 11)
        c.setFillColor(chrome.INK_MUTED)
        msg = ("There are not enough written comments to create a wordcloud while protecting confidentiality."
               if analysis["comment_count"] < MIN_COMMENT_POOL else
               "No recurring themes were found in the written comments. Read the Comments Report directly.")
        lines = chrome.wrapped_lines(c, msg, "Inter", 11, box_w - 1.2 * inch)
        ly = box_y + box_h / 2 + 8 * (len(lines) - 1)
        for ln in lines:
            c.drawCentredString(box_x + box_w / 2, ly, ln)
            ly -= 16
    else:
        inner = 0.22 * inch
        placed = layout_cloud(c, terms, box_w - 2 * inner, box_h - 2 * inner)
        for p in placed:
            c.setFillColor(CATEGORY_COLORS[p["category"]])
            c.setFont(p["font"], p["size"])
            c.drawString(box_x + inner + p["x"], box_y + inner + p["y"] + p["size"] * 0.22, p["label"])

    if not terms:
        return
    _legend(c, MARGIN, box_y - 0.3 * inch, {t["category"] for t in terms})

    y = box_y - 0.62 * inch
    notes = [
        f"Larger phrases appear in more comments. Size shows how often a theme comes up "
        f"({analysis['comment_count']} comments read), not how urgent or important it is.",
        "Each theme counts once per comment. Labels are short summaries of what people wrote, "
        "not direct quotations. Read the Comments Report for their own words.",
        "Background words such as church, pastor, God and Jesus are not shown on their own.",
    ]
    chrome.draw_bullet_block(c, MARGIN, y, notes, PAGE_W - 2 * MARGIN, size=9.6, leading=13, gap=5)


def _page_table(c, church_name, report_date, analysis):
    chrome.new_page(c, 2, "Comments Wordcloud", "Theme Counts and Method", church_name, report_date, title_size=22)
    y = PAGE_H - MARGIN - 1.0 * inch
    terms = analysis["terms"]
    col_gap = 0.35 * inch
    two_cols = len(terms) > 18
    col_w = (PAGE_W - 2 * MARGIN - (col_gap if two_cols else 0)) / (2 if two_cols else 1)
    rows_per_col = math.ceil(len(terms) / 2) if two_cols else len(terms)
    row_h = 0.236 * inch

    def header(x, yy):
        c.setFillColor(chrome.TEAL_DARK)
        c.rect(x, yy - 6, col_w, 0.27 * inch, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Inter-SemiBold", 9.2)
        c.drawString(x + 8, yy + 1, "Theme")
        c.drawRightString(x + col_w - 8, yy + 1, "Comments")

    for col in range(2 if two_cols else 1):
        x = MARGIN + col * (col_w + col_gap)
        yy = y
        header(x, yy)
        yy -= row_h + 2
        chunk = terms[col * rows_per_col:(col + 1) * rows_per_col]
        for i, t in enumerate(chunk):
            if i % 2 == 1:
                c.setFillColor(chrome.SURFACE)
                c.rect(x, yy - 6, col_w, row_h, fill=1, stroke=0)
            c.setFillColor(CATEGORY_COLORS[t["category"]])
            c.circle(x + 11, yy - 0.5 + 3, 3.4, fill=1, stroke=0)
            c.setFillColor(chrome.INK)
            c.setFont("Inter", 9.4)
            c.drawString(x + 21, yy, t["label"])
            c.setFont("Inter-SemiBold", 9.4)
            c.drawRightString(x + col_w - 8, yy, str(t["count"]))
            yy -= row_h
    table_bottom = y - (rows_per_col + 1) * row_h - 0.25 * inch

    y = table_bottom - 0.1 * inch
    c.setFillColor(chrome.TEAL_DARK)
    c.setFont("Inter-SemiBold", 11.5)
    c.drawString(MARGIN, y, "How this wordcloud is made")
    y -= 0.28 * inch
    if analysis["min_count"] > 1:
        floor_note = f"Themes mentioned in fewer than {analysis['min_count']} comments are left out so the picture stays clear."
    elif analysis.get("omitted"):
        floor_note = f"The {len(terms)} most frequent themes are shown; {analysis['omitted']} less frequent ones are left out so the picture stays clear."
    else:
        floor_note = "Every theme found is shown."
    method = [
        "It is created automatically from the comments in your Comments Report, after the same privacy "
        "safeguards: comments with obvious identifying details are withheld, and no cloud is made from "
        "fewer than five comments.",
        "Wording is grouped into survey-related themes, so different ways of saying the same thing count "
        "together (for example, pray, praying and prayer). Each theme counts once per comment, so one long "
        "comment cannot dominate. " + floor_note,
        "Requests and appreciation are kept apart: \u201cprayer support has carried me\u201d is shown as help "
        "already received, while \u201cI want to learn to pray\u201d is shown as a request.",
        "This is a starting point for prayerful conversation, not a finding on its own. Some comments "
        "contain several themes and some nuance is always lost; the full Comments Report remains the "
        "authoritative record of what people said.",
    ]
    chrome.draw_bullet_block(c, MARGIN, y, method, PAGE_W - 2 * MARGIN, size=9.6, leading=13, gap=6)


def build_wordcloud_pdf(out_path, church_name, report_date, comments):
    analysis = analyse_comments(comments, church_name) if len(comments) >= MIN_COMMENT_POOL else {
        "terms": [], "comment_count": len(comments), "min_count": 1}
    c = canvas.Canvas(out_path, pagesize=letter)
    c.setTitle(f"Comments Wordcloud \u2014 {church_name}")
    c.setAuthor("Jesus Journey Survey")
    c.setSubject(ENGINE_VERSION)
    _page_cloud(c, church_name, report_date, analysis)
    if analysis["terms"]:
        c.showPage()
        _page_table(c, church_name, report_date, analysis)
    c.showPage()
    c.save()
    return analysis
