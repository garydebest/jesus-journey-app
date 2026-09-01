"""
REPORT_DATA contract for build_full_report.py

This module defines the single structured object that carries every
church-specific numeric/textual value the visual PDF template needs.
Static template content (goal descriptions, pathway item text, reflection
questions, scripture) is NOT part of this contract -- it lives in the
template itself because it describes the survey instrument, not any one
church's respondents.

`CANYON_VIEW_2017` below is populated with the EXACT literal values that
were hardcoded in the original build_full_report.py (verified line-by-line
against the source), used as the validation fixture to prove the refactored
template reproduces the original output with no visual regressions.

Row-group shape notes (must match exactly when producing new REPORT_DATA
from a different church's aggregates):
 - maturity_crosstabs sections are lists of (row_label, [Exploring, Believing,
   Trusting, Centered]) tuples, with section headers as (HEADER, None).
 - change_crosstabs sections are lists of (row_label, [Growing Sig., Growing
   a little, Not Changing, Fading]) tuples -- a collapsed 4-band scheme,
   different from the 5-band donut. Same (HEADER, None) convention.
 - The "children" cross-tab has only ONE data row ("Have children") in the
   original -- not broken out by number of children.
 - Age bands differ between sections: demographics age uses 6 bands
   (16-19...60+), maturity crosstab age uses the same 6 bands, but the
   change crosstab uses only 3 bands (16-29, 30-49, 50+).
 - Tenure bands also differ: demographics/maturity crosstab tenure uses 5
   bands (<1, 1-2, 3-5, 6-10, 11+), but the change crosstab tenure uses 4
   bands (<1, 1-2, 3-5, 6+).
"""

from dataclasses import dataclass


@dataclass
class ReportData:
    # --- Cover / header ---
    church_name: str
    report_date: str
    survey_period: str
    sample_size: int
    sample_size_engagement: int  # page 9 restates sample size; usually same as sample_size

    # --- Demographics (pages 7-8) ---
    gender_pct_female: float
    age_rows: list
    relationship_rows: list
    children_rows: list
    race_rows: list

    # --- Engagement (page 9) ---
    tenure_rows: list
    attendance_rows: list
    small_group_rows: list
    volunteer_rows: list

    # --- Spiritual maturity profile (pages 10-13) ---
    maturity_donut_values: list        # [Distant, Exploring, Believing, Trusting, Centered] %
    maturity_combined_stat: str        # e.g. "88.2%" (Trusting+Centered), pre-formatted
    maturity_crosstab_1: list          # sections for page_maturity_diversity_1 (GENDER, AGE, CHILDREN, TENURE)
    maturity_crosstab_2: list          # sections for page_maturity_diversity_2 (ATTENDANCE, SMALL GROUP, VOLUNTEER)

    # --- Spiritual change profile (pages 14-16) ---
    change_donut_values: list          # [Growing sig., Growing a little, About same, Fading some, Fading a lot] %
    change_donut_combined_stat: str    # "85.9%" shown inside the donut
    change_callout_combined_stat: str  # "84.3%" shown in the callout card below the donut
    change_crosstab_diversity_table: list  # sections for page_diversity_table (GENDER, AGE, TENURE, MATURITY, ATTENDANCE)
    change_crosstab_2: list            # sections for page_change_diversity_2 (MATURITY, ATTEND EVERY WEEK)

    # --- Jesus Journey Profile: 16 pathways across 4 goals (pages 19-34) ---
    # goal_num (1-4) -> list of (number, name, statement, items) where
    # items = [(text, [pct_believing_or_similar, pct_trusting, pct_centered, pct_col4_or_None]), ...]
    pathway_results: dict
    # goal_num -> {"labels": [...], "values": [...]}
    goal_summaries: dict

    # --- Summary profile (pages 35-37) ---
    all16_values: list
    maturity_line_believing: list
    maturity_line_trusting: list
    maturity_line_centered: list


# ------------------------------------------------------------------
# Canyon View 2017 -- literal values extracted verbatim from the
# original hardcoded build_full_report.py.
# ------------------------------------------------------------------

