// Current operational guidance, kept separate from the verbatim historical
// fullDocs.generated.ts source. Only the two reviewed topics are replaced/added.
import { FULL_DOCS as HISTORICAL_DOCS } from "./fullDocs.generated";

export const PAPER_ENTRY_HTML = `<h4>Entering Paper Surveys</h4>
<p>Use the church version of the survey and the active church join code. Do not use the free individual survey: its answers are not added to your church results. The paper edition includes the church questions, both journey self-assessments, spiritual change, demographics, and the optional church-help comment.</p>
<ol>
<li>Check that each required question has an answer. Never guess, invent, or replace an answer. Ask the respondent privately to complete a missing required answer where possible. The written church-help comment is optional.</li>
<li>Check the personal collection code on page 7 if the person wants a printed report. It is five characters: three letters and two digits. Do not enter it online or write the person's name on the form. If it is missing, do not invent one; the survey can still contribute, but a confidential report hand-back cannot be arranged without an agreed collection code.</li>
<li>Open your church's join-code link and confirm the church name. Enter the answers exactly as written, including the opening and closing journey questions and the comparison with two years ago.</li>
<li>If the opening journey answer is 1 or 2, the online survey asks only 38 statements. Match each displayed statement to the paper wording; online numbering differs. Do not change the opening answer to force the longer form, and do not enter the intentionally omitted statements elsewhere.</li>
<li>Enter every church demographic answer, including all selected children-in-household age bands. Copy any written church-help comment exactly; do not add identifying details.</li>
<li>Submit once. Your personal report appears after successful submission. Use “Print / Save as PDF” immediately, before restarting or leaving the page. The personal report is not saved for later retrieval. Do not resubmit to recover a lost report, as that would count the person twice.</li>
<li>Write the collection code on the printed report and on a blank envelope. Fold the report, place it inside, and seal the envelope. Do not use names.</li>
<li>Keep sealed envelopes in a supervised, private collection place. Match the code when the person collects their report; do not leave reports or a list of names on public display. Codes can coincide, so stop and arrange a private hand-back if a duplicate occurs.</li>
<li>Restrict access to paper forms and printouts to authorized volunteers. Explain that the volunteer entering or printing the survey necessarily sees its contents. Store and securely dispose of forms, spoiled prints, and any temporary PDF copies according to the church's confidentiality practice.</li>
<li>Thank you for helping people participate and protecting their information.</li>
</ol>`;

export const MATURITY_GUIDANCE_HTML = `<h4>Understanding the Spiritual Maturity Categories</h4>
<p>The maturity profile is based on the second self-assessment, after the respondent has reflected on the survey statements. It is not calculated from their pathway scores and is not a definitive assessment of spiritual standing.</p>
<p>As the earlier church report explained, the categories come from the statement each person selects to describe their present journey. They help leaders understand the characteristics and needs of people at different self-described stages. The opening self-assessment determines questionnaire length; the closing self-assessment determines the maturity profile, so those two classifications can differ.</p>
<ul>
<li>Distant: Jesus is not presently important to the person's life.</li>
<li>Exploring: the person is exploring if and how Jesus fits into their life.</li>
<li>Believing in Jesus: the person believes Jesus is important and is trying to follow him in some parts of life.</li>
<li>Trusting Jesus: the person is learning to trust Jesus in more of the practical aspects of life.</li>
<li>Jesus Centered: the person describes Jesus as the centre of life and is committed to becoming like him in every part.</li>
</ul>
<p>The four-column tables combine Distant and Exploring as “Exploring Jesus.” Their percentages are calculated from people, not by averaging category percentages. Read demographic rows as percentages within that demographic group, and statement columns as percentages within that maturity group among those with valid answers.</p>
<p>An opening-to-closing difference shows reflection during the survey, not spiritual growth over time. The separate two-years-ago question records perceived change. Neither is a comparison with an earlier church survey. Small groups require particular caution; do not try to identify individuals from a percentage.</p>`;

export const FULL_DOCS = HISTORICAL_DOCS.map((doc, index) => index === 6
  ? { title: "Entering Paper Surveys", html: PAPER_ENTRY_HTML }
  : index === 7 ? { ...doc, html: MATURITY_GUIDANCE_HTML + doc.html } : doc);
