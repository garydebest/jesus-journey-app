"""
Static survey-instrument content for the Jesus Journey church report
template: pathway display names/statements, per-item question text, and
goal/maturity display-label overrides. This content describes the SURVEY
ITSELF, not any one church's respondents, so it never varies between
build_from_aggregates() calls -- it's the fixed half of the report,
paired with church-specific percentages computed at call time.

Extracted verbatim from the validated CANYON_VIEW_2017 fixture in
report_data.py (itself extracted from the original hardcoded
build_full_report.py), cross-checked against church_report.py's
PATHWAYS/GOALS/MATURITY_LABELS item-code ordering.
"""

# pathway number (1-16) -> {"name": display name, "statement": bold
# summary statement shown at the top of that pathway's page}
PATHWAY_META = {
    1: {
        "name": "Believing God's Story",
        "statement": "I believe that God the Creator is completely renewing the world from its broken state."
    },
    2: {
        "name": "Receiving God's Love",
        "statement": "I am secure in God's unconditional love for me."
    },
    3: {
        "name": "My Identity",
        "statement": "My identity is rooted in the way God sees me."
    },
    4: {
        "name": "Facing Challenges",
        "statement": "I trust in God's commitment to me in the midst of challenges."
    },
    5: {
        "name": "Responding to God",
        "statement": "I am sensitive to God's leading and respond to God's will."
    },
    6: {
        "name": "Communicating with God",
        "statement": "My relationship with God is strengthened by frequent and meaningful communication."
    },
    7: {
        "name": "Growing My Faith",
        "statement": "I intentionally respond to the invitation of God in tangible ways."
    },
    8: {
        "name": "Worshiping God",
        "statement": "I take time individually and with others to express my gratitude and commitment to God."
    },
    9: {
        "name": "Expressing God's Love",
        "statement": "A central goal of my life is to be an expression of God's love."
    },
    10: {
        "name": "Practicing My Faith",
        "statement": "I express my faith by practically acting as I believe Jesus would act."
    },
    11: {
        "name": "Journeying with Others",
        "statement": "I walk out my Jesus journey in a give and take relationship with others."
    },
    12: {
        "name": "Reconciling",
        "statement": "I embrace others as they are and am committed to asking for and releasing forgiveness."
    },
    13: {
        "name": "Partnering with God",
        "statement": "I live my life in an active partnership with God."
    },
    14: {
        "name": "Stewarding Resources",
        "statement": "I act as a steward and not as an owner of the resources available to me."
    },
    15: {
        "name": "Showing Compassion",
        "statement": "God's compassion moves me to be a vehicle of God's grace to people in need."
    },
    16: {
        "name": "Acting Justly",
        "statement": "I fulfill God's heart by advocating for the weak and powerless."
    }
}

# pathway number (1-16) -> ordered list of survey item codes belonging to
# that pathway. Matches church_report.py's PATHWAYS[n]["items"] exactly
# (verified item-count match against the validated CANYON_VIEW_2017
# fixture's pathway_results item lists).
PATHWAY_ITEM_CODES = {
    1: ["K1", "K2", "K3", "K4", "K5"],
    2: ["B1", "B2", "B5", "T1"],
    3: ["B6", "T2", "T4"],
    4: ["B7", "T5", "T6"],
    5: ["C1", "C2", "C3", "T9"],
    6: ["B3", "B4", "C7", "T8"],
    7: ["C4", "C5", "C8", "P6"],
    8: ["C6", "T7", "A6"],
    9: ["B8", "K8", "T3", "L9", "P8"],
    10: ["A1", "A3", "L7", "P1", "P4"],
    11: ["A7", "A8", "A9", "P5"],
    12: ["A4", "L2", "L3"],
    13: ["B9", "K6", "K7", "L8", "P3"],
    14: ["C9", "A2", "A5", "L4"],
    15: ["L1", "P2", "P9", "P7"],
    16: ["K9", "L5", "L6"],
}

