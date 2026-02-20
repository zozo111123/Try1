#!/usr/bin/env python3
"""
Sentiment Analysis of AI-bot (George) Conversations
Analyzes investor (George) responses for: aggressiveness, cynicism, not understanding, nudging
"""

import json
import os
import re
import time
from collections import defaultdict
import anthropic

# ─── Parse raw conversation data ─────────────────────────────────────────────

def parse_conversations(raw_path: str) -> list[dict]:
    """Parse the raw conversation data into structured records."""
    with open(raw_path, "r") as f:
        content = f.read()

    content = content.replace("Run ID User Name Message Role Content Timestamp Message Index ", "")
    uuid_pattern = r"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"
    parts = re.split(uuid_pattern, content)

    records = []
    for i in range(1, len(parts) - 1, 2):
        run_id = parts[i]
        text = parts[i + 1].strip()

        role_match = re.search(r"\b(user|assistant)\b", text)
        if not role_match:
            continue

        role_pos = role_match.start()
        user_name = text[:role_pos].strip()
        role = role_match.group(1)
        after_role = text[role_pos + len(role):].strip()

        ts_match = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (\d+)\s*$", after_role)
        if not ts_match:
            continue

        content_text = after_role[: ts_match.start()].strip()
        timestamp = ts_match.group(1)
        msg_index = int(ts_match.group(2))

        records.append({
            "run_id": run_id,
            "user_name": user_name,
            "role": role,
            "content": content_text,
            "timestamp": timestamp,
            "msg_index": msg_index,
        })

    return records


# ─── Sentiment Analysis via Claude API ───────────────────────────────────────

SYSTEM_PROMPT = """You are an expert in conversational sentiment analysis and investor-entrepreneur dynamics.
You analyze messages from an AI-bot playing the role of "George," a senior investor at EAGEL, in simulated pitch conversations with student entrepreneurs.

Your task: analyze each investor message for four specific sentiment dimensions:
1. **Aggressiveness**: dismissive, confrontational, harsh, intimidating, cutting off, belittling tone
2. **Cynicism**: sarcastic, doubtful, skeptical about the idea/entrepreneur, mocking, pessimistic
3. **Not Understanding**: misreading the entrepreneur's intent, going off-topic, missing the point, confused responses
4. **Nudging**: subtly steering, pressuring, leading, guiding the entrepreneur in a particular direction, asking leading questions

For each dimension, score 0–3:
- 0 = Not present
- 1 = Mild / slightly present
- 2 = Moderate / clearly present
- 3 = Strong / very prominent

Also provide a brief (1-2 sentence) justification for each score.

Respond ONLY with valid JSON in this exact format:
{
  "aggressiveness": {"score": 0-3, "reason": "..."},
  "cynicism": {"score": 0-3, "reason": "..."},
  "not_understanding": {"score": 0-3, "reason": "..."},
  "nudging": {"score": 0-3, "reason": "..."}
}"""


def analyze_message(client: anthropic.Anthropic, message: dict, context: str) -> dict | None:
    """Analyze a single assistant message for sentiment."""
    prompt = f"""Conversation context (preceding messages):
{context}

---
Investor's message to analyze:
{message['content']}

Analyze the investor's message above for the four sentiment dimensions."""

    try:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text (skip thinking blocks)
        text = ""
        for block in response.content:
            if block.type == "text":
                text = block.text
                break

        # Parse JSON
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            print(f"  Warning: Could not extract JSON from: {text[:200]}")
            return None

    except (json.JSONDecodeError, anthropic.APIError) as e:
        print(f"  Error analyzing message: {e}")
        return None


def build_context(conversation_msgs: list[dict], current_idx: int, max_context: int = 4) -> str:
    """Build conversation context (preceding messages) for the current message."""
    preceding = [m for m in conversation_msgs if m["msg_index"] < current_idx]
    preceding = preceding[-max_context:]  # last N messages

    lines = []
    for m in preceding:
        role_label = "Entrepreneur" if m["role"] == "user" else "George (investor)"
        lines.append(f"[{role_label}]: {m['content'][:400]}")

    return "\n\n".join(lines) if lines else "(start of conversation)"


