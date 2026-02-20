#!/usr/bin/env python3
"""
Rule-based sentiment analysis for George (AI investor bot) conversations.
Scores each assistant message on 4 dimensions: aggressiveness, cynicism,
not_understanding, nudging (0-3 scale).
"""

import json
import re
from collections import defaultdict


# ─── Scoring Patterns ────────────────────────────────────────────────────────

AGG_HIGH = [
    r"that'?s not an answer",
    r"i'?ll ask (?:this |it )?one more time",
    r"i mean what i say",
    r"death sentence for a startup",
    r"jack-of-all-trades are often masters of none",
    r"i'?m not asking you to dream",
    r"you'?re being naive",
    r"stop\.",
    r"hold on\.\s+a minute ago",
]

AGG_MED = [
    r"graveyard of (?:gamified|failed|broken|startups)?",
    r"littered with (?:the )?bones",
    r"crash(?:ed|ing)? on the rocks",
    r"a hope,?\s+not a strategy",
    r"that'?s a price,?\s+not a business model",
    r"side hustle can'?t compete",
    r"eyes? narrowed",
    r"death spiral",
    r"you'?re outsourcing your most critical",
    r"a transactional relationship,?\s+not a partnership",
    r"not a (?:business|revenue) model",
    r"that'?s not a (?:business|revenue) model",
    r"makes? a (?:small,? sharp|sharp,? small) (?:gesture|motion|sound)",
    r"leans? forward.*tone sharp",
    r"his gaze is sharp",
    r"does not soften",
    r"firm line through",
    r"his expression (?:doesn'?t change|remains? neutral|hardens?)",
]

AGG_LOW = [
    r"(?:too|that'?s (?:still )?too) (?:broad|vague|narrow|generic|ambitious) a",
    r"many a startup has crashed",
    r"it'?s a (?:long|tough) road",
    r"that'?s not (?:enough|quite|what)",
    r"but execution is everything",
    r"you'?re counting on",
    r"relies? on.*to do (?:the )?heavy lifting",
]


CYN_HIGH = [
    r"graveyard of",
    r"bones of startups",
    r"littered with.*bones",
    r"the ocean doesn",
    r"crowded stadium",
    r"sleeping giants",
    r"not the first.*(?:i'?ve |we'?ve )?seen",
    r"a hope,?\s+not a strategy",
    r"leftover time, not primetime",
]

CYN_MED = [
    r"many have tried",
    r"magic word (?:in|for|of|over)",
    r"been the magic word",
    r"classic (?:startup|strategy|play|move|trap)",
    r"an admirable goal",
    r"admirable.*but (?:it'?s|that'?s)",
    r"app store is a graveyard",
    r"it'?s a (?:big|bold) bet",
    r"a long way from the",
    r"good first (?:down|step),? but it'?s a long",
    r"one person'?s (?:praise|support|enthusiasm) doesn",
    r"assumes? (?:you|your|the user|the market)",
    r"relies? (?:solely|entirely|only|heavily) on",
    r"counting on (?:social|luck|market|hope|goodwill|intrinsic)",
    r"small canteen on a long desert march",
    r"impressive on paper",
    r"a crowded (?:field|market|space|sector|ocean)",
    r"death spiral",
    r"sounds more like",
    r"hoping (?:for|that|to)",
    r"if (?:the wind changes|they fail|growth slows|engagement drops)",
    r"vulnerable to a",
    r"a thin shield against",
    r"a lot of players",
    r"the big players are",
    r"outspend and out-market you overnight",
    r"wait and see what works",
    r"can afford to wait",
    r"the (?:corporate|startup) world is littered",
    r"'?why haven'?t they'? is not a strategy",
    r"no-man'?s-?land",
    r"runaway agents",
    r"always a (?:race|game|battle)",
    r"a big bet on intrinsic motivation",
    r"many.*crashed on the rocks",
    r"that'?s a (?:big|bold|risky) (?:bet|assumption|claim)",
    r"a wide net",
    r"fishing in the ocean",
]

CYN_LOW = [
    r"bold(?:er)? (?:claim|goal|target|move|bet|assertion)",
    r"ambitious (?:goal|claim|target|play)",
    r"if (?:you|that|they) (?:can|could|do|achieve|execute)",
    r"requires? executing.*flawlessly",
    r"variability",
    r"introduces? (?:a|some) (?:risk|complexity|variability|uncertainty)",
]