# survey item code (e.g. "K1", "B7") -> exact question text shown in the
# per-item crosstab table rows.
ITEM_TEXT = {
    "K1": "I believe God originally created the world to be good.",
    "K2": "I believe human failures have caused our world to be broken, altering what God designed.",
    "K3": "I believe God will one day make everything new, as God intended it to be.",
    "K4": "I believe I can sometimes have experiences of God's promised future in my everyday life now.",
    "K5": "I believe I will not always experience God's healing in every circumstance of my life now.",
    "B1": "I believe God is loving, caring and active in my life, like a very good parent would be.",
    "B2": "I believe Jesus has provided a way for me to have a relationship with God forever.",
    "B5": "I believe nothing can keep me from experiencing God's unconditional love \u2014 even my own sin \u2014 if I turn to God.",
    "T1": "I know there is nothing I can do to make God love me more or love me less.",
    "B6": "I believe the way God sees me is rooted in God's faithful love for me.",
    "T2": "The way I see myself is determined most of all by how I believe God sees me.",
    "T4": "The things I do for Jesus I do for the joy of serving, not as a duty or obligation.",
    "B7": "I believe the challenging circumstances of my life will be used by God to deepen my trust in God's care for me.",
    "T5": "Even in hard or difficult times, I am able to experience a deep sense of peace, trusting that God is with me.",
    "T6": "When I face challenging situations, I first seek to know how God would want me to respond.",
    "C1": "I am very aware of the active presence of God in all aspects of my life.",
    "C2": "When I notice that I am moving away from God, I quickly turn toward God to be restored.",
    "C3": "I expect God's Holy Spirit to guide me and give me the power to live my life God's way.",
    "T9": "I trust in and am committed to God's purposes for my life.",
    "B3": "I believe that openly and honestly speaking to God is necessary for a healthy relationship with God.",
    "B4": "I believe God regularly communicates with me in ways I can recognize.",
    "C7": "I spend time every day speaking with God and seeking God's thoughts and direction.",
    "T8": "When I notice I have thoughts, motivations, words and actions that are displeasing to God, I am quick to confess them.",
    "C4": "I set aside regular time to develop spiritual practices that draw me close to God.",
    "C5": "I actively seek to grow in my understanding of Scripture and what it means for my life.",
    "C8": "I look for ways that God's Spirit might be inviting me to grow and change.",
    "P6": "I take practical steps to respond to what I sense God inviting me toward.",
    "C6": "I regularly take time to worship God, alone or with others.",
    "T7": "I express thankfulness and praise to God for what God has done in my life.",
    "A6": "Worship is an important part of my ongoing relationship with God.",
    "B8": "I believe loving others can make a difference in my relationship with God.",
    "K8": "I believe loving others as Jesus has loved me is one of the most important things I can do to further God's will in this world.",
    "T3": "Others see my love for God in how I express my love for them.",
    "L9": "In the various settings of my life, people see in me God's love expressed.",
    "P8": "I see God actively forming me to be a gift of love and grace to others.",
    "A1": "Following Jesus has changed my behavior, affecting how I speak, the places I go, and the moral decisions I make.",
    "A3": "I actively try to listen and understand everyone with whom I have some relationship.",
    "L7": "I am willing to share about Jesus when talking with others.",
    "P1": "I try to focus on seeing people around me through God's eyes, not just my own.",
    "P4": "I ask the Holy Spirit to reveal God's presence to people with whom I am praying or interacting.",
    "A7": "I have people I trust with whom I can be honest about the state of my spiritual life and walk.",
    "A8": "I have formed some close relationships through which I try to help people on their spiritual journey.",
    "A9": "I welcome the practical wisdom and input of other Christians in my journey to become more like Jesus.",
    "P5": "I encourage other followers of Jesus to believe and have confidence in God's active presence in their lives.",
    "A4": "I work towards pursuing reconciliation in any broken relationships by both requesting and giving forgiveness.",
    "L2": "I do not demand that people change for me to forgive them.",
    "L3": "I work toward forgiving others who have wronged me just as God forgives me.",
    "B9": "I believe that God desires to be actively involved in all the relationships that are part of my life.",
    "K6": "I see myself as an active partner with God in helping to restore God's desires to make the earth new again.",
    "K7": "I believe the Holy Spirit can guide my actions to fulfill God's desires for this world in which we live.",
    "L8": "The Holy Spirit helps me apply God's wisdom to specific life situations that I see or experience.",
    "P3": "I am fully aware that I am partnering with God in all my interactions with people.",
    "C9": "I ask God for wisdom in how to use the resources God has given me (time, energy, and money).",
    "A2": "I seek to know how God wants me to use my gifts and abilities.",
    "A5": "I gladly use my resources (home, money, time) to help others experience the love and invitation of Jesus.",
    "L4": "I am gladly willing to give generously to people who are in need.",
    "L1": "I show kindness and care for the needs of people just as they are, as Jesus has done for me.",
    "P2": "I find it easy to respond to others as God does \u2014 with kindness and compassion.",
    "P9": "When I reach out to people in need, I have confidence that God will give me grace to help them toward healing, deliverance, and change.",
    "P7": "In situations of need that I see or hear, I act boldly upon what I believe God desires to do.",
    "K9": "I believe serving the poor and oppressed is an essential part of God's plan to restore God's justice in the world.",
    "L5": "I take notice of people who are not always accepted and form relationships with them.",
    "L6": "I take practical actions against oppression and injustice."
}

