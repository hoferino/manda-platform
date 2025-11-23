# 🚀 START HERE - Manda-Standalone POC

**You're ready to test the enhanced CIM Creator!**

---

## What You Have

✅ **2 Slash Commands:**
- `/manda-analyze` - Extract findings from documents
- `/manda-cim-company-overview-v2` - Create Company Overview chapter (enhanced with buyer profiling + slide blueprints)

✅ **Sample Data:**
- TechCorp company profile in `data/test-company/docs/company-overview.txt`

✅ **40 Test Simulations:**
- v2 Results in `TEST-SIMULATION-RESULTS.md`
- v3 Results in `TEST-SIMULATION-RESULTS-V3.md` (with M&A storytelling best practices)
- Key learnings applied to v2 → v3

---

## Quick Test (5 minutes)

### Step 1: Analyze Documents
```
/manda-analyze
```

**What happens:**
- Reads `data/test-company/docs/company-overview.txt`
- Extracts ~40-50 structured findings
- Saves to `data/test-company/knowledge.json`

**Check:** Open `knowledge.json` - are findings accurate?

---

### Step 2: Create CIM Chapter
```
/manda-cim-company-overview-v2
```

**What happens (v3 Enhanced):**
- **STEP 0:** Buyer profiling questions
  - Buyer type: Strategic / Financial / Competitor / etc.
  - Motivation: Growth / Synergies / Financial return / etc.
  - Concerns: Integration risk / Key person / etc.
  - Story hero: Founders / Tech / Market / Customers / etc.
  - Detail level

- **STEP 1:** Data sufficiency check (85/100 score)
- **STEP 2:** Investment thesis + narrative approach + growth drivers (NEW!)
- **STEPS 3-8:** Build sections with slide blueprints (slides emerge organically)
- **STEP 9:** Coherence review + risk assessment (ENHANCED!)
- **STEP 10:** Review & optimize slide deck (combine/split/reorder as needed)
- **STEP 11:** Export 3 files

**Check:** Review outputs in `data/test-company/outputs/`

---

## Full Test (20 minutes)

### Scenario 1: Happy Path - Strategic Buyer
```
/manda-cim-company-overview-v2
```

**Answer Step 0:**
- Buyer: a) Strategic Acquirer
- Motivation: Growth/market expansion
- Concerns: Integration risk
- Hero: The founders
- Visual: Balanced

**Follow prompts through Steps 1-11**

**Result:** Should get 8-10 slide blueprints with visual concepts

---

### Scenario 2: Test Corrections
```
/manda-cim-company-overview-v2
```

**During Step 4 (Company History):**
- Agent: "Jane Smith worked at Google for 15 years..."
- You: "Actually, it was 14 years, 2000-2014"
- Agent: Should update and regenerate

**Check:** Does it handle corrections gracefully?

---

### Scenario 3: Test Pivot
```
/manda-cim-company-overview-v2
```

**At Step 2:**
- Choose "Chronological Story"

**At Step 5:**
- You: "Actually, let's pivot to Vision-Driven narrative"
- Agent: Should explain implications and offer options

**Check:** Does it support mid-flow pivots?

---

### Scenario 4: Test Special Commands

**During any step, try:**
```
undo                      ← Revert last change
restart 3                 ← Go back to Step 3
history                   ← Show all decisions
save version "draft-1"    ← Save current state
explain strategic buyer   ← Get education
questions for seller      ← Auto-generate gaps
data score                ← Re-calculate sufficiency
```

**Check:** Do commands work as expected?

---

## What to Look For

### ✅ Quality Checks

**Knowledge Extraction:**
- [ ] Findings are specific (not generic)
- [ ] Source attribution is accurate
- [ ] All 5 categories covered
- [ ] Confidence scores make sense

**Conversation Quality:**
- [ ] Questions are contextual (not "what would you like?")
- [ ] Suggestions have reasoning
- [ ] Agent explains "why" behind recommendations
- [ ] Tone is helpful, not robotic

**Storytelling:**
- [ ] Narrative has clear arc
- [ ] Buyer framing is consistent
- [ ] Hero is emphasized throughout
- [ ] Proof points are specific

**Slide Blueprints:**
- [ ] Clear purpose for each slide
- [ ] Visual concepts described
- [ ] Action-driven titles (not generic)
- [ ] Layout/color guidance provided
- [ ] Chart types recommended

**Flexibility:**
- [ ] Accepts corrections gracefully
- [ ] Supports pivots mid-flow
- [ ] Undo/restart works
- [ ] Multiple iterations tolerated

---

## Expected Outputs

After `/manda-analyze`:
```
data/test-company/knowledge.json
```

After `/manda-cim-company-overview-v2`:
```
data/test-company/outputs/
├── company-overview-content.md    (narrative text)
├── company-overview-slides.md     (slide blueprints)
└── company-overview-guide.md      (implementation tips)
```

---

## Key Features to Test

