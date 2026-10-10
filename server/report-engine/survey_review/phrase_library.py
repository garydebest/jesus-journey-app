"""Jesus Journey church report phrase library (draft for Gary and Dennis to review).

Every sentence a church report can show comes from this file. The report software chooses which
sentences apply to a church; it never writes new wording. Voice follows the 2019 Survey Review and
Actions Guide: first person plural ("We..."), plain, no numbers, diagnostic rather than prescriptive.

Sections
  ITEMS          one Strength wording and one Opportunity wording for each of the 63 statements
  PATHWAYS       a Strength headline, an Opportunity headline and a question to explore for each pathway
  BELIEF_GAP     "We believe..., but..." sentences for the seven pathways with belief and practice items
  STAGE          sentences for departures from the expected rise across stages
  GOAL           lead-in lines for the Goal tables
  ABOUT          "What did we discover about ourselves?" observations and questions to consider
"""

GOALS = {
    "Trusting Jesus": "How well do we know God's Story and trust God with our lives?",
    "Experiencing Jesus": "What are we doing to grow our faith and experience with God?",
    "Reflecting Jesus": "How is our life in God being expressed to others?",
    "Serving Jesus": "How much of our life involves seeing needs and serving others?",
}

# code: (strength, opportunity)
ITEMS = {
    # 1 Believing God's Story
    "K1": ("We firmly believe God created the world to be good.",
           "We are less certain that God created the world to be good."),
    "K2": ("We recognize that human failure has broken the world God designed.",
           "We are less clear that human failure is what broke the world God designed."),
    "K3": ("We are confident God will one day make everything new.",
           "We hold less confidence that God will one day make everything new."),
    "K4": ("We believe we can taste God's promised future in everyday life now.",
           "We are less sure we can experience God's promised future in everyday life now."),
    "K5": ("We accept that we won't always experience God's healing in this life.",
           "We find it hard to live with the tension that God's healing doesn't always come now."),
    # 2 Receiving God's Love
    "B1": ("We believe God is loving, caring and active in our lives, like a very good parent.",
           "We are less sure that God is loving, caring and active in our lives."),
    "B2": ("We are secure that Jesus has made a way for us to know God forever.",
           "We are less secure that Jesus has made a way for us to know God forever."),
    "B5": ("We believe nothing, not even our sin, can keep us from God's love.",
           "We are less sure that nothing can keep us from God's love."),
    "T1": ("We know we can't make God love us more or less.",
           "We find it hard to accept that we can't make God love us more or less."),
    # 3 My Identity
    "B6": ("We believe God sees us through faithful love.",
           "We are less sure that God sees us through faithful love."),
    "T2": ("How we see ourselves is shaped by how God sees us.",
           "How we see ourselves is not yet shaped by how God sees us."),
    "T4": ("We serve God out of joy rather than duty.",
           "Our serving often feels more like duty than joy."),
    # 4 Facing Challenges
    "B7": ("We believe God uses hard circumstances to deepen our trust.",
           "We are less sure God uses hard circumstances to deepen our trust."),
    "T5": ("We experience God's peace even in hard times.",
           "We don't often experience God's peace in hard times."),
    "T6": ("In hard situations we look first to how God would have us respond.",
           "In hard situations we don't often look to God first."),
    # 5 Responding to God
    "C1": ("We are aware of God's active presence in all of life.",
           "We are not very aware of God's active presence in daily life."),
    "C2": ("When we drift from God, we turn back quickly.",
           "When we drift from God, we are slow to turn back."),
    "C3": ("We expect the Holy Spirit to guide and empower us.",
           "We don't strongly expect the Holy Spirit to guide and empower us."),
    "T9": ("We are committed to God's purposes for our lives.",
           "We are less settled in our commitment to God's purposes for our lives."),
    # 6 Communicating with God
    "B3": ("We have a strong belief in the importance of talking honestly with God.",
           "We are less convinced that honest conversation with God matters."),
    "B4": ("We are confident God speaks to us in ways we can recognize.",
           "We have little confidence that we can hear God in ways we understand."),
    "C7": ("We spend time with God daily, speaking and listening.",
           "We don't talk with God that much."),
    "T8": ("We are quick to confess what displeases God.",
           "We are slow to confess what displeases God."),
    # 7 Growing my Faith
    "C4": ("We faithfully make time for the Bible.",
           "We don't regularly make time for the Bible."),
    "C5": ("We learn from other Christians' writing and media.",
           "We rarely draw on other Christians' writing or media to understand God."),
    "C8": ("We use spiritual practices such as silence, meditation or fasting.",
           "We make little use of spiritual practices such as silence, meditation or fasting."),
    "P6": ("We regularly invite God's leadership in our lives.",
           "We do little to invite God's leadership in our lives."),
    # 8 Worshipping
    "C6": ("We regularly praise God for who God is.",
           "We don't often take time to praise God."),
    "T7": ("We are thankful people who notice God at work.",
           "We don't often stop to thank God for acting in our lives."),
    "A6": ("We meet weekly with other Christians to worship, pray and learn.",
           "We don't regularly gather each week to worship, pray and learn."),
    # 9 Expressing God's Love
    "B8": ("We believe loving others makes a difference in our relationship with God.",
           "We are less convinced that loving others affects our relationship with God."),
    "K8": ("We believe loving others as Jesus loved us is one of the most important things we can do.",
           "We give less weight to loving others as central to God's will."),
    "T3": ("Others can see our love for God in how we love them.",
           "Our love for God isn't often visible in how we treat others."),
    "L9": ("People in our everyday settings see God's love in us.",
           "Our experience of God is not strongly expressed outside ourselves."),
    "P8": ("We sense God shaping us into a gift of love and grace to others.",
           "We have little sense that God is shaping us into a gift to others."),
    # 10 Practicing my Faith
    "A1": ("Following Jesus has changed how we speak, where we go and the choices we make.",
           "Following Jesus hasn't changed our everyday behaviour as much as we might expect."),
    "A3": ("We care about others and try to listen to them.",
           "We don't consistently listen to and seek to understand others."),
    "L7": ("We are willing to talk about our life with God.",
           "We are reluctant to talk with others about our life with God."),
    "P1": ("We try to see people through God's eyes.",
           "We don't often see the people around us through God's eyes."),
    "P4": ("We ask the Holy Spirit to reveal God's presence to those we pray with.",
           "We seldom ask the Holy Spirit to reveal God's presence to others."),
    # 11 Journeying with Others
    "A7": ("We have people we trust to be honest with about our spiritual lives.",
           "We don't often have people we can be fully honest with about our spiritual lives."),
    "A8": ("We have close relationships in which we help others grow spiritually.",
           "We have few close relationships in which we help others grow spiritually."),
    "A9": ("We welcome the wisdom and input of other Christians.",
           "We are hesitant to invite other Christians' input into our journey."),
    "P5": ("We encourage other believers to trust God's active presence.",
           "We have little confidence that God can use us to encourage others."),
    # 12 Reconciling
    "A4": ("We pursue reconciliation, both asking for and giving forgiveness.",
           "We don't readily pursue reconciliation in broken relationships."),
    "L2": ("We forgive without requiring people to change first.",
           "We tend to want people to change before we forgive them."),
    "L3": ("We work at forgiving others as God forgives us.",
           "We are not quick to forgive."),
    # 13 Partnering with God
    "B9": ("We believe God wants to be involved in all our relationships.",
           "We are less sure God wants to be involved in all our relationships."),
    "K6": ("We see ourselves as partners with God in making the world new.",
           "We don't yet see ourselves as partners with God in making the world new."),
    "K7": ("We believe the Holy Spirit can guide us to fulfil God's desires in the world.",
           "We are less sure the Holy Spirit can guide our actions in the world."),
    "L8": ("The Holy Spirit helps us apply God's wisdom to real situations.",
           "We are less confident in recognizing and acting on the Spirit's guidance."),
    "P3": ("We are aware that we partner with God in our interactions with people.",
           "We are seldom aware that we partner with God in our interactions with people."),
    # 14 Stewarding Resources
    "C9": ("We ask God for wisdom in using our time, energy and money.",
           "We seldom ask God how to use our time, energy and money."),
    "A2": ("We want to know how God can use our gifts and abilities.",
           "We give little thought to how God wants to use our gifts."),
    "A5": ("We gladly use our homes, money and time to help others know Jesus.",
           "We are much less generous with our homes, money and time."),
    "L4": ("We give generously to people in need.",
           "We are hesitant to give generously to people in need."),
    # 15 Showing Compassion
    "L1": ("We are kind and caring toward people just as they are.",
           "We find it hard to show kindness to people just as they are."),
    "P2": ("Kindness and compassion come easily to us.",
           "Responding with God's kindness and compassion doesn't come easily to us."),
    "P9": ("We trust God to give us grace when we help people in need.",
           "We find it hard to trust that God will work through us when we help people in need."),
    "P7": ("We act boldly when we see need.",
           "We hesitate to act when we see need."),
    # 16 Acting Justly
    "K9": ("We believe justice for the poor and oppressed is essential to God's plan.",
           "We are less convinced that serving the poor is central to God's plan."),
    "L5": ("We notice and befriend people who are often left out.",
           "We seldom form relationships with people who are often left out."),
    "L6": ("We take practical action against injustice.",
           "We take little practical action against injustice."),
}