NU_HIGH = [
    r"i'?m sorry,?\s+i don'?t understand",
    r"i don'?t understand what .* means",
    r"what (?:exactly )?do you mean by ['\"]",
    r"i'?m (?:confused|lost|unclear) (?:about|by|as to)",
]

NU_MED = [
    r"that'?s a growth strategy,?\s+not a business model",
    r"that describes? the (?:timeline|process|trajectory|plan),?\s+but (?:it )?doesn'?t tell me",
    r"you (?:still )?haven'?t (?:answered|told me|addressed|said)",
    r"of course\.\s+i'?m not (?:talking|asking) about",
    r"i'?m asking about (?:your|the|how|what|who)",
    r"hold on\.\s+(?:a minute ago|you said|earlier)",
    r"that'?s not what i (?:was |asked|asked about|meant)",
    r"you haven'?t (?:actually )?answered",
]

NU_LOW = [
    r"(?:so essentially|so in other words|so basically),? you'?re saying",
    r"i think what you'?re (?:saying|suggesting) is",
]


NUD_HIGH = [
    r"let'?s (?:pivot|shift gears|switch gears)",
    r"let'?s (?:move on|get back|circle back|come back) to",
    r"i need you to (?:focus|be specific|answer|tell)",
    r"let me (?:redirect|steer|be very direct|ask you specifically)",
    r"let'?s fast-forward",
    r"what i'?m (?:really )?asking (?:is|you for|for)",
    r"let'?s (?:dig into|focus on|get to|talk about) (?:the|your|that|how|what|who)",
    r"this (?:brings?|leads?) (?:me|us) to",
    r"brings? (?:me|us) (?:to|back to) (?:the|my|a)",
]

NUD_MED = [
    r"so,? (?:tell me|give me|walk me through|explain|describe)",
    r"now,? (?:tell me|let'?s talk|what|how|who|when)",
    r"let me ask (?:you|this|that|a|one)",
    r"let'?s (?:move|turn|get) (?:to|into|on to|back to)",
    r"and now.*let'?s",
    r"i'?d like (?:to|you to) (?:know|focus|move|tell|address)",
    r"before (?:we|that|i|you) (?:move|get|go|do|discuss)",
    r"so (?:the|your) (?:strategy|model|play|approach|defense|advantage) (?:is|comes down to|hinges on)",
    r"let'?s (?:address|cover|get to|talk|discuss) (?:the|that|this|your|how)",
    r"(?:which|that) (?:leads?|brings?) (?:me|us) to",
    r"let'?s (?:not )?(?:talk|focus|concentrate|look) (?:on|at|about)",
]

NUD_LOW = [
    r"so you'?re (?:saying|suggesting|arguing|betting|telling me|essentially saying)",
    r"so the (?:long-term|short-term|key|real|core|main) (?:play|model|bet|question|issue|risk)",
]


