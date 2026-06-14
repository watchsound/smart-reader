## Rich Markdown Editor (Knowledge Web)

A full-featured WYSIWYG markdown editor with a "Knowledge Web" linking system to connect notes, vocabulary, and concepts bidirectionally. Solves knowledge fragmentation by creating semantic relationships between learning materials.

### Architecture

```
src/renderer/components/editor/
├── RichMarkdownEditor.tsx          # Main TipTap editor component
├── EditorToolbar.tsx               # MUI-based formatting toolbar
├── extensions/
│   ├── MathJaxExtension.tsx        # LaTeX/MathJax support ($...$ and $$...$$)
│   └── WikiLinkExtension.tsx       # [[wiki-link]] syntax for linking
├── popovers/
│   ├── LinkPreviewPopover.tsx      # Hover preview for vocabulary/concept/note
│   └── LinkSuggestionMenu.tsx      # Autocomplete dropdown for [[...]]
├── panels/
│   └── BacklinksPanel.tsx          # Shows notes linking TO current note
├── editor.styles.css               # Editor styling, syntax highlighting
└── index.ts                        # Exports
```

### Key Features

**Editor Capabilities:**
- Full formatting: bold, italic, underline, strikethrough, headers (H1-H3)
- Lists (bullet, numbered), blockquotes, code blocks with syntax highlighting
- Tables with insert/resize support
- LaTeX/MathJax: inline `$E=mc^2$` and block `$$\int_a^b f(x)dx$$`
- Font family and text color customization
- Highlight/background colors
- Undo/redo, copy/paste preservation

**Knowledge Web Linking:**
| Layer | Trigger | Creates Link? | Purpose |
|-------|---------|---------------|---------|
| Vocabulary Tooltips | Hover over vocabulary word | No | Inline learning aid - see definition without leaving |
| Explicit Links | User types `[[...]]` | Yes | Manual connections between specific notes |
| Semantic Auto-Links | Save note | Yes (auto) | Auto-discover related notes via tags + embeddings |

### Wiki-Link Syntax

Type `[[` to trigger autocomplete:
```
[[vocabulary-word]]    → Links to vocabulary (green)
[[concept-name]]       → Links to concept (blue)
[[note-title]]         → Links to note (gray)
```

### Link Type Colors

| Type | Color | CSS Class |
|------|-------|-----------|
| Vocabulary | `#4CAF50` (green) | `.wiki-link--vocabulary` |
| Concept | `#2196F3` (blue) | `.wiki-link--concept` |
| Note | `#9E9E9E` (gray) | `.wiki-link--note` |

### Usage

**Basic Editor:**
```jsx
import { RichMarkdownEditor } from '../components/editor';

function NoteEditor() {
  const editorRef = useRef(null);

  const handleChange = (html, text) => {
    console.log('HTML:', html);
    console.log('Text:', text);
  };

  return (
    <RichMarkdownEditor
      ref={editorRef}
      content="<p>Initial content</p>"
      onChange={handleChange}
      placeholder="Write your note..."
      minHeight={200}
      maxHeight={400}
      onLinkClick={(type, id) => navigate(`/${type}/${id}`)}
    />
  );
}
```

**Ref Methods:**
```javascript
// Get content
editorRef.current.getHTML();   // Returns HTML string
editorRef.current.getText();   // Returns plain text
editorRef.current.getJSON();   // Returns ProseMirror JSON

// Set content
editorRef.current.setContent('<p>New content</p>');
editorRef.current.clear();
editorRef.current.focus();

// Insert special content
editorRef.current.insertMath('E=mc^2', true);   // inline math
editorRef.current.insertMath('\\int_a^b f(x)dx', false);  // block math
editorRef.current.insertWikiLink('vocabulary', 'word_123', 'ephemeral');
```

### Neo4j Link Methods

Located in `src/main/utils/Neo4jAdapter.js`:

| Method | Purpose |
|--------|---------|
| `getBacklinks(targetId, targetType, token)` | Get notes linking TO target |
| `getOutgoingLinks(noteId, token)` | Get links FROM a note |
| `syncNoteLinks(noteId, links, token)` | Update links on save |
| `searchForLinking(query, token, limit)` | Search vocab/concepts/notes for suggestions |
| `findNotesBySharedTags(tags, excludeId, token, minSharedTags)` | Find related by tags |
| `findSemanticallySimilarNotes(noteId, embedding, threshold, token)` | Find by embedding |
| `getLinkPreview(type, id, token)` | Fetch preview data for hover popup |

### IPC Handlers

Added to `src/main/ipc/graphHandlers.js`:

| Handler | Type | Purpose |
|---------|------|---------|
| `get-link-suggestions` | sync | Search vocab→concepts→notes for autocomplete |
| `get-link-preview` | sync | Fetch preview data for hover popup |
| `get-backlinks` | sync | Get notes linking to target |
| `sync-note-links` | invoke | Update links in Neo4j on save |
| `get-outgoing-links` | sync | Get links from a note |
| `find-notes-by-shared-tags` | sync | Find notes with shared tags |
| `find-similar-notes` | sync | Find semantically similar notes |

### Integration with CreateNotePanel

The editor is integrated into `CreateNotePanel.tsx` with a toggle to switch between rich and simple modes:

```jsx
// In CreateNotePanel.tsx
const [useRichEditor, setUseRichEditor] = useState(true);
const editorRef = useRef(null);

// Toggle in UI
<FormControlLabel
  control={<Switch checked={useRichEditor} onChange={(e) => setUseRichEditor(e.target.checked)} />}
  label="Rich Editor"
/>

// Conditional rendering
{useRichEditor ? (
  <RichMarkdownEditor
    ref={editorRef}
    content={summaryHtml}
    onChange={handleEditorChange}
    onLinkClick={handleLinkClick}
  />
) : (
  <TextField multiline value={summary} onChange={(e) => setSummary(e.target.value)} />
)}

// On save: extract wiki-links and sync to Neo4j
const extractWikiLinksFromHtml = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = [];
  doc.querySelectorAll('.wiki-link').forEach((el) => {
    links.push({
      type: el.dataset.linkType,
      id: el.dataset.linkId,
      text: el.textContent,
    });
  });
  return links;
};
```

### Dependencies

```json
{
  "@tiptap/react": "^3.20.0",
  "@tiptap/starter-kit": "^3.20.0",
  "@tiptap/extension-placeholder": "^3.20.0",
  "@tiptap/extension-underline": "^3.20.0",
  "@tiptap/extension-text-style": "^3.20.0",
  "@tiptap/extension-color": "^3.20.0",
  "@tiptap/extension-font-family": "^3.20.0",
  "@tiptap/extension-highlight": "^3.20.0",
  "@tiptap/extension-table": "^3.20.0",
  "@tiptap/extension-table-row": "^3.20.0",
  "@tiptap/extension-table-cell": "^3.20.0",
  "@tiptap/extension-table-header": "^3.20.0",
  "@tiptap/extension-code-block-lowlight": "^3.20.0",
  "@tiptap/suggestion": "^3.20.0",
  "lowlight": "^3.0.0"
}
```

### Test Commands

```bash
# Run editor tests
npm test -- --testPathPattern=editor

# Run specific test file
npm test -- --testPathPattern=RichMarkdownEditor.test.tsx
npm test -- --testPathPattern=WikiLinkExtension.test.ts
npm test -- --testPathPattern=MathJaxExtension.test.ts
```