# pathway number: (strength headline, opportunity headline, question to explore)
PATHWAYS = {
    1: ("We believe God's Story.",
        "We would do well to learn more about God's Story, including living between what God has done and what is still to come.",
        "Where do we teach and talk about the whole of God's Story, from creation to new creation?"),
    2: ("We are secure in God's love.",
        "We are not yet fully secure in God's love.",
        "What helps people here move from knowing about God's love to resting in it?"),
    3: ("We see ourselves the way God sees us.",
        "We don't yet see ourselves the way God sees us.",
        "Where do people hear and experience who they are in God's eyes?"),
    4: ("We trust God in hard times.",
        "Hard times shake our trust in God.",
        "How do we walk with one another when life is hard?"),
    5: ("We notice and respond to God's presence.",
        "We are not very aware of God's presence, and slow to respond when we are.",
        "What helps us notice God at work in ordinary life?"),
    6: ("We talk with God and expect God to speak.",
        "We don't talk with God much, and aren't confident we can hear God.",
        "Where do people learn and practise prayer as a two-way conversation?"),
    7: ("We take ownership of growing our faith.",
        "We do little on our own to grow our faith. Do we contract out our spiritual growth?",
        "How much of our growth depends on what happens at our gatherings?"),
    8: ("We are a thankful, worshipping people.",
        "Praise and thanks are not a regular part of our lives.",
        "Where does worship happen beyond our gatherings?"),
    9: ("Our love for God shows in how we love others.",
        "Our love for God is not strongly expressed outside ourselves.",
        "Where would people outside the church see God's love in us?"),
    10: ("Our faith shapes how we live and relate to others.",
         "Our faith is not yet shaping how we live and relate to others.",
         "Where are people helped to connect Sunday faith with Monday life?"),
    11: ("We walk the journey together.",
         "We don't often walk the journey closely with others.",
         "Who do we know outside our own group, and who walks with whom?"),
    12: ("We are quick to forgive and seek reconciliation.",
         "We are not quick to forgive.",
         "How do we handle hurt and conflict among ourselves?"),
    13: ("We see ourselves as partners with God.",
         "We don't yet see ourselves as active partners with God.",
         "Where do people get to practise listening for and acting on God's leading?"),
    14: ("We are generous with what God has given us.",
         "We are much less generous with what God has given us.",
         "How do we talk about money, time and homes as tools for God's purposes?"),
    15: ("We are kind and caring.",
         "Compassion is one of our clearest opportunities for growth.",
         "Where do people encounter needs and get to respond together?"),
    16: ("We take justice seriously.",
         "Justice is one of our clearest opportunities for growth.",
         "Who in our community is often left out, and do we know them?"),
}

