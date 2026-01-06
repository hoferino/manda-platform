#!/bin/bash
# Fetch recent LangSmith traces for manda-platform
# Usage: ./fetch-traces.sh [limit]

LIMIT=${1:-10}
API_KEY="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"
SESSION_ID="608360fb-43bd-4d77-a5b4-3e42271f3fb7"
ENDPOINT="https://eu.api.smith.langchain.com"

curl -s -X POST "${ENDPOINT}/runs/query" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"session\": [\"${SESSION_ID}\"], \"limit\": ${LIMIT}, \"is_root\": true}" | python3 -c "
import json, sys
from datetime import datetime

data = json.load(sys.stdin)
runs = data.get('runs', [])

if not runs:
    print('No traces found.')
    sys.exit(0)

print('=' * 80)
print('LANGSMITH TRACES - manda-platform')
print('=' * 80)
print(f'Found {len(runs)} traces\n')

print(f'{\"#\":<3} {\"Status\":<8} {\"Duration\":<8} {\"TTFT\":<8} {\"In Tokens\":<12} {\"Out Tokens\":<12} {\"Cache %\":<8} {\"Reason\":<8} {\"Cost\":<10}')
print('-' * 80)

for i, r in enumerate(runs, 1):
    try:
        start = datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
        dur = (end - start).total_seconds()
    except:
        dur = 0

    ttft = 0
    if r.get('first_token_time'):
        try:
            ft = datetime.fromisoformat(r['first_token_time'].replace('Z', '+00:00'))
            ttft = (ft - start).total_seconds()
        except:
            pass

    prompt_tokens = r.get('prompt_tokens', 0) or 0
    completion_tokens = r.get('completion_tokens', 0) or 0
    cache_read = r.get('prompt_token_details', {}).get('cache_read', 0) or 0
    cache_pct = 100 * cache_read / max(prompt_tokens, 1)
    reasoning = r.get('completion_token_details', {}).get('reasoning', 0) or 0
    cost = r.get('total_cost', 0) or 0
    status = r.get('status', 'unknown')

    print(f'{i:<3} {status:<8} {dur:>6.1f}s {ttft:>6.1f}s {prompt_tokens:>10,} {completion_tokens:>10,} {cache_pct:>6.0f}% {reasoning:>6,} \${cost:>8.4f}')

print('-' * 80)

# Summary stats
total_cost = sum(r.get('total_cost', 0) or 0 for r in runs)
avg_ttft = sum((datetime.fromisoformat(r['first_token_time'].replace('Z', '+00:00')) - datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))).total_seconds() for r in runs if r.get('first_token_time')) / max(len([r for r in runs if r.get('first_token_time')]), 1)
avg_input = sum(r.get('prompt_tokens', 0) or 0 for r in runs) / len(runs)

print(f'\nSUMMARY:')
print(f'  Total cost: \${total_cost:.4f}')
print(f'  Avg TTFT: {avg_ttft:.1f}s')
print(f'  Avg input tokens: {avg_input:,.0f}')
"
