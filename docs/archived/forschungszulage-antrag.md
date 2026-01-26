# Antrag auf Bescheinigung eines F&E-Vorhabens
# Forschungszulage gemäß § 2 FZulG

**Antragsteller:** [GmbH in Gründung]
**Projektbezeichnung:** MANDA - Intelligente M&A-Plattform mit graphbasierter Wissensarchitektur
**Projektzeitraum:** 2025-2027 (36 Monate)
**Antragsdatum:** [Datum]
**Version:** 1.0

---

## Inhaltsverzeichnis

1. [Zusammenfassung des F&E-Vorhabens](#1-zusammenfassung-des-fue-vorhabens)
2. [Technische Projektbeschreibung](#2-technische-projektbeschreibung)
3. [Erfüllung der Frascati-Kriterien](#3-erfüllung-der-frascati-kriterien)
4. [Abgrenzung zum Stand der Technik](#4-abgrenzung-zum-stand-der-technik)
5. [Arbeits- und Zeitplan](#5-arbeits--und-zeitplan)
6. [Budgetplan](#6-budgetplan)
7. [Risiken und Herausforderungen](#7-risiken-und-herausforderungen)
8. [Erwartete Ergebnisse](#8-erwartete-ergebnisse)
9. [Anlagen](#9-anlagen)

---

## 1. Zusammenfassung des F&E-Vorhabens

### 1.1 Kurzdarstellung

Das F&E-Vorhaben MANDA entwickelt eine neuartige M&A-Intelligence-Plattform, die fundamentale Forschungsfragen im Bereich der künstlichen Intelligenz und Wissensrepräsentation adressiert. Im Zentrum steht die Entwicklung einer innovativen **graphbasierten Wissensarchitektur (GraphRAG)** in Kombination mit einem **Multi-Agenten-System**, das im Gegensatz zu herkömmlichen KI-Ansätzen nicht auf einmalige Prompt-Antworten setzt, sondern den Nutzer durch **intelligente Workflows** befähigt.

**Kern-Innovation:** Während aktuelle KI-Systeme auf "One-Shot-Prompting" basieren und damit die gesamte Intelligenz dem Modell überlassen, verfolgt MANDA einen paradigmatischen Ansatz: **"User Empowerment statt Model Dependency"** - die Integration von KI direkt in domänenspezifische Arbeitsabläufe mit kontinuierlichem Lernen und Wissensakkumulation.

### 1.2 Einordnung des Vorhabens

Das Vorhaben ist der **experimentellen Entwicklung** im Sinne des Frascati-Handbuchs zuzuordnen. Es werden bestehende wissenschaftliche Erkenntnisse aus den Bereichen:
- Knowledge Graphs und Graphdatenbanken
- Large Language Models (LLMs)
- Retrieval-Augmented Generation (RAG)
- Multi-Agenten-Systeme
- Domänenspezifische KI (Financial Domain)

...systematisch kombiniert und erweitert, um ein neuartiges technisches System zu entwickeln, dessen Funktionsfähigkeit mit erheblicher wissenschaftlicher Unsicherheit verbunden ist.

---

## 2. Technische Projektbeschreibung

### 2.1 Problemstellung

Die M&A-Branche (Mergers & Acquisitions) verarbeitet bei jeder Transaktion hunderte bis tausende Dokumente verschiedener Formate (Excel-Modelle, PDFs, Word-Dokumente) über Zeiträume von mehreren Monaten. Bestehende Lösungsansätze scheitern an folgenden technischen Herausforderungen:

1. **Fragmentierte Wissensrepräsentation:** Informationen werden isoliert extrahiert, ohne semantische Beziehungen zwischen Erkenntnissen abzubilden
2. **Temporale Inkonsistenz:** Keine Verfolgung, wie sich "Wahrheiten" über die Zeit entwickeln (z.B. aktualisierte Finanzzahlen)
3. **Kontextverlust:** Herkömmliche RAG-Systeme verlieren den Kontext bei langen Analysen
4. **Halluzinationsrisiko:** LLMs generieren plausible, aber faktisch falsche Informationen ohne Quellenverifizierung

### 2.2 Forschungsansatz und technische Innovation

#### 2.2.1 GraphRAG-Architektur mit temporalem Wissensmodell

MANDA entwickelt eine neuartige Wissensarchitektur basierend auf dem **Graphiti-Framework** in Kombination mit **Neo4j**:

```
Dokument-Upload → Parsing → Entity Extraction → Knowledge Graph
                                    ↓
         Temporal Facts (valid_at, invalid_at)
                                    ↓
         Entity Resolution → Relationship Mapping
                                    ↓
         Hybrid Search (Vector + BM25 + Graph Traversal)
```

**Technische Neuentwicklungen:**

1. **Bi-temporales Wissensmodell:**
   - `valid_at`: Zeitpunkt, ab dem eine Information gültig ist
   - `invalid_at`: Zeitpunkt, ab dem eine Information ungültig wird
   - Ermöglicht Nachverfolgung von Widersprüchen und Aktualisierungen über Zeit

2. **Hybrid Retrieval mit Reranking:**
   - Kombination von Vector-Suche (Voyage voyage-3.5, 1024 Dimensionen)
   - BM25-Textsuche für exakte Matches
   - Graph-Traversal für Beziehungsabfragen
   - Voyage rerank-2.5 für 20-35% Genauigkeitsverbesserung

3. **Sell-Side Spine Schema:**
   - Domänenspezifische Pydantic-Entitätstypen für M&A
   - Guidierte Extraktion mit dynamischer Erweiterbarkeit
   - Entity Resolution für M&A-typische Namensvariationen

#### 2.2.2 Agent Harness - Kontextgesteuertes Multi-Agenten-System

Im Gegensatz zu monolithischen LLM-Anwendungen entwickelt MANDA einen **Agent Harness** - ein orchestriertes System spezialisierter Agenten:

**Architekturprinzip: 4 Context Engineering Strategien**

| Strategie | Beschreibung | Forschungsfrage |
|-----------|--------------|-----------------|
| **Write** | Agent-autonomes Persistieren neuer Fakten in den Knowledge Graph | Wie kann ein Agent zuverlässig zwischen neuen Informationen und bereits bekanntem Wissen unterscheiden? |
| **Select** | Intent-Aware Retrieval vor LLM-Aufruf | Wie kann die Relevanz von Kontext für verschiedene Fragetypen vorhergesagt werden? |
| **Compress** | Kontextkompression für längere Konversationen | Wie können wichtige Informationen bei Kompression erhalten bleiben? |
| **Isolate** | Tool-Result-Isolation zur Kontextoptimierung | Wie können Tool-Ergebnisse optimal zusammengefasst werden? |

**Technische Implementierung:**

```python
# Beispiel: Intent-Aware Retrieval (Select Strategy)
class IntentClassifier:
    """
    Klassifiziert Nutzerabsichten für optimierte Retrieval-Strategie

    Forschungsfrage: Kann ein leichtgewichtiges Modell die
    Retrieval-Strategie zuverlässig vor dem LLM-Aufruf bestimmen?
    """
    INTENTS = [
        "fact_lookup",      # Direkte Faktenabfrage
        "comparison",       # Vergleich mehrerer Entitäten
        "synthesis",        # Zusammenfassung über Quellen
        "gap_analysis",     # Identifikation fehlender Info
        "contradiction"     # Prüfung auf Widersprüche
    ]
```

#### 2.2.3 Human-in-the-Loop Workflow-Integration

**Paradigmenwechsel:** Statt "AI generiert, Mensch validiert" verfolgt MANDA den Ansatz "Mensch arbeitet, AI unterstützt kontextuell":

1. **Collaborative Document Analysis:**
   - Analyst initiiert Analyse eines Dokuments
   - System öffnet/previewed Dokument für Analyst
   - Analyst erfasst Erkenntnisse per Chat-Interface
   - System validiert gegen existierende Wissensbasis in Echtzeit
   - Widersprüche werden proaktiv gemeldet

2. **Learning Loop:**
   - Analyst korrigiert systemgenerierte Findings
   - System aktualisiert Knowledge Graph
   - Confidence Scores werden kalibriert
   - Muster werden für zukünftige Extraktion gelernt

3. **CIM Builder mit LangGraph:**
   - Workflow-State-Management mit Checkpoints
   - Non-lineares Navigieren zwischen Workflow-Schritten
   - Abhängigkeitsverfolgung zwischen Slides
   - Resume-Capability von jedem Checkpoint

### 2.3 Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MANDA PLATFORM                                │
├─────────────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js 16, React 19)                                    │
│  ├── Data Room UI                                                   │
│  ├── Chat Interface                                                 │
│  ├── CIM Builder (3-Panel NotebookLM-Style)                        │
│  └── Q&A Management                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  AGENT LAYER                                                        │
│  ├── Conversational Agent (Claude/Gemini)                          │
│  ├── Intent Classifier                                              │
│  ├── Context Engine (4 Strategies)                                 │
│  └── Tool Calling Interface                                        │
├─────────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE LAYER (Graphiti + Neo4j)                                │
│  ├── Temporal Knowledge Graph                                       │
│  ├── Entity Resolution                                              │
│  ├── Voyage Embeddings (1024d)                                     │
│  └── Hybrid Retrieval + Reranking                                  │
├─────────────────────────────────────────────────────────────────────┤
│  PROCESSING LAYER (FastAPI, Python)                                │
│  ├── Document Parsing (Docling)                                    │
│  ├── Job Queue (pg-boss)                                           │
│  ├── Analysis Pipeline                                              │
│  └── Background Workers                                             │
├─────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                         │
│  ├── PostgreSQL (Supabase) - Transaktionale Daten                  │
│  ├── Neo4j - Knowledge Graph                                        │
│  └── Google Cloud Storage - Dokumente                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Erfüllung der Frascati-Kriterien

### 3.1 Neuartigkeit

**Das Vorhaben zielt auf die Schaffung neuen Wissens ab:**

| Aspekt | Bestehende Lösungen | MANDA Innovation |
|--------|---------------------|------------------|
| **Wissensrepräsentation** | Isolierte Vector-Stores ohne Beziehungen | Temporaler Knowledge Graph mit Entity Resolution |
| **Retrieval** | Single-Mode (meist nur Vector) | Hybrid (Vector + BM25 + Graph) mit Reranking |
| **Kontextmanagement** | Stateless per Request | 4-Strategie Context Engineering |
| **Nutzerinteraktion** | One-Shot Prompting | Workflow-integrierte AI-Unterstützung |
| **Domänenwissen** | Generisch | M&A-spezifisches Sell-Side Spine Schema |

**Spezifische Neuheiten:**

1. **Erster Einsatz von Graphiti für M&A-Domain:** Das Open-Source-Framework Graphiti wird erstmalig für die speziellen Anforderungen der M&A-Branche adaptiert und erweitert.

2. **Bi-temporales Wissensmodell für Dokumentenanalyse:** Die Verfolgung von Wahrheitsentwicklung über Zeit ist ein neuartiger Ansatz in der Dokumentenverarbeitung.

3. **Intent-Aware Retrieval vor LLM-Kontext:** Die Klassifikation der Nutzerabsicht zur Optimierung der Retrieval-Strategie vor dem eigentlichen LLM-Aufruf ist ein neuer Forschungsansatz.

### 3.2 Kreativität

**Das Vorhaben beruht auf originären, nicht naheliegenden Konzepten:**

1. **Paradigmenwechsel User Empowerment:**
   - Konventioneller Ansatz: "Je besser das Prompt, desto besser das Ergebnis"
   - MANDA-Ansatz: "Je besser die Workflow-Integration, desto wertvoller die AI-Unterstützung"

   Dies erfordert ein fundamentales Umdenken in der KI-Architektur.

2. **Kontrastive Designentscheidungen:**
   - Statt eines großen Kontextfensters: Intelligentes Context Engineering
   - Statt One-Model-Does-All: Spezialisierte Agenten mit Tool Calling
   - Statt Post-hoc-Validierung: Kontinuierliche Konsistenzprüfung im Workflow

3. **Interdisziplinäre Kombination:**
   - Knowledge Graph Forschung (Semantic Web)
   - NLP/LLM Forschung
   - Human-Computer Interaction
   - Domänenexpertise M&A

### 3.3 Unsicherheit

**Es besteht wissenschaftliche/technische Ungewissheit bezüglich der Erreichbarkeit der Ziele:**

#### Technische Unsicherheiten

| Risiko | Beschreibung | Schweregrad |
|--------|--------------|-------------|
| **Halluzinationsreduktion** | Kann das System Halluzinationen auf ein für Banking akzeptables Niveau (<2%) reduzieren? | HOCH |
| **Entity Resolution Accuracy** | Erreicht die Entity Resolution für M&A-Namensvariationen >95% Genauigkeit? | MITTEL |
| **Reranking-Effektivität** | Verbessert Voyage rerank-2.5 die Retrieval-Genauigkeit tatsächlich um 20-35% in der M&A-Domain? | MITTEL |
| **Intent Classification** | Kann ein leichtgewichtiges Modell Nutzerabsichten zuverlässig klassifizieren? | MITTEL |
| **Context Compression** | Wie viel Information geht bei Kontextkompression verloren? | HOCH |
| **Learning Loop Konvergenz** | Konvergieren die Confidence Scores zu verlässlichen Werten? | MITTEL |

#### Offene Forschungsfragen

1. **Wie können Widersprüche zwischen Dokumenten zuverlässig erkannt werden, ohne False Positives zu generieren?**
   - Problem: "Komplexität der Wahrheit" - verschiedene Kontexte rechtfertigen unterschiedliche Werte
   - Forschungsansatz: Kategorisierung (harter Konflikt vs. Kontextdifferenz)

2. **Wie kann Agent-autonomes Persistieren ohne Nutzerbestätigung erfolgen?**
   - Problem: Automatische Extraktion kann Fehler in den Knowledge Graph einführen
   - Forschungsansatz: Confidence-based Gating mit Learning Loop

3. **Wie skaliert die Graph-Traversal-Performance bei >10.000 Entitäten pro Deal?**
   - Problem: Query-Latenz bei komplexen Graphabfragen
   - Forschungsansatz: Index-Optimierung und Query-Caching

### 3.4 Systematik

**Das Vorhaben folgt einem planmäßigen Vorgehen:**

#### Methodische Vorgehensweise

1. **Iterative Entwicklung:** 2-Wochen-Sprints mit definierten Epics und Stories
2. **Wissenschaftliche Evaluation:** A/B-Testing von Retrieval-Strategien
3. **Domänenvalidierung:** Kontinuierliche Validierung mit M&A-Experten
4. **Dokumentierte Entscheidungen:** Architecture Decision Records (ADRs)

#### Budgetierte F&E-Aktivitäten

| Phase | Fokus | Aufwand |
|-------|-------|---------|
| Phase 1 (abgeschlossen) | MVP Foundation | 9 Epics, 82 Stories |
| Phase 2 (aktiv) | Knowledge Graph Foundation | 2 Epics, 15 Stories |
| Phase 3 (geplant) | Semantic Intelligence Engine | 3 Epics, ~30 Stories |

### 3.5 Reproduzierbarkeit

**Die Ergebnisse sind übertragbar und dokumentiert:**

1. **Open-Source-Komponenten:** Graphiti, LangGraph, Docling sind dokumentiert
2. **Interne Dokumentation:** PRD (v2.3), Architecture Document, Epics/Stories
3. **Code-Qualität:** TypeScript (Frontend), Python mit Type Hints (Backend)
4. **Test-Coverage:** Unit Tests, Integration Tests, E2E Tests (Playwright)
5. **Architektur-Entscheidungen:** Dokumentiert als ADRs

---

## 4. Abgrenzung zum Stand der Technik

### 4.1 Marktanalyse bestehender Lösungen

| Lösung | Kategorie | Limitierung |
|--------|-----------|-------------|
| **ChatGPT/Claude** | General Purpose LLM | Keine persistente Wissensbasis, keine Quellenattribution |
| **Datasite/Intralinks** | Virtual Data Room | Nur Dokumentenmanagement, keine KI-Analyse |
| **Kira Systems** | Contract Analysis | Nur juristische Dokumente, keine Cross-Domain-Analyse |
| **AlphaSense** | Financial Research | Nur externe Quellen, keine interne Dokumentenanalyse |
| **Generic RAG Tools** | Vector Search | Keine temporale Modellierung, keine Entity Resolution |

### 4.2 Wissenschaftlicher Stand

**Knowledge Graphs + LLMs:**
- Microsoft GraphRAG (2024): Fokus auf Summarization, nicht auf temporale Modellierung
- Graphiti (2024): Framework vorhanden, aber keine domänenspezifische Anpassung für M&A

**RAG-Systeme:**
- Standard-RAG: Chunk-basiert ohne Beziehungsmodellierung
- Hybrid Search: Existiert, aber ohne domänenspezifisches Reranking

**Agent-Systeme:**
- LangGraph/AutoGen: Frameworks vorhanden, aber keine Integration mit temporalem Knowledge Graph

### 4.3 Technologische Lücke

MANDA adressiert die Lücke zwischen:
- **Generischen LLM-Tools** (kein Domänenwissen, keine Persistenz)
- **Spezialisierten M&A-Tools** (keine KI, nur statische Funktionen)

Durch die Kombination von:
- Temporalem Knowledge Graph
- Domänenspezifischem Schema
- Human-in-the-Loop Workflows
- Multi-Strategie Context Engineering

---

## 5. Arbeits- und Zeitplan

### 5.1 Projektphasen

```
2025                                    2026                     2027
├─────────────────────────────────────────────────────────────────────┤
│ Q1-Q2 2025     │ Q3-Q4 2025     │ Q1-Q2 2026    │ Q3-2027          │
│ Phase 1        │ Phase 2        │ Phase 3       │ Phase 4          │
│ MVP Foundation │ Knowledge      │ Semantic      │ Production &     │
│ (Complete)     │ Architecture   │ Intelligence  │ Refinement       │
├─────────────────────────────────────────────────────────────────────┤
```

### 5.2 Detaillierter Arbeitsplan

#### Phase 1: MVP Foundation (Q1-Q2 2025) - ABGESCHLOSSEN

| Epic | Beschreibung | Status | Personentage |
|------|--------------|--------|--------------|
| E1 | Project Foundation | ✅ | 15 |
| E2 | Document Ingestion & Storage | ✅ | 20 |
| E3 | Intelligent Document Processing | ✅ | 25 |
| E4 | Collaborative Knowledge Workflow | ✅ | 30 |
| E5 | Conversational Assistant | ✅ | 25 |
| E6 | IRL Management & Auto-Generation | ✅ | 20 |
| E7 | Learning Loop | ✅ | 20 |
| E8 | Q&A Co-Creation Workflow | ✅ | 20 |
| E9 | CIM Builder | ✅ | 35 |
| **Summe Phase 1** | | | **210 PT** |

#### Phase 2: Knowledge Architecture (Q3-Q4 2025) - IN ARBEIT

| Epic | Beschreibung | F&E-Fokus | Personentage |
|------|--------------|-----------|--------------|
| E10 | Knowledge Graph Foundation | Graphiti-Integration, Hybrid Retrieval, Entity Resolution | 40 |
| E11 | Agent Context Engineering | 4-Strategie Context Engine, Intent Classification | 45 |
| TD | Tech Debt Resolution | Stabilisierung, Test Coverage | 25 |
| **Summe Phase 2** | | | **110 PT** |

#### Phase 3: Semantic Intelligence (Q1-Q2 2026) - GEPLANT

| Epic | Beschreibung | F&E-Fokus | Personentage |
|------|--------------|-----------|--------------|
| E12 | Cross-Domain Pattern Detection | Automatische Widerspruchserkennung | 50 |
| E13 | Proactive Insight Surfacing | Bi-direktionale Intelligence | 45 |
| E14 | Deal-Type Specialization | Domänenspezifische Konfiguration | 35 |
| **Summe Phase 3** | | | **130 PT** |

#### Phase 4: Production & Refinement (Q3 2026 - 2027)

| Epic | Beschreibung | Personentage |
|------|--------------|--------------|
| E15 | Production Hardening | 40 |
| E16 | Learning Loop Optimization | 35 |
| E17 | Performance Optimization | 35 |
| **Summe Phase 4** | | **110 PT** |

### 5.3 Meilensteine

| Meilenstein | Datum | Kriterium |
|-------------|-------|-----------|
| M1: MVP Complete | Q2 2025 ✅ | Funktionsfähige Plattform mit allen Core Features |
| M2: Knowledge Graph Operational | Q4 2025 | Graphiti + Neo4j voll integriert, Hybrid Retrieval funktional |
| M3: Context Engine Complete | Q1 2026 | Alle 4 Context-Strategien implementiert |
| M4: Semantic Intelligence | Q2 2026 | Cross-Domain Pattern Detection nachgewiesen |
| M5: Production Ready | Q4 2026 | Performance-Ziele erreicht, Learning Loop konvergiert |

---

## 6. Budgetplan

### 6.1 Übersicht der förderfähigen Kosten

**Projektzeitraum:** 01.01.2025 - 31.12.2027 (36 Monate)

| Kostenart | Jahr 1 (2025) | Jahr 2 (2026) | Jahr 3 (2027) | Gesamt |
|-----------|---------------|---------------|---------------|--------|
| **Personalkosten** | | | | |
| Geschäftsführer/Entwickler (Sie) | 80.000 € | 90.000 € | 100.000 € | 270.000 € |
| Entwickler (geplant ab Q3 2025) | 25.000 € | 75.000 € | 80.000 € | 180.000 € |
| **Summe Personal** | **105.000 €** | **165.000 €** | **180.000 €** | **450.000 €** |
| | | | | |
| **Gemeinkosten (Pauschale)** | | | | |
| 25% der Personalkosten* | 26.250 € | 41.250 € | 45.000 € | 112.500 € |
| | | | | |
| **Infrastruktur/Cloud** | | | | |
| Claude Code (AI Development) | 6.000 € | 7.200 € | 7.200 € | 20.400 € |
| Cloud Infrastructure (GCP, Neo4j) | 4.800 € | 9.600 € | 14.400 € | 28.800 € |
| LLM API Kosten (OpenAI, Anthropic, Voyage) | 3.600 € | 7.200 € | 12.000 € | 22.800 € |
| Weitere SaaS Tools | 2.400 € | 3.600 € | 4.800 € | 10.800 € |
| **Summe Infrastruktur** | **16.800 €** | **27.600 €** | **38.400 €** | **82.800 €** |
| | | | | |
| **Gesamtkosten** | **148.050 €** | **233.850 €** | **263.400 €** | **645.300 €** |

*Hinweis: Ab 2025 sind Gemeinkosten und sonstige Betriebskosten bei der Forschungszulage förderfähig (25% Pauschale auf Personalkosten).

### 6.2 Detaillierte Personalkosten

#### Geschäftsführer/Hauptentwickler (Max Hofer)

| Position | Beschreibung | Anteil F&E |
|----------|--------------|------------|
| Rolle | Technische Leitung, Architektur, Kernentwicklung | 100% |
| Qualifikation | [Ihre Qualifikation hier] | |
| Haupttätigkeiten | - Knowledge Graph Architektur<br>- Agent System Design<br>- Core Backend Development<br>- Technical Research | |

**Stundensatz-Berechnung:**
- Jahresgehalt (Ziel): 80.000 - 100.000 € (ansteigend)
- Produktive Stunden: ~1.600 h/Jahr
- Effektiver Stundensatz: 50-62,50 €/h

#### Entwickler (geplant ab Q3 2025)

| Position | Beschreibung | Anteil F&E |
|----------|--------------|------------|
| Rolle | Full-Stack Entwicklung | 80-100% |
| Start | Q3 2025 | |
| Jahresgehalt | 65.000 - 80.000 € | |

### 6.3 Infrastrukturkosten Detail

| Service | Monatlich | Jährlich | Verwendung |
|---------|-----------|----------|------------|
| **Claude Code** | 500 € | 6.000 € | AI-gestützte Entwicklung, Code-Generierung |
| **Google Cloud Platform** | 400-1.200 € | 4.800-14.400 € | Cloud Run, Cloud Storage, Compute |
| **Neo4j Aura** | 200-500 € | 2.400-6.000 € | Knowledge Graph Hosting |
| **Supabase** | 50-100 € | 600-1.200 € | PostgreSQL, Auth |
| **LLM APIs** | 300-1.000 € | 3.600-12.000 € | Claude, Gemini, Voyage Embeddings |
| **Sonstige** | 200-400 € | 2.400-4.800 € | GitHub, Monitoring, etc. |

### 6.4 Förderfähige F&E-Quote

| Arbeitspaket | F&E-Anteil | Begründung |
|--------------|------------|------------|
| Knowledge Graph Architecture | 100% | Reine Forschung & Entwicklung |
| Agent Context Engineering | 100% | Neuartige technische Lösung |
| Hybrid Retrieval System | 100% | Experimentelle Entwicklung |
| Entity Resolution | 90% | F&E mit Anwendungserprobung |
| UI/UX Development | 50% | Teils F&E, teils Standard-Entwicklung |
| Infrastructure Setup | 30% | Überwiegend Standardarbeiten |
| Testing & Documentation | 70% | F&E-begleitende Arbeiten |

**Gewichteter F&E-Anteil:** ~85%

### 6.5 Berechnung Forschungszulage

```
Förderfähige Personalkosten (Jahr 1-3):         450.000 €
+ Gemeinkosten-Pauschale (25%):                 112.500 €
= Bemessungsgrundlage Personal:                 562.500 €

Förderquote:                                         25%
= Forschungszulage aus Personalkosten:          140.625 €

Förderfähige Auftragsforschung:                      0 €
(Keine externen F&E-Aufträge geplant)

Maximale Bemessungsgrundlage (ab 2025):      10.000.000 €
Unsere Bemessungsgrundlage:                    562.500 €

ERWARTETE FORSCHUNGSZULAGE:                   ~140.625 €
(über 3 Jahre, jährlich ~47.000 €)
```

---

## 7. Risiken und Herausforderungen

### 7.1 Technische Risiken

| Risiko | Eintritts-wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|------------------------------|------------|------------|
| LLM-Halluzinationen erreichen nicht <2% | Mittel | Hoch | Strikte Source Attribution, Confidence Gating |
| Graph-Performance bei großen Datenmengen | Mittel | Mittel | Index-Optimierung, Query-Caching |
| Entity Resolution Accuracy <95% | Niedrig | Mittel | Domänenspezifisches Fine-Tuning |
| Context Compression verliert kritische Info | Mittel | Hoch | Adaptive Compression, wichtige Facts explizit erhalten |

### 7.2 Projektrisiken

| Risiko | Mitigation |
|--------|------------|
| Personalengpass | Priorisierung Core-Features, ggf. Freelancer für spezifische Tasks |
| Kostenüberschreitung Cloud | Monitoring, Cost Alerts, Architektur-Optimierung |
| Technologie-Pivot nötig | Modulare Architektur ermöglicht Austausch von Komponenten |

### 7.3 Warum das Projekt scheitern könnte

**Ehrliche Einschätzung der Unsicherheiten:**

1. **Halluzinationsrisiko:** Wenn LLM-Halluzinationen nicht auf ein für Banking akzeptables Niveau gesenkt werden können, ist das Produkt nicht einsetzbar.

2. **Komplexität der Wahrheit:** Die automatische Erkennung von Widersprüchen vs. kontextabhängigen Unterschieden ist ein ungelöstes Problem.

3. **Learning Loop Konvergenz:** Es ist nicht sicher, ob die Feedback-Schleife zu stabilen, zuverlässigen Confidence Scores konvergiert.

4. **Domänenanpassung:** Die Übertragung generischer KI-Forschung auf die spezifischen Anforderungen der M&A-Branche ist mit Unsicherheit behaftet.

---

## 8. Erwartete Ergebnisse

### 8.1 Wissenschaftliche Erkenntnisse

1. **Validierung oder Widerlegung:** Ob bi-temporale Wissensmodelle die Konsistenz bei Dokumentenanalyse verbessern
2. **Messung:** Effektivität von Hybrid Retrieval (Vector + BM25 + Graph) vs. Single-Mode
3. **Evaluation:** Performance verschiedener Context Engineering Strategien
4. **Domänenadaption:** Übertragbarkeit generischer RAG-Ansätze auf Financial Domain

### 8.2 Technische Ergebnisse

1. **Software-Plattform:** Funktionsfähige M&A-Intelligence-Plattform
2. **Architektur-Muster:** Dokumentierte Patterns für temporale Knowledge Graphs mit LLMs
3. **Benchmarks:** Messungen zu Retrieval-Genauigkeit, Halluzinationsraten, Performance

### 8.3 Wirtschaftliche Verwertung

- **Produkt:** B2B SaaS für Investment Banking und M&A Advisory
- **Markt:** Globaler M&A Advisory Markt
- **Differenzierung:** Erste Plattform mit temporalem Knowledge Graph für M&A

---

## 9. Anlagen

### 9.1 Dokumentenverzeichnis

1. **PRD (Product Requirements Document):** `docs/manda-prd.md` (v2.3)
2. **Architektur-Dokument:** `docs/manda-architecture.md` (v3.3)
3. **Epics & Stories:** `docs/epics.md`, `docs/sprint-artifacts/stories/`
4. **Sprint Change Proposals:** `docs/sprint-change-proposal-*.md`

### 9.2 Technische Referenzen

- Graphiti Framework: https://github.com/getzep/graphiti
- Neo4j Graph Database: https://neo4j.com/
- LangGraph: https://langchain-ai.github.io/langgraph/
- Voyage AI: https://www.voyageai.com/

### 9.3 Glossar

| Begriff | Definition |
|---------|------------|
| **GraphRAG** | Graph-based Retrieval-Augmented Generation |
| **Knowledge Graph** | Graphbasierte Wissensrepräsentation mit Entitäten und Beziehungen |
| **RAG** | Retrieval-Augmented Generation - Erweiterung von LLMs durch externe Wissensbasis |
| **Entity Resolution** | Identifikation gleicher Entitäten unter verschiedenen Namen |
| **Bi-temporal** | Zwei Zeitdimensionen: Gültigkeitszeitraum und Systemzeit |
| **LLM** | Large Language Model |
| **M&A** | Mergers & Acquisitions (Fusionen und Übernahmen) |
| **CIM** | Confidential Information Memorandum |
| **IRL** | Information Request List |

---

## Erklärung

Ich versichere, dass die Angaben in diesem Antrag vollständig und wahrheitsgemäß sind. Die beschriebenen Tätigkeiten stellen Forschungs- und Entwicklungsarbeiten im Sinne des § 2 FZulG dar.

**Ort, Datum:** _______________________

**Unterschrift:** _______________________

**Name:** Max Hofer

---

*Dieses Dokument wurde erstellt zur Beantragung der Forschungszulage gemäß Forschungszulagengesetz (FZulG) bei der Bescheinigungsstelle Forschungszulage (BSFZ).*