# Belief runs ahead of practice in every church. These are used only where this church's gap is among its largest.
BELIEF_GAP = {
    2: "We believe nothing can keep us from God's love, but we still find it hard to accept that we can't earn it.",
    3: "We believe God sees us through love, but we don't see ourselves that way.",
    4: "We believe God will use adversity for good in our lives, but we aren't often at peace in those circumstances, nor do we look to God first.",
    6: "We believe talking honestly with God matters, but we don't do it much.",
    9: "We believe loving others is very important, but our love isn't strongly visible outside ourselves.",
    13: "We believe the Holy Spirit can guide us, but we don't have nearly as much confidence in recognizing and acting on that guidance.",
    16: "We believe justice is essential to God's plan for the world, but we take little practical action ourselves.",
}
BELIEF_GAP_CLOSE = "What we believe about {pathway_lc} and how we live it out are closely matched."

# Departures from the expected rise across stages. {pathway} is the pathway name; {stage} a stage group.
STAGE = {
    "falls_back": "{pathway}: our {stage} group is lower than the group before it, when we would expect it to be higher.",
    "no_rise": "{pathway} looks much the same from our Believing group to our {last} group, when we would expect it to grow.",
    "stalls": "{pathway} is no stronger in our {stage} group than in the group before it, when we would expect it to grow.",
    "rises_less": "{pathway} grows less across the stages than our other pathways.",
    "rises_more": "{pathway} grows more across the stages than our other pathways, especially in our {stage} group.",
    "tag": " (especially our {stage} group)",
}

