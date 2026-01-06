#!/bin/bash
# Get child runs (tool calls, LLM steps) for a trace
# Usage: ./get-children.sh <trace-id>

if [ -z "$1" ]; then
    echo "Usage: ./get-children.sh <trace-id>"
    exit 1
fi

TRACE_ID="$1"
API_KEY="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"
SESSION_ID="608360fb-43bd-4d77-a5b4-3e42271f3fb7"
ENDPOINT="https://eu.api.smith.langchain.com"

curl -s -X POST "${ENDPOINT}/runs/query" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"session\": [\"${SESSION_ID}\"], \"trace\": \"${TRACE_ID}\", \"limit\": 50}" | python3 -c "
import json, sys
from datetime import datetime

data = json.load(sys.stdin)
runs = data.get('runs', [])

if not runs:
    print('No child runs found.')
    sys.exit(0)

# Sort by start time
runs.sort(key=lambda x: x.get('start_time', ''))

print('=' * 90)
print(f'TRACE BREAKDOWN: {runs[0].get(\"trace_id\", \"unknown\") if runs else \"unknown\"}')
print('=' * 90)
print(f'Found {len(runs)} steps\n')

print(f'{\"#\":<3} {\"Type\":<12} {\"Name\":<30} {\"Duration\":<10} {\"Tokens\":<15} {\"Status\":<8}')
print('-' * 90)

for i, r in enumerate(runs, 1):
    try:
        start = datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
        dur = (end - start).total_seconds()
        dur_str = f'{dur:.2f}s'
    except:
        dur_str = 'N/A'

    run_type = r.get('run_type', 'unknown')
    name = r.get('name', 'unknown')[:28]
    status = r.get('status', 'unknown')

    total_tokens = r.get('total_tokens', 0) or 0
    tokens_str = f'{total_tokens:,}' if total_tokens else '-'

    print(f'{i:<3} {run_type:<12} {name:<30} {dur_str:<10} {tokens_str:<15} {status:<8}')

print('-' * 90)

# Summarize by type
by_type = {}
for r in runs:
    rt = r.get('run_type', 'unknown')
    if rt not in by_type:
        by_type[rt] = {'count': 0, 'tokens': 0, 'duration': 0}
    by_type[rt]['count'] += 1
    by_type[rt]['tokens'] += r.get('total_tokens', 0) or 0
    try:
        start = datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
        by_type[rt]['duration'] += (end - start).total_seconds()
    except:
        pass

print(f'\nBY TYPE:')
for rt, stats in sorted(by_type.items()):
    print(f'  {rt}: {stats[\"count\"]} calls, {stats[\"tokens\"]:,} tokens, {stats[\"duration\"]:.2f}s')
"
