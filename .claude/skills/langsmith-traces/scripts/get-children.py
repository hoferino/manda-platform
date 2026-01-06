#!/usr/bin/env python3
"""Fetch and display child runs for a LangSmith trace."""

import json
import urllib.request
import ssl
import sys
from datetime import datetime

API_KEY = "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"
ENDPOINT = "https://eu.api.smith.langchain.com"

# Create SSL context that doesn't verify certificates (for macOS issues)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_run(run_id):
    """Fetch a single run by ID."""
    req = urllib.request.Request(
        f"{ENDPOINT}/runs/{run_id}",
        headers={"x-api-key": API_KEY}
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read())

def get_duration(r):
    """Calculate duration from start/end times."""
    try:
        start = datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
        return (end - start).total_seconds()
    except:
        return 0

def main():
    trace_id = sys.argv[1] if len(sys.argv) > 1 else "0bcaeb6f-605a-40f3-8bd5-fd6fd728ce00"

    print(f"=== TRACE BREAKDOWN ===")
    print(f"Trace ID: {trace_id}\n")

    # Fetch parent trace
    trace = fetch_run(trace_id)
    child_ids = trace.get('child_run_ids', [])

    print(f"Found {len(child_ids)} child runs\n")

    # Stats
    total_llm_time = 0
    total_tool_time = 0
    total_input_tokens = 0
    total_output_tokens = 0

    print(f"{'Type':<10} {'Name':<35} {'Duration':>10} {'In Tokens':>12} {'Out Tokens':>12}")
    print("-" * 85)

    for cid in child_ids:
        try:
            r = fetch_run(cid)
            name = r.get('name', 'unknown')[:35]
            run_type = r.get('run_type', 'unknown')
            dur = get_duration(r)
            prompt = r.get('prompt_tokens', 0) or 0
            completion = r.get('completion_tokens', 0) or 0
            reasoning = r.get('completion_token_details', {}).get('reasoning', 0) or 0
            model = r.get('extra', {}).get('metadata', {}).get('ls_model_name', '')

            # Track stats
            if run_type == 'llm':
                total_llm_time += dur
            elif run_type == 'tool':
                total_tool_time += dur
            total_input_tokens += prompt
            total_output_tokens += completion

            # Icon
            icon = '🤖' if run_type == 'llm' else ('🔧' if run_type == 'tool' else '⛓️')

            # Format tokens
            tok_str = f"{prompt:>10,}" if prompt else f"{'':>10}"
            out_str = f"{completion:>10,}" if completion else f"{'':>10}"

            print(f"{icon} {run_type:<8} {name:<35} {dur:>8.1f}s {tok_str} {out_str}")

            if model:
                print(f"           └─ model: {model}")
            if reasoning:
                print(f"           └─ reasoning tokens: {reasoning:,}")

            # Check for grandchildren (tool calls, etc)
            grandchild_ids = r.get('child_run_ids', [])
            for gcid in grandchild_ids[:5]:  # Limit to 5 per child
                try:
                    gc = fetch_run(gcid)
                    gc_name = gc.get('name', 'unknown')[:30]
                    gc_type = gc.get('run_type', 'unknown')
                    gc_dur = get_duration(gc)
                    gc_prompt = gc.get('prompt_tokens', 0) or 0
                    gc_completion = gc.get('completion_tokens', 0) or 0
                    gc_model = gc.get('extra', {}).get('metadata', {}).get('ls_model_name', '')

                    gc_icon = '🤖' if gc_type == 'llm' else ('🔧' if gc_type == 'tool' else '📎')

                    print(f"   {gc_icon} {gc_type:<6} {gc_name:<32} {gc_dur:>6.1f}s | in:{gc_prompt:,} out:{gc_completion:,}")
                    if gc_model:
                        print(f"             └─ {gc_model}")

                    # Track stats from grandchildren too
                    if gc_type == 'llm':
                        total_llm_time += gc_dur
                    total_input_tokens += gc_prompt
                    total_output_tokens += gc_completion
                except Exception as e:
                    print(f"   [error fetching grandchild: {e}]")

        except Exception as e:
            print(f"[error fetching {cid}: {e}]")

    print("-" * 85)
    print(f"\n=== SUMMARY ===")
    print(f"  LLM time: {total_llm_time:.1f}s")
    print(f"  Tool time: {total_tool_time:.1f}s")
    print(f"  Total input tokens: {total_input_tokens:,}")
    print(f"  Total output tokens: {total_output_tokens:,}")

if __name__ == "__main__":
    main()
