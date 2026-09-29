export function Privacy() {
  return <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
    <h1 className="text-xl font-semibold">Survey privacy notice</h1>
    <p>Church survey demographic questions are voluntary, including ethnic, cultural, or racial background. You can skip any of them without affecting your personal report. “Prefer not to say” is available for gender, relationship status, and background.</p>
    <h2 className="text-lg font-semibold">How demographic answers are used</h2>
    <p>Answers help describe combined patterns in your church. Demographic categories with fewer than 10 respondents are withheld from new church reports, summaries, and administrative insights. Other results may also be withheld to prevent small groups being inferred. Skipped and “Prefer not to say” answers are not comparison groups. Ethnic background selections may overlap, so their percentages can total more than 100%.</p>
    <p>Survey responses are processed to produce church reports. After the required reports are successfully saved and verified, raw responses are deleted; aggregate reports remain. Older saved reports may have been produced under earlier reporting rules. A minimum group size reduces identification risk but cannot guarantee that no one will recognize a pattern in a small community.</p>
    <h2 className="text-lg font-semibold">Regional question wording</h2>
    <p>A country header supplied by the hosting network is used transiently to choose the initial background wording. This feature does not store your raw IP address, detected country, or wording preset in responses, report data, or analytics. When the header is unavailable, international wording is used. This does not describe or change the hosting provider’s separate operational logs.</p>
    <h2 className="text-lg font-semibold">Your words and your personal report</h2>
    <p>Written comments may be included in a separate church comments report. Please avoid names or identifying details. Your personal report should be saved privately before you leave the survey. Independent surveys do not save your answers to the church database.</p>
    <p>These are descriptions of how the survey works, not a claim of legal compliance. Ask your church’s survey coordinator if you have questions before taking part.</p>
    <a className="inline-block underline" href="#/">Return to the survey home</a>
  </main>;
}