GOAL = {
    "greatest_opportunity": "This is our greatest opportunity for growth.",
    "greatest_strength": "This is where we are strongest.",
}

# "What did we discover about ourselves?" Observations show only when the group has at least 10 people.
# Each has an observation and one or two questions to consider. {share} is a plain fraction such as "about 1 in 5".
ABOUT = {
    "stage_all": ("We have people at every point in the journey.",
                  "How do we help people at each point take their next step?"),
    "stage_early": ("Many of us are still exploring or beginning with Jesus ({share}).",
                    "Where do people early in the journey find relationship and help?"),
    "stage_centered_few": ("Relatively few of us describe Jesus as the centre of our lives ({share}).",
                           "Who are the people further along, and how are they connected with the rest of us?"),
    "stage_centered_many": ("Many of us describe Jesus as the centre of our lives ({share}).",
                            "How are those further along walking with those who are newer?"),
    "growth_most": ("Most of us say our faith has grown over the past two years ({share}).",
                    "What has helped people grow, and is it reaching everyone?"),
    "growth_same": ("Many of us say our faith is about the same as two years ago ({share}).",
                    "What would help those who feel they are standing still?"),
    "fading": ("Some of us say our faith is fading ({share}).",
               "Do we know who is drifting, and does anyone walk with them?"),
    "growth_stage_low": ("Our {stage} group is less likely than the rest of us to say their faith is growing.",
                         "What would help our {stage} group keep growing?"),
    "attend_weekly": ("Most of us attend our gatherings every week ({share}).", None),
    "attend_infrequent": ("A noticeable number of us attend monthly or less ({share}).",
                          "What keeps people connected between the times they attend?"),
    "newcomers": ("Many of us are new, having joined in the last two years ({share}).",
                  "How are newer people finding friends, a place to serve and help to grow?"),
    "long_tenure": ("Many of us have been part of this church for more than ten years ({share}).",
                    "How are long-time members sharing their experience and making room for newer people?"),
    "young_adults": ("Young adults aged 16 to 29 are part of our church ({share}).",
                     "Are young adults represented in who speaks, leads and is heard here?"),
    "young_adults_few": ("Few of us are young adults aged 16 to 29 ({share}).",
                         "Who are the young adults in our families and neighbourhood, and do they see a place here?"),
    "older": ("Many of us are 60 or older ({share}).",
              "How are our older members being drawn on as guides and mentors?"),
    "children": ("Many of our households have children at home ({share}).",
                 "How are parents helped to grow their own faith and their children's?"),
    "singles": ("Many of us are single ({share}).",
                "Do single people feel they belong, or is church life shaped mainly around couples and families?"),
    "separated": ("Some of us are separated or divorced ({share}).",
                  "Do those who have been through separation or divorce feel welcomed and supported?"),
    "minorities": ("Some of us identify with a racial or ethnic background other than White/Caucasian ({share}).",
                   "What are we doing to help people of every background feel they belong? Are they represented in who speaks and leads, and in what we speak about?"),
    "no_small_group": ("Many of us seldom or never meet with a small group ({share}).",
                       "Where do people who aren't in a small group find honest relationships about faith?"),
    "volunteer_few": ("Fewer than half of us volunteer at least a few times a month ({share}).",
                      "What keeps people from serving, and how do they find a place that fits?"),
    "group_growth_low": ("{group} are less likely than the rest of us to say their faith is growing.",
                         "What would help {group_lc} keep growing?"),
    "group_pathway_low": ("{group} score lower than others at the same stage on {pathway}.",
                          "What is shaping how {group_lc} experience {pathway_lc}?"),
    "group_pathway_high": ("{group} score higher than others at the same stage on {pathway}.",
                           "What could the rest of us learn from {group_lc} about {pathway_lc}?"),
}

