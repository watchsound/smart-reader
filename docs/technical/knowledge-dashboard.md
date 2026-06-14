## Knowledge Dashboard

A comprehensive view for exploring and managing the knowledge graph.

### Route

`/knowledge` - Accessible from sidebar under "Learning" section

### Key File

`src/renderer/views/knowledge/KnowledgeDashboard.js`

### Features

- **Overview Stats**: Total concepts, books, notes, mastered count
- **Quick Stats Grid**: Visual cards for key metrics
- **Learning Progress**: Bar chart showing mastery distribution
- **Knowledge Graph Visualization**: Interactive force-directed graph
- **Recent Activity**: Timeline of knowledge growth
- **Weak Concepts Panel**: Concepts needing review
- **Memory Timeline**: Chronological view of consolidated learning memories

### Dashboard Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Knowledge Graph | `KnowledgeGraphPanel` | Force-directed graph visualization |
| Learning Path | `LearningPathPanel` | Personalized learning paths with prerequisites |
| Weak Concepts | `WeakConceptsPanel` | Concepts with low mastery or high errors |
| Adaptive Learning | `AdaptiveLearningPanel` | AI-powered learning insights |
| Memory Timeline | `MemoryTimelinePanel` | Chronological memory visualization |

### Memory Timeline Panel

Located in `src/renderer/components/knowledge/MemoryTimelinePanel.js`, displays consolidated memories in a chronological timeline view.

**Features:**
- **Timeline View**: Chronological display of ConsolidatedMemory nodes
- **Coverage View**: Memory coverage analysis by concept (bar chart)
- **Gaps View**: Concepts without recent memories (review prompts)
- **Memory Cards**: Expandable cards showing summary, insights, recommendations
- **Episode Drill-Down**: Click to load source episodes for any memory
- **Filtering**: Search by text, filter by memory type

**Sub-Tabs (overview mode):**
| Tab | Content |
|-----|---------|
| Timeline | Chronological list of all memories |
| Coverage | Concepts with most/least memories |
| Gaps | Concepts needing review (days since last memory) |

**Concept-Specific Mode:**
When `conceptId` is provided, shows full hierarchy: Concept → Memories → Episodes

**Usage:**
```javascript
import MemoryTimelinePanel from '../components/knowledge/MemoryTimelinePanel';

<MemoryTimelinePanel
  conceptId={selectedConcept?.id}    // Optional: filter to specific concept
  conceptName={selectedConcept?.name}
  onConceptSelect={handleSelect}     // Called when clicking gaps/coverage items
  onMemorySelect={handleMemory}      // Called when clicking a memory
  height={500}
  showStats={true}                   // Show stats overview
  showGaps={true}                    // Show memory gaps section
/>
```

**API Integration:**
- `graphApi.getSummarizationStats()` - Memory statistics
- `graphApi.getSummarizationHierarchy()` - Concept → Memory → Episode hierarchy
- `graphApi.getConceptTimeline()` - Chronological memories for a concept
- `graphApi.getMemoryCoverage()` - Coverage by concept
- `graphApi.findMemoryGaps()` - Concepts needing review
- `graphApi.getSourceEpisodes()` - Episodes for a memory

**Test Commands:**
```bash
# Run Memory Timeline Panel tests (16 tests)
npm test -- --testPathPattern=knowledge/MemoryTimelinePanel

# Run all memory consolidation tests (92 tests total)
npm test -- --testPathPattern="knowledge/MemoryTimelinePanel|brain/SummarizationGraphService|brain/brainHandlersSummarization"
```

### Integration Points

The Knowledge Dashboard is also embedded in:
- **Reading View** (`/reading/:id`): "Knowledge" tab in right sidebar showing book-specific concepts
- **Notes View** (`/notes`): Collapsible sidebar with knowledge graph summary