# goal number (1-4) -> short display label used in goal_summaries labels
# and page titles. church_report.py's GOALS dict uses longer descriptive
# names ("Trusting God in your life", etc.) that are NOT used verbatim in
# the visual template -- these short forms are the ones actually rendered.
GOAL_SHORT_NAMES = {
    1: "Trusting Jesus",
    2: "Experiencing Jesus",
    3: "Reflecting Jesus",
    4: "Serving Jesus",
}

# goal number -> full label used in goal_summaries chart labels, e.g.
# "1. Believing God's Story". Pulled from the validated pathway names
# above, in PATHWAYS order per goal.
GOAL_PATHWAY_NUMBERS = {
    1: [1, 2, 3, 4],
    2: [5, 6, 7, 8],
    3: [9, 10, 11, 12],
    4: [13, 14, 15, 16],
}

# church_report.py's MATURITY_LABELS use "God" wording ("Believing in
# God", "Trusting God", "God Centered"); the PDF template's donut/
# crosstab labels use "Jesus" wording. Maps church_report.py's label ->
# template display label. "Distant"/"Exploring" are unchanged.
MATURITY_LABEL_DISPLAY = {
    "Distant": "Distant",
    "Exploring": "Exploring",
    "Believing in God": "Beginning in Jesus",
    "Trusting God": "Trusting in Jesus",
    "God Centered": "Jesus Centered",
}

# Order used for the 5-band maturity donut and the demographic crosstabs'
# 4 data columns (Exploring/Believing/Trusting/Centered -- Distant is
# excluded from crosstab columns per real-report convention, matching
# SUMMARY_CROSSTAB_GROUPS = [3, 4, 5] plus Exploring=2 for the 4-column
# per-item/demographic tables).
MATURITY_LABEL_ORDER_5BAND = [
    "Distant", "Exploring", "Believing in God", "Trusting God", "God Centered",
]
MATURITY_LABEL_ORDER_4COL = [
    "Exploring", "Believing in God", "Trusting God", "God Centered",
]

# change_profile()'s CHANGE_4BAND labels already match the template's
# wording ("Growing Significantly", "Growing a little", "Not Changing",
# "Fading") -- no relabeling needed, kept here only for a single source
# of truth on column order.
CHANGE_LABEL_ORDER_4BAND = [
    "Growing Significantly", "Growing a little", "Not Changing", "Fading",
]

# change_profile()'s CHANGE_LABELS (5-band donut) order.
CHANGE_LABEL_ORDER_5BAND = [
    "Growing significantly", "Growing a little", "About the same",
    "Fading somewhat", "Fading a lot",
]