### 1. Buyer Profiling (Step 0)
**Test:** Try different buyer types
- Strategic buyer → Should emphasize vision, synergies
- Financial buyer → Should emphasize metrics, EBITDA
- Competitor → Should emphasize market threat

### 2. Investment Thesis (Step 2 - v3 NEW!)
**Test:** Check investment thesis quality
- Does it answer: "Why acquire this company NOW?"
- 3-sentence structure: Asset + Timing + Upside
- Buyer-specific framing
- Can you refine it? Agent should iterate

### 3. Slide Optimization (Step 10 - v3 ENHANCED!)
**Test:** Organic slide count emerges from content
- Slides built naturally through Steps 4-8 (one per section)
- Step 10 reviews complete deck and asks: too dense? too light? combine? split?
- Can you iterate to optimize (combine slides, split dense ones, reorder)?

### 4. Growth Drivers (Step 2 - v3 NEW!)
**Test:** Check growth driver articulation
- Does agent ask for specific details (TAM, timeline, GTM)?
- Are growth drivers woven throughout narrative?
- Geographic expansion? New products? Customer segments?
- Is upside concrete (not vague)?

### 5. Risk Transparency (Step 9 - v3 ENHANCED!)
**Test:** Check risk assessment
- Does agent identify key risks proactively?
- Key person dependency? Customer concentration?
- Are mitigation strategies suggested?
- Option to add explicit risk section?

### 6. Slide Blueprints with Visuals
**Test:** Check blueprint quality
- Does each slide have purpose?
- Are visual concepts specific?
- Is chart type recommended?
- Is layout described?

### 7. Storytelling Arc
**Test:** Does narrative flow?
- Setup → Conflict → Rising Action → Climax → Resolution
- Is "hero" emphasized?
- Are proof points specific?

### 8. Pivot Support
**Test:** Change mind mid-flow
- Start with one narrative approach
- Switch to another at Step 5
- Should offer options (restart, continue, adjust)

---

## Common Issues & Solutions

**Issue:** Knowledge base not found
**Solution:** Run `/manda-analyze` first

**Issue:** Agent assumes buyer type
**Solution:** v2 asks in Step 0 (use v2 command)

**Issue:** Generic slide titles
**Solution:** v2 generates action-driven titles

**Issue:** Can't go back
**Solution:** Type `restart [step number]`

**Issue:** Too many iterations
**Solution:** Type `save version` and move on

---

## Success Criteria

POC is successful if:

1. **Extraction Works**
   - [ ] 90%+ accuracy on findings
   - [ ] Proper source attribution
   - [ ] All categories covered

2. **Conversation Flows**
   - [ ] Natural interaction
   - [ ] Smart questions asked
   - [ ] Reasoning provided

3. **Output Quality**
   - [ ] Investment banking standards
   - [ ] Specific (not generic)
   - [ ] Professional tone

4. **Storytelling Works**
   - [ ] Clear narrative arc
   - [ ] Buyer framing consistent
   - [ ] Emotional resonance

5. **Slide Blueprints**
   - [ ] Purpose clear
   - [ ] Visual concepts described
   - [ ] Actionable guidance

6. **Flexibility**
   - [ ] Handles corrections
   - [ ] Supports pivots
   - [ ] Undo/restart works

**Final Check:**
- [ ] Could this replace manual CIM creation?
- [ ] Would you use this for a real deal?

---

## Next Steps After Testing

**If it works:**
1. Test with real M&A documents
2. Add remaining CIM chapters
3. Integrate with full Manda platform

**If it needs work:**
1. Note specific issues in `TEST-FEEDBACK.md`
2. Iterate on prompts
3. Re-test

---

## Files to Review

**Before Testing:**
- [ ] This file (START-HERE.md)
- [ ] QUICKSTART.md
- [ ] IMPLEMENTATION-V2-COMPLETE.md
- [ ] TEST-SIMULATION-RESULTS-V3.md (latest 20 tests with v3 enhancements)

**After Testing:**
- [ ] knowledge.json (extraction quality)
- [ ] company-overview-content.md (narrative)
- [ ] company-overview-slides.md (blueprints)
- [ ] TEST-SIMULATION-RESULTS.md (v2 learnings)
- [ ] TEST-SIMULATION-RESULTS-V3.md (v3 learnings with M&A best practices)

---

## Commands Reference

```bash
# Main workflows
/manda-analyze                      # Extract findings
/manda-cim-company-overview-v2      # Create CIM (enhanced)

# Special commands (during workflow)
undo                                # Revert last change
restart [step]                      # Jump to step
history                             # Show decisions
save version [name]                 # Save state
compare versions                    # See differences
explain [topic]                     # Deep dive
questions for seller                # Auto-generate
data score                          # Re-calculate
```

---

## 🎯 Your Mission

1. Run `/manda-analyze`
2. Run `/manda-cim-company-overview-v2`
3. Complete full workflow
4. Review outputs
5. Provide feedback

**Answer:**
- Does this approach work for CIM creation?
- What's missing?
- What needs improvement?
- Would you use this for a real deal?

---

**Ready? Start with `/manda-analyze`** 🚀