# ─── Main Analysis ────────────────────────────────────────────────────────────

def main():
    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")

    client = anthropic.Anthropic(api_key=api_key)

    # Parse data
    print("Parsing conversation data...")
    records = parse_conversations("/home/user/Try1/conversations_raw.txt")
    print(f"  Parsed {len(records)} messages from {len(set(r['run_id'] for r in records))} conversations")

    # Group by conversation
    convs: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        convs[r["run_id"]].append(r)
    # Sort each conversation by message index
    for run_id in convs:
        convs[run_id].sort(key=lambda x: x["msg_index"])

    # Extract assistant messages
    assistant_msgs = [r for r in records if r["role"] == "assistant"]
    print(f"  Found {len(assistant_msgs)} George (assistant) messages to analyze")
    print()

    # Analyze each assistant message
    results = []
    total = len(assistant_msgs)

    for i, msg in enumerate(assistant_msgs):
        run_id = msg["run_id"]
        conv_msgs = convs[run_id]
        context = build_context(conv_msgs, msg["msg_index"])

        print(f"[{i+1}/{total}] Analyzing: RunID {run_id[:8]}..., MsgIdx {msg['msg_index']}, User: {msg['user_name']}")

        sentiment = analyze_message(client, msg, context)

        result = {
            "run_id": run_id,
            "user_name": msg["user_name"],
            "msg_index": msg["msg_index"],
            "timestamp": msg["timestamp"],
            "content": msg["content"],
            "sentiment": sentiment,
        }
        results.append(result)

        # Rate limiting: small delay between calls
        if (i + 1) % 10 == 0:
            print(f"  Progress: {i+1}/{total} messages analyzed...")
            time.sleep(1)
        else:
            time.sleep(0.3)

    # Save raw results
    with open("/home/user/Try1/sentiment_results.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved raw results to sentiment_results.json")

    # Generate report
    generate_report(results, convs)


def generate_report(results: list[dict], convs: dict):
    """Generate per-conversation and overall sentiment report."""

    DIMENSIONS = ["aggressiveness", "cynicism", "not_understanding", "nudging"]

    # Group results by conversation
    conv_results: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        if r["sentiment"]:
            conv_results[r["run_id"]].append(r)

    # Build report
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

        # Average scores per dimension
        dim_scores = {}
        for dim in DIMENSIONS:
            scores = [m["sentiment"][dim]["score"] for m in msgs if m["sentiment"] and dim in m["sentiment"]]
            dim_scores[dim] = round(sum(scores) / len(scores), 2) if scores else 0.0
            overall_scores[dim].extend(scores)

        conv_summaries.append({
            "run_id": run_id,
            "user_name": user_name,
            "num_messages": num_msgs,
            "avg_scores": dim_scores,
        })

        # Find most notable messages (any dimension score >= 2)
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
            for m, dim, score in notable[:3]:  # show top 3
                reason = m["sentiment"][dim].get("reason", "")
                report_lines.append(
                    f"  - Msg #{m['msg_index']} [{dim.replace('_', ' ')} = {score}]: {reason}"
                )
        report_lines.append("")

    # Overall summary
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
            max_score = max(all_scores)
            pct_nonzero = round(100 * sum(1 for s in all_scores if s > 0) / len(all_scores), 1)
            report_lines.append(
                f"- **{dim.replace('_', ' ').title()}**: avg={avg:.2f}, max={max_score}, "
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

    # Write report
    report_text = "\n".join(report_lines)
    with open("/home/user/Try1/sentiment_report.md", "w") as f:
        f.write(report_text)

    # Save structured summary JSON
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
    print(f"  sentiment_report.md  — Markdown report")
    print(f"  sentiment_summary.json — Structured summary")
    print(f"  sentiment_results.json — Per-message raw results")


if __name__ == "__main__":
    main()
