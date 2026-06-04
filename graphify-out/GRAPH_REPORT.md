# Graph Report - .  (2026-05-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 455 nodes · 621 edges · 50 communities (32 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `77758244`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `compilerOptions` - 17 edges
3. `compilerOptions` - 13 edges
4. `mutation` - 13 edges
5. `DesignSystemGenerator` - 11 edges
6. `query` - 11 edges
7. `Convex Migration Helper Skill` - 10 edges
8. `skills` - 9 edges
9. `source` - 8 edges
10. `sourceType` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Faraday Project` --references--> `Local AI Service`  [INFERRED]
  README.md → src/services/localAI.ts
- `Convex Backend Integration` --semantically_similar_to--> `Convex Backend Integration`  [EXTRACTED] [semantically similar]
  AGENTS.md → CLAUDE.md
- `Application Root` --implements--> `Faraday Project`  [INFERRED]
  index.html → README.md
- `_generate_intelligent_overrides()` --calls--> `search()`  [INFERRED]
  .agent/skills/ui-ux-pro-max/scripts/design_system.py → .agent/skills/ui-ux-pro-max/scripts/core.py
- `Convex Migration Helper Skill` --references--> `@convex-dev/migrations Component`  [EXTRACTED]
  .junie/skills/convex-migration-helper/SKILL.md → .junie/skills/convex-migration-helper/references/migrations-component.md

## Communities (50 total, 18 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (53): AIChatPanelProps, ActiveSession, ChatHistoryEntry, clearActiveSession(), clearMessages(), debouncedSaveMessages(), flushAllPending(), getActiveSession() (+45 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (25): DesignSystemGenerator, _detect_page_type(), format_ascii_box(), format_markdown(), format_master_md(), format_page_override_md(), generate_design_system(), _generate_intelligent_overrides() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (31): Auth0 Auth Provider, Clerk Auth Provider, computedHash, skillPath, source, sourceType, skills, browser-use (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (9): CompoundQuestionData, Props, Section, LegacyQuestionData, Props, Props, api, components (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (23): dependencies, convex, framer-motion, katex, lucide-react, @mediapipe/tasks-genai, react, react-dom (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (15): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (10): generateHint, getStudentHints, generateInteractions, seedDatabase, seedCompoundQuestions, generate, createBrief, getBriefForChat (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, fake-indexeddb, globals, @types/deep-eql (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.23
Nodes (7): CodeQualityChecker, main(), Main class for code quality checker functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report

### Community 12 - "Community 12"
Cohesion: 0.23
Nodes (7): main(), PrAnalyzer, Main class for pr analyzer functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report

### Community 13 - "Community 13"
Cohesion: 0.23
Nodes (7): main(), Main class for review report generator functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report, ReviewReportGenerator

### Community 14 - "Community 14"
Cohesion: 0.30
Nodes (11): analyze(), brief(), ChatMessage, CONFIG_PATHS, generate(), initModel(), post(), stripThinkBlock() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (9): addMessage, deleteChat, endChat, getActiveChat, getChatMessages, getStudentChats, getTeacherChatAnalytics, startChat (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (8): generateRundown, getRundown, backfillLevels, evaluateStudentLevel, getPendingSuggestions, resolveSuggestion, scheduledEvaluateAll, internalMutation

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (7): getByDifficulty, getById, getByTopics, list, get, list, query

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (6): crons, getClassroomPowerMaps, getStudentPowerMap, recomputePowerMap, scheduledRecompute, internal

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): assignToStudents, closeHomework, createHomework, finalizeSubmission, getHomeworkForClassroom, getStudentHomework, submitAnswer

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (6): get, getByClassroom, getClassroomHeatmap, getFirstClassroom, getLiveAlerts, list

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): agentSkillsSha, agentsMdSectionHash, claudeMdHash, guidelinesHash, installedSkillNames

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): ActionCtx, DatabaseReader, DatabaseWriter, MutationCtx, QueryCtx

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (3): Doc, Id, TableNames

### Community 24 - "Community 24"
Cohesion: 0.40
Nodes (4): getByTopic, getNextQuestion, getQuestion, list

### Community 25 - "Community 25"
Cohesion: 0.40
Nodes (4): getQuestionFailureRates, getRecentAttempts, getStudentStats, submitAttempt

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (5): Application Root, DictaLM 3.0 Thinking Model, Local AI Service, Wllama WASM URL, Faraday Project

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (3): fs, generateInteractions, seedDatabase

## Knowledge Gaps
- **210 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+205 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mutation` connect `Community 8` to `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `query` connect `Community 17` to `Community 8`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `search()` connect `Community 6` to `Community 1`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _258 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07071887784921099 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0855614973262032 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11895161290322581 - nodes in this community are weakly interconnected._