def score_text(text: str) -> dict:
    t = text.lower()

    # --- Aggressiveness ---
    agg, agg_reason = 0, "Neutral or constructive tone without notable aggression."
    for p in AGG_HIGH:
        if re.search(p, t):
            agg = 3
            agg_reason = "Strong confrontational phrasing detected (e.g., direct rejection or harsh framing)."
            break
    if agg < 3:
        for p in AGG_MED:
            if re.search(p, t):
                agg = 2
                agg_reason = "Moderately aggressive tone: sharp correction, dismissive metaphor, or pointed body language described."
                break
    if agg < 2:
        for p in AGG_LOW:
            if re.search(p, t):
                agg = 1
                agg_reason = "Mild challenge or pointed critique present."
                break

    # --- Cynicism ---
    cyn, cyn_reason = 0, "No notable cynicism; response is neutral or constructive."
    for p in CYN_HIGH:
        if re.search(p, t):
            cyn = 3
            cyn_reason = "Strongly cynical framing: morbid/dismissive metaphors or explicit skepticism about the idea/market."
            break
    if cyn < 3:
        for p in CYN_MED:
            if re.search(p, t):
                cyn = 2
                cyn_reason = "Moderate cynicism: historical failure references, faint praise, or skepticism of assumptions."
                break
    if cyn < 2:
        for p in CYN_LOW:
            if re.search(p, t):
                cyn = 1
                cyn_reason = "Mild skepticism implied through framing of the response."
                break

    # --- Not Understanding ---
    nu, nu_reason = 0, "George engages accurately with the entrepreneur's response."
    for p in NU_HIGH:
        if re.search(p, t):
            nu = 3
            nu_reason = "Explicit non-understanding or confusion stated."
            break
    if nu < 3:
        for p in NU_MED:
            if re.search(p, t):
                nu = 2
                nu_reason = "Apparent misread: reframes response incorrectly or asks something already answered."
                break
    if nu < 2:
        for p in NU_LOW:
            if re.search(p, t):
                nu = 1
                nu_reason = "Minor paraphrase that may slightly misrepresent the entrepreneur's intent."
                break

    # --- Nudging ---
    nud, nud_reason = 0, "No significant conversational steering."
    for p in NUD_HIGH:
        if re.search(p, t):
            nud = 3
            nud_reason = "Strong explicit topic pivot or controlling redirect (e.g. 'let's pivot', 'let's shift gears', 'this brings me to')."
            break
    if nud < 3:
        for p in NUD_MED:
            if re.search(p, t):
                nud = 2
                nud_reason = "Moderate steering: guided transition to next topic with directive framing."
                break
    if nud < 3:
        for p in NUD_LOW:
            if re.search(p, t):
                nud = 1
                nud_reason = "Mild steering via leading paraphrase or directed follow-up."
                break
    # Most George messages end with a question — bump nudging to at least 1
    if nud == 0 and "?" in text[-400:]:
        nud = 1
        nud_reason = "Directed follow-up question steers the conversation toward a new topic."

    return {
        "aggressiveness": {"score": agg, "reason": agg_reason},
        "cynicism": {"score": cyn, "reason": cyn_reason},
        "not_understanding": {"score": nu, "reason": nu_reason},
        "nudging": {"score": nud, "reason": nud_reason},
    }


# ─── Report Generation ────────────────────────────────────────────────────────