CANYON_VIEW_2017 = ReportData(
    church_name="Canyon View Vineyard Church",
    report_date="10/15/2017",
    survey_period="9/29/2017 \u2013 10/15/2017",
    sample_size=330,
    sample_size_engagement=330,

    gender_pct_female=60,
    age_rows=[("16\u201319", 2), ("20\u201329", 9), ("30\u201339", 13), ("40\u201349", 12),
              ("50\u201359", 28), ("60 and older", 35)],
    relationship_rows=[("Independent singles", 10), ("Singles in relationships", 5), ("Married", 75),
                        ("Married but separated", 2), ("Civil legal partnership", 0), ("Divorced", 8)],
    children_rows=[("None", 60), ("0\u20132 year old(s)", 8), ("3\u20135 year old(s)", 9),
                    ("6\u201310 year old(s)", 12), ("11\u201318 year old(s)", 18), ("19 or older", 12)],
    race_rows=[("White", 91), ("Black / African descent", 0), ("Native People / First Nations", 1),
               ("Asian descent", 2), ("East Indian descent", 0), ("Hispanic descent", 4),
               ("Multiple races", 2)],

    tenure_rows=[("Less than 1 year", 8), ("1\u20132 years", 12), ("3\u20135 years", 25),
                 ("6\u201310 years", 22), ("11 or more years", 34)],
    attendance_rows=[("Every week", 78), ("Few times per month", 17), ("Monthly", 2),
                      ("Every few months", 2), ("Infrequently or never", 2)],
    small_group_rows=[("Every week", 51), ("Few times/month", 17), ("Monthly", 5),
                       ("Every few months", 6), ("Infrequent/never", 22)],
    volunteer_rows=[("Every week", 22), ("Few times/month", 18), ("Monthly", 10),
                     ("Every few months", 15), ("Infrequent/never", 34)],

    maturity_donut_values=[0.6, 1.5, 9.7, 41.8, 46.4],
    maturity_combined_stat="88.2%",

    maturity_crosstab_1=[
        ("GENDER", None),
        ("Women", [2, 8, 38, 52]),
        ("Men", [3, 12, 47, 37]),
        ("AGE", None),
        ("16\u201319", [0, 50, 16, 33]),
        ("20\u201329", [10, 23, 32, 35]),
        ("30\u201339", [5, 7, 41, 48]),
        ("40\u201349", [3, 15, 48, 35]),
        ("50\u201359", [1, 9, 52, 38]),
        ("60 and older", [0, 4, 36, 60]),
        ("HAVE CHILDREN IN HOUSEHOLD (% each group)", None),
        ("Have children", [43, 47, 42, 37]),
        ("TIME INVOLVED IN THIS CHURCH", None),
        ("Less than 1 year", [12, 20, 32, 36]),
        ("1\u20132 years", [3, 5, 55, 38]),
        ("3\u20135 years", [1, 13, 43, 42]),
        ("6\u201310 years", [1, 11, 38, 49]),
        ("11 or more years", [1, 5, 41, 53]),
    ],
    maturity_crosstab_2=[
        ("FREQUENCY OF ATTENDING CHURCH GATHERINGS", None),
        ("Every week", [1, 8, 44, 47]),
        ("Few times per month", [2, 16, 38, 44]),
        ("Monthly or less", [22, 17, 22, 39]),
        ("FREQUENCY OF SMALL GROUP INVOLVEMENT", None),
        ("Every week", [1, 5, 40, 54]),
        ("Few times per month", [0, 13, 36, 52]),
        ("Monthly", [0, 13, 33, 53]),
        ("Every few months", [10, 0, 40, 50]),
        ("Infrequently or never", [6, 21, 53, 21]),
        ("FREQUENCY OF VOLUNTEERING", None),
        ("Every week", [1, 7, 32, 59]),
        ("Few times per month", [0, 8, 46, 46]),
        ("Monthly", [0, 12, 55, 33]),
        ("Every few months", [0, 10, 37, 53]),
        ("Infrequently or never", [5, 12, 44, 39]),
    ],

    change_donut_values=[57.9, 26.4, 11.8, 2.4, 1.5],
    change_donut_combined_stat="85.9%",
    change_callout_combined_stat="84.3% of your church reports growing faith and trust in God.",

    change_crosstab_diversity_table=[
        ("GENDER", None),
        ("Women", [63, 22, 12, 3]),
        ("Men", [50, 33, 11, 6]),
        ("AGE", None),
        ("16\u201329", [68, 16, 8, 8]),
        ("30\u201349", [56, 21, 17, 6]),
        ("50 and older", [57, 30, 11, 2]),
        ("TIME INVOLVED IN THIS CHURCH", None),
        ("Less than 1 year", [60, 28, 0, 12]),
        ("1\u20132 years", [63, 33, 3, 3]),
        ("3\u20135 years", [58, 24, 13, 5]),
        ("6 or more years", [57, 26, 15, 3]),
        ("LEVEL OF SPIRITUAL MATURITY", None),
        ("Exploring Jesus", [0, 29, 0, 71]),
        ("Beginning in Jesus", [19, 47, 19, 16]),
        ("Trusting in Jesus", [55, 30, 13, 1]),
        ("Jesus Centered", [71, 18, 10, 1]),
        ("ATTENDANCE", None),
        ("Attend every week", [63, 25, 10, 3]),
    ],
    change_crosstab_2=[
        ("LEVEL OF SPIRITUAL MATURITY", None),
        ("Exploring Jesus", [0, 29, 0, 71]),
        ("Beginning in Jesus", [19, 47, 19, 16]),
        ("Trusting in Jesus", [55, 30, 13, 1]),
        ("Jesus Centered", [71, 18, 10, 1]),
        ("ATTEND CHURCH GATHERINGS EVERY WEEK", None),
        ("Yes", [63, 25, 10, 3]),
    ],

    pathway_results={
        1: [
            ("1", "Believing God's Story",
             "I believe that God the Creator is completely renewing the world from its broken state.",
             [
                 ("I believe God originally created the world to be good.", [57, 81, 98, 99]),
                 ("I believe human failures have caused our world to be broken, altering what God designed.", [71, 81, 95, 97]),
                 ("I believe God will one day make everything new, as God intended it to be.", [87, 97, 99, None]),
                 ("I believe I can sometimes have experiences of God's promised future in my everyday life now.", [52, 83, 93, 74]),
                 ("I believe I will not always experience God's healing in every circumstance of my life now.", [76, 80, None, None]),
             ]),
            ("2", "Receiving God's Love", "I am secure in God's unconditional love for me.",
             [
                 ("I believe God is loving, caring and active in my life, like a very good parent would be.", [14, 72, 95, 100]),
                 ("I believe Jesus has provided a way for me to have a relationship with God forever.", [43, 84, 100, 100]),
                 ("I believe nothing can keep me from experiencing God's unconditional love \u2014 even my own sin \u2014 if I turn to God.", [29, 69, 95, 98]),
                 ("I know there is nothing I can do to make God love me more or love me less.", [57, 69, 84, 96]),
             ]),
            ("3", "My Identity", "My identity is rooted in the way God sees me.",
             [
                 ("I believe the way God sees me is rooted in God's faithful love for me.", [74, 92, 99, None]),
                 ("The way I see myself is determined most of all by how I believe God sees me.", [35, 53, 75, None]),
                 ("The things I do for Jesus I do for the joy of serving, not as a duty or obligation.", [52, 72, 94, None]),
             ]),
            ("4", "Facing Challenges", "I trust in God's commitment to me in the midst of challenges.",
             [
                 ("I believe the challenging circumstances of my life will be used by God to deepen my trust in God's care for me.", [71, 92, 99, None]),
                 ("Even in hard or difficult times, I am able to experience a deep sense of peace, trusting that God is with me.", [0, 50, 57, 87]),
                 ("When I face challenging situations, I first seek to know how God would want me to respond.", [29, 55, 84, None]),
             ]),
        ],
        2: [
            ("5", "Responding to God", "I am sensitive to God's leading and respond to God's will.",
             [
                 ("I am very aware of the active presence of God in all aspects of my life.", [0, 31, 67, 96]),
                 ("When I notice that I am moving away from God, I quickly turn toward God to be restored.", [19, 65, 93, None]),
                 ("I expect God's Holy Spirit to guide me and give me the power to live my life God's way.", [42, 78, 99, None]),
                 ("I trust in and am committed to God's purposes for my life.", [39, 75, 99, None]),
             ]),
            ("6", "Communicating with God", "My relationship with God is strengthened by frequent and meaningful communication.",
             [
                 ("I believe that openly and honestly speaking to God is necessary for a healthy relationship with God.", [29, 75, 98, 99]),
                 ("I believe God regularly communicates with me in ways I can recognize.", [14, 44, 62, 88]),
                 ("I spend time every day speaking with God and seeking God's thoughts and direction.", [0, 22, 62, 92]),
                 ("When I notice I have thoughts, motivations, words and actions that are displeasing to God, I am quick to confess them.", [0, 19, 49, 82]),
             ]),
            ("7", "Growing My Faith", "I intentionally respond to the invitation of God in tangible ways.",
             [
                 ("I set aside regular time to develop spiritual practices that draw me close to God.", [10, 35, 61, 84]),
                 ("I actively seek to grow in my understanding of Scripture and what it means for my life.", [14, 40, 66, 89]),
                 ("I look for ways that God's Spirit might be inviting me to grow and change.", [10, 44, 71, 92]),
                 ("I take practical steps to respond to what I sense God inviting me toward.", [5, 38, 65, 88]),
             ]),
            ("8", "Worshiping God", "I take time individually and with others to express my gratitude and commitment to God.",
             [
                 ("I regularly take time to worship God, alone or with others.", [19, 56, 82, 95]),
                 ("I express thankfulness and praise to God for what God has done in my life.", [24, 60, 85, 97]),
                 ("Worship is an important part of my ongoing relationship with God.", [14, 58, 88, 98]),
             ]),
        ],
        3: [
            ("9", "Expressing God's Love", "A central goal of my life is to be an expression of God's love.",
             [
                 ("I believe loving others can make a difference in my relationship with God.", [43, 75, 96, 99]),
                 ("I believe loving others as Jesus has loved me is one of the most important things I can do to further God's will in this world.", [84, 96, 99, None]),
                 ("Others see my love for God in how I express my love for them.", [23, 42, 70, None]),
                 ("In the various settings of my life, people see in me God's love expressed.", [19, 54, 80, None]),
                 ("I see God actively forming me to be a gift of love and grace to others.", [0, 19, 54, 81]),
             ]),
            ("10", "Practicing My Faith", "I express my faith by practically acting as I believe Jesus would act.",
             [
                 ("Following Jesus has changed my behavior, affecting how I speak, the places I go, and the moral decisions I make.", [61, 91, 99, None]),
                 ("I actively try to listen and understand everyone with whom I have some relationship.", [57, 63, 73, 84]),
                 ("I am willing to share about Jesus when talking with others.", [32, 47, 72, None]),
                 ("I try to focus on seeing people around me through God's eyes, not just my own.", [29, 25, 57, 82]),
                 ("I ask the Holy Spirit to reveal God's presence to people with whom I am praying or interacting.", [35, 53, 78, None]),
             ]),
            ("11", "Journeying with Others", "I walk out my Jesus journey in a give and take relationship with others.",
             [
                 ("I have people I trust with whom I can be honest about the state of my spiritual life and walk.", [29, 53, 72, 82]),
                 ("I have formed some close relationships through which I try to help people on their spiritual journey.", [23, 54, 78, None]),
                 ("I welcome the practical wisdom and input of other Christians in my journey to become more like Jesus.", [14, 59, 81, 95]),
                 ("I encourage other followers of Jesus to believe and have confidence in God's active presence in their lives.", [29, 64, 84, None]),
             ]),
            ("12", "Reconciling", "I embrace others as they are and am committed to asking for and releasing forgiveness.",
             [
                 ("I work towards pursuing reconciliation in any broken relationships by both requesting and giving forgiveness.", [41, 63, 84, None]),
                 ("I do not demand that people change for me to forgive them.", [59, 74, 86, None]),
                 ("I work toward forgiving others who have wronged me just as God forgives me.", [29, 44, 77, 90]),
             ]),
        ],
        4: [
            ("13", "Partnering with God", "I live my life in an active partnership with God.",
             [
                 ("I believe that God desires to be actively involved in all the relationships that are part of my life.", [77, 97, 99, None]),
                 ("I see myself as an active partner with God in helping to restore God's desires to make the earth new again.", [35, 65, 88, None]),
                 ("I believe the Holy Spirit can guide my actions to fulfill God's desires for this world in which we live.", [29, 63, 89, 99]),
                 ("The Holy Spirit helps me apply God's wisdom to specific life situations that I see or experience.", [0, 38, 70, 93]),
                 ("I am fully aware that I am partnering with God in all my interactions with people.", [23, 60, 81, None]),
             ]),
            ("14", "Stewarding Resources", "I act as a steward and not as an owner of the resources available to me.",
             [
                 ("I ask God for wisdom in how to use the resources God has given me (time, energy, and money).", [26, 57, 78, None]),
                 ("I seek to know how God wants me to use my gifts and abilities.", [14, 50, 83, 95]),
                 ("I gladly use my resources (home, money, time) to help others experience the love and invitation of Jesus.", [26, 54, 81, None]),
                 ("I am gladly willing to give generously to people who are in need.", [14, 50, 66, 76]),
             ]),
            ("15", "Showing Compassion", "God's compassion moves me to be a vehicle of God's grace to people in need.",
             [
                 ("I show kindness and care for the needs of people just as they are, as Jesus has done for me.", [45, 74, 86, None]),
                 ("I find it easy to respond to others as God does \u2014 with kindness and compassion.", [29, 28, 43, 63]),
                 ("When I reach out to people in need, I have confidence that God will give me grace to help them toward healing, deliverance, and change.", [29, 50, 78, None]),
                 ("In situations of need that I see or hear, I act boldly upon what I believe God desires to do.", [23, 46, 64, None]),
             ]),
            ("16", "Acting Justly", "I fulfill God's heart by advocating for the weak and powerless.",
             [
                 ("I believe serving the poor and oppressed is an essential part of God's plan to restore God's justice in the world.", [29, 78, 85, 94]),
                 ("I take notice of people who are not always accepted and form relationships with them.", [29, 13, 49, 52]),
                 ("I take practical actions against oppression and injustice.", [28, 41, 51, None]),
             ]),
        ],
    },

    goal_summaries={
        1: {"labels": ["1. Believing God's Story", "2. Receiving God's Love", "3. My Identity", "4. Facing Challenges"],
            "values": [89, 93, 77, 75]},
        2: {"labels": ["5. Responding to God", "6. Communicating with God", "7. Growing My Faith", "8. Worshiping God"],
            "values": [78, 74, 55, 76]},
        3: {"labels": ["9. Expressing God's Love", "10. Practicing My Faith", "11. Journeying with Others", "12. Reconciling with Others"],
            "values": [87, 82, 84, 88]},
        4: {"labels": ["13. Partnering with God", "14. Stewarding Resources", "15. Showing Compassion", "16. Acting Justly"],
            "values": [90, 79, 73, 74]},
    },

    all16_values=[89, 93, 77, 75, 78, 74, 55, 76, 87, 82, 84, 88, 90, 79, 73, 74],

    # The original file assigned `believing` twice (2nd overwrites 1st);
    # the 16-value 2nd assignment is what the chart actually rendered, so
    # that's preserved here as the validation fixture.
    maturity_line_believing=[75, 76, 74, 33, 40, 17, 44, 71, 42, 47, 40, 48, 47, 32, 26, 40],
    maturity_line_trusting=[90, 93, 71, 71, 71, 46, 70, 65, 68, 64, 76, 90, 65, 46, 55, 58],
    maturity_line_centered=[97, 97, 92, 91, 95, 70, 94, 91, 87, 78, 84, 91, 92, 78, 65, 66],
)