# Group names used in ABOUT sentences.
GROUP_LABELS = {
    "age": {"16-19": "Our teens (16 to 19)", "20-29": "Our young adults in their twenties", "30-39": "People in their thirties",
            "40-49": "People in their forties", "50-59": "People in their fifties", "60 and older": "Those of us 60 and older"},
    "gender": {"Male": "Men", "Female": "Women"},
    "tenure": {"Less than 1 year": "People who joined in the last year", "1-2 years": "People here one to two years",
               "3-5 years": "People here three to five years", "6-10 years": "People here six to ten years",
               "11 or more years": "People here more than ten years"},
    "smallgroup": {"Every week": "Weekly small group members"},
    "volunteer": {"Every week": "Weekly volunteers"},
}

# ------------------------------------------------------------------ full church report page references
# The full church report draws every page in a fixed order (build_full_report.py), so page numbers are stable.
PATHWAY_PAGE = {1: 20, 2: 20, 3: 21, 4: 21, 5: 24, 6: 24, 7: 25, 8: 25, 9: 28, 10: 28, 11: 29, 12: 29, 13: 32, 14: 32, 15: 33, 16: 33}
GOAL_PAGE = {"Trusting Jesus": 22, "Experiencing Jesus": 26, "Reflecting Jesus": 30, "Serving Jesus": 34}
ABOUT_PAGE = {"stage_all": "10", "stage_early": "10", "stage_centered_few": "10", "stage_centered_many": "10",
              "growth_most": "14", "growth_same": "14", "fading": "14", "growth_stage_low": "15", "group_growth_low": "15–16",
              "attend_weekly": "9", "attend_infrequent": "9", "newcomers": "9", "long_tenure": "9", "no_small_group": "9", "volunteer_few": "9",
              "young_adults": "7", "young_adults_few": "7", "older": "7", "singles": "7", "separated": "7",
              "children": "8", "minorities": "8"}   # group_pathway_* lines have no page in the full report
SEE_PAGE = " (see page {page})"

# ------------------------------------------------------------------ fixed closing section (Gary, Oct 9)
WHERE_NEXT = [
    "Keep listening widely.",
    ("Staff planning to develop 3 strands of encouragement and support:", [
        "Helping us to include Jesus more actively in our day to day journey;",
        "Helping us to connect with one another along the journey;",
        "Helping us to take advantage of the practical wisdom and resources that are available within God's family."]),
    "Staff initiative is also focused on \u201chelping\u201d: the people of the community are always the primary agents in growth. Our focus must always be first of all how we each can lean into growth rather than developing more church programs.",
]