def generate_report(results: list, convs: dict):
    DIMENSIONS = ["aggressiveness", "cynicism", "not_understanding", "nudging"]

    conv_results: dict = defaultdict(list)
    for r in results:
        if r["sentiment"]:
            conv_results[r["run_id"]].append(r)

    report_lines = [
        "# Sentiment Analysis Report: George (AI Investor Bot)",
        "## Sentiment Dimensions Analyzed",
        "- **Aggressiveness**: dismissive, confrontational, harsh tone (0-3)",
        "- **Cynicism**: sarcastic, doubtful, skeptical tone (0-3)",
        "- **Not Understanding**: misreading intent, off-topic replies (0-3)",
        "- **Nudging**: steering, pressuring, leading the conversation (0-3)",
        "",
        "---",
        "",
        "## Per-Conversation Summary",
        "",
    ]

    overall_scores = defaultdict(list)
    conv_summaries = []

    for run_id, msgs in sorted(conv_results.items(), key=lambda x: x[0]):
        if not msgs:
            continue

        user_name = msgs[0]["user_name"]
        num_msgs = len(msgs)

        dim_scores = {}
        for dim in DIMENSIONS:
            scores = [m["sentiment"][dim]["score"] for m in msgs
                      if m["sentiment"] and dim in m["sentiment"]]
            dim_scores[dim] = round(sum(scores) / len(scores), 2) if scores else 0.0
            overall_scores[dim].extend(scores)

        conv_summaries.append({
            "run_id": run_id,
            "user_name": user_name,
            "num_messages": num_msgs,
            "avg_scores": dim_scores,
        })

        notable = []
        for m in msgs:
            if m["sentiment"]:
                max_dim = max(DIMENSIONS, key=lambda d: m["sentiment"].get(d, {}).get("score", 0))
                max_score = m["sentiment"][max_dim]["score"]
                if max_score >= 2:
                    notable.append((m, max_dim, max_score))

        report_lines.append(f"### Conversation: {user_name} (`{run_id[:8]}...`)")
        report_lines.append(f"- Messages analyzed: {num_msgs}")
        report_lines.append(f"- Average scores:")
        for dim in DIMENSIONS:
            report_lines.append(f"  - {dim.replace('_', ' ').title()}: **{dim_scores[dim]:.2f}**")

        if notable:
            report_lines.append(f"- Notable moments (score ≥ 2):")
            for m, dim, score in notable[:3]:
                reason = m["sentiment"][dim].get("reason", "")
                report_lines.append(
                    f"  - Msg #{m['msg_index']} [{dim.replace('_', ' ')} = {score}]: {reason}"
                )
        report_lines.append("")

    report_lines.extend([
        "---",
        "",
        "## Overall Statistics",
        "",
        f"- **Total conversations analyzed**: {len(conv_results)}",
        f"- **Total George messages analyzed**: {sum(len(v) for v in conv_results.values())}",
        "",
        "### Average Scores Across All Conversations",
        "",
    ])

    for dim in DIMENSIONS:
        all_scores = overall_scores[dim]
        if all_scores:
            avg = sum(all_scores) / len(all_scores)
            max_s = max(all_scores)
            pct_nonzero = round(100 * sum(1 for s in all_scores if s > 0) / len(all_scores), 1)
            report_lines.append(
                f"- **{dim.replace('_', ' ').title()}**: avg={avg:.2f}, max={max_s}, "
                f"present in {pct_nonzero}% of messages"
            )

    report_lines.extend([
        "",
        "### Ranking: Conversations by Highest Sentiment Intensity",
        "",
        "| User | Aggr. | Cyn. | Not-Und. | Nudge | Total |",
        "|------|-------|------|----------|-------|-------|",
    ])

    for s in sorted(conv_summaries, key=lambda x: sum(x["avg_scores"].values()), reverse=True):
        total = sum(s["avg_scores"].values())
        report_lines.append(
            f"| {s['user_name']} "
            f"| {s['avg_scores']['aggressiveness']:.2f} "
            f"| {s['avg_scores']['cynicism']:.2f} "
            f"| {s['avg_scores']['not_understanding']:.2f} "
            f"| {s['avg_scores']['nudging']:.2f} "
            f"| {total:.2f} |"
        )

    report_text = "\n".join(report_lines)
    with open("/home/user/Try1/sentiment_report.md", "w") as f:
        f.write(report_text)

    summary = {
        "overall": {
            dim: {
                "avg": round(sum(overall_scores[dim]) / len(overall_scores[dim]), 3) if overall_scores[dim] else 0,
                "max": max(overall_scores[dim]) if overall_scores[dim] else 0,
                "pct_nonzero": round(100 * sum(1 for s in overall_scores[dim] if s > 0) / len(overall_scores[dim]), 1) if overall_scores[dim] else 0,
            }
            for dim in DIMENSIONS
        },
        "conversations": conv_summaries,
    }
    with open("/home/user/Try1/sentiment_summary.json", "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n=== Report Generation Complete ===")
    print("  sentiment_report.md    — Markdown report")
    print("  sentiment_summary.json — Structured summary")
    print("  sentiment_results.json — Per-message raw results")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Load parsed conversations
    with open("/home/user/Try1/conversations_parsed.json") as f:
        records = json.load(f)

    # Group by conversation
    convs: dict = defaultdict(list)
    for r in records:
        convs[r["run_id"]].append(r)
    for rid in convs:
        convs[rid].sort(key=lambda x: x["msg_index"])

    # Filter to assistant (George) messages
    assistant_msgs = [r for r in records if r["role"] == "assistant"]
    print(f"Analyzing {len(assistant_msgs)} George messages across {len(convs)} conversations...")

    results = []
    for i, msg in enumerate(sorted(assistant_msgs, key=lambda x: (x["run_id"], x["msg_index"]))):
        sentiment = score_text(msg["content"])
        result = {
            "run_id": msg["run_id"],
            "user_name": msg["user_name"],
            "msg_index": msg["msg_index"],
            "timestamp": msg["timestamp"],
            "content": msg["content"],
            "sentiment": sentiment,
        }
        results.append(result)
        if (i + 1) % 50 == 0:
            print(f"  Processed {i+1}/{len(assistant_msgs)}...")

    # Save raw results
    with open("/home/user/Try1/sentiment_results.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} scored messages to sentiment_results.json")

    # Generate report
    generate_report(results, convs)


if __name__ == "__main__":
    main()
