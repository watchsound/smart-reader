## AI-Powered Concept Extraction

Intelligent extraction of concepts, entities, and relationships from note content using LLM, with automatic integration into the knowledge graph.

### Architecture

```
Note Creation Flow
├── CreateNotePanel.tsx
│   └── ConceptReviewPanel.tsx (UI for reviewing extracted concepts)
│       └── graphApi.aiFullExtraction() → IPC
│
Main Process
├── graphHandlers.js (IPC handlers)
│   └── graph-ai-full-extraction, graph-ai-save-extraction, etc.
│
└── AIConceptExtractionService.js
    ├── extractConceptsWithAI() - Uses createMindmapExtractionPrompt
    ├── extractEntitiesWithAI() - Uses createEntityResolutionPrompt
    ├── fullExtraction() - Combines both + relationship suggestions
    └── saveToGraph() - Saves to Neo4j
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/utils/AIConceptExtractionService.js` | Core extraction service using AI prompts |
| `src/main/ipc/graphHandlers.js` | IPC handlers for extraction operations |
| `src/renderer/api/graphApi.js` | Renderer-side API methods |
| `src/renderer/components/knowledge/ConceptReviewPanel.tsx` | UI for reviewing/selecting concepts |
| `src/renderer/components/chat/CreateNotePanel.tsx` | Note creation with concept extraction |

### AI Prompts Used

Located in `src/commons/utils/AIPrompts.js`:
- **`createMindmapExtractionPrompt(text)`**: Extracts entities, relationships, and creates a mindmap structure with nodes and edges
- **`createEntityResolutionPrompt(text)`**: Identifies entities and coreferences (pronouns, descriptions referring to same entity)

### Extraction Features

1. **Concept Extraction**: Identifies key entities (people, concepts, places, events, objects) from text
2. **Relationship Detection**: Extracts relationships between entities (requires, part_of, causes, example_of, related_to)
3. **Entity Resolution**: Detects when different mentions refer to the same entity (e.g., "Einstein", "he", "the physicist")
4. **Existing Concept Matching**: Finds concepts already in the user's knowledge graph
5. **Relationship Suggestions**: Suggests links between new concepts and existing ones

### Usage in Components

```javascript
import graphApi from '../api/graphApi';

// Check if AI extraction is available
const available = graphApi.isAIExtractionAvailable();

// Full extraction with suggestions
const result = await graphApi.aiFullExtraction(text, token);
// Returns: { nodes, edges, entities, existingConcepts, suggestions }

// Save extracted concepts to graph
await graphApi.aiSaveExtraction(
  selectedNodes,
  selectedEdges,
  noteId,
  'note',  // sourceType: 'note' or 'book'
  token
);
```

### ConceptReviewPanel Component

A React component for reviewing AI-extracted concepts before saving:

```jsx
<ConceptReviewPanel
  text={content}
  onExtracted={(result) => console.log('Extracted:', result)}
  onSave={(nodes, edges) => console.log('Save:', nodes, edges)}
  autoExtract={false}  // Set true to extract on mount
  compact={true}       // Compact mode for embedded use
/>
```

**Features:**
- Type-colored concept chips (person, concept, location, event, organization, object)
- Toggle selection for individual concepts and relationships
- Shows existing concepts already in the knowledge graph
- Displays suggested links between new and existing concepts
- "Save to Graph" button to persist selected concepts

### Integration with Note Creation

When creating notes via `CreateNotePanel`:
1. User enters/pastes content
2. ConceptReviewPanel appears (if content >= 50 chars)
3. User clicks sparkle button to trigger AI extraction
4. User reviews and selects concepts to save
5. On note save, selected concepts are automatically saved to Neo4j

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `graph-ai-extract-concepts` | invoke | Extract concepts using AI |
| `graph-ai-extract-entities` | invoke | Extract entities with coreference |
| `graph-ai-full-extraction` | invoke | Full extraction pipeline |
| `graph-ai-save-extraction` | invoke | Save concepts to Neo4j |
| `graph-ai-extraction-available` | sync | Check if AI provider is configured |
