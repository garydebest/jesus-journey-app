"""Synthetic respondent data shaped per docs/data-model.md's real column
names, used to validate build_from_aggregates() end-to-end."""
import random

random.seed(42)

ITEM_CODES = []
for prefix in ["B", "K", "A", "L", "P", "C", "T"]:
    for i in range(1, 10):
        ITEM_CODES.append(f"{prefix}{i}")

AGE_GROUPS = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"]
RELATIONSHIP = ["Independent single", "Single in relationship", "Married", "Married but separated", "Divorced", "Civil legal partnership"]
FREQUENCY = ["Every week", "A few times/month", "Monthly", "Every few months", "Infrequently or never"]
TENURE = ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "11 or more years"]
RACE = ["White/Caucasian", "Black/African descent", "Native People/First Nations", "Asian descent", "East Indian descent", "Hispanic descent", "From multiple races"]
CHILDREN_OPTIONS = ["None", "0-2 year old(s)", "3-5 year old(s)", "6-10 year old(s)", "11-18 year old(s)", "19 or older"]


def make_row(i):
    journey_post = random.choices([1, 2, 3, 4, 5], weights=[2, 8, 20, 40, 30])[0]
    # correlate item values loosely with journey_post maturity level
    base = 1 + journey_post * 0.7
    row = {}
    for code in ITEM_CODES:
        val = max(1, min(5, round(random.gauss(base, 1.0))))
        row[code] = val
    row["journey_pre"] = max(1, journey_post - random.choice([0, 1, 1, 2]))
    row["journey_post"] = journey_post
    row["spiritual_change"] = random.choices([1, 2, 3, 4, 5], weights=[35, 30, 25, 7, 3])[0]
    row["gender"] = random.choice(["Female", "Male"])
    row["age_group"] = random.choice(AGE_GROUPS)
    row["relationship_status"] = random.choice(RELATIONSHIP)
    row["attendance_frequency"] = random.choices(FREQUENCY, weights=[50, 25, 10, 10, 5])[0]
    row["tenure"] = random.choice(TENURE)
    row["small_group_frequency"] = random.choices(FREQUENCY, weights=[30, 20, 10, 15, 25])[0]
    row["volunteer_frequency"] = random.choices(FREQUENCY, weights=[20, 20, 15, 15, 30])[0]
    n_children_opts = random.choice([0, 0, 1, 1, 2])
    row["children_in_household"] = "|".join(random.sample(CHILDREN_OPTIONS[1:], n_children_opts)) if n_children_opts else "None"
    row["race_ethnicity"] = random.choices(RACE, weights=[70, 5, 5, 8, 3, 6, 3])[0]
    row["comment_text"] = "" if random.random() > 0.15 else f"Synthetic comment #{i} about my faith journey."
    return row


def generate(n=250):
    return [make_row(i) for i in range(n)]
