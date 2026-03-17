# SmartReader User Manual

SmartReader is an AI-powered e-reader desktop application that combines document reading, intelligent note-taking, spaced repetition learning, and knowledge graph visualization.

## Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [Reading Documents](#reading-documents)
4. [Taking Notes](#taking-notes)
5. [Vocabulary Learning](#vocabulary-learning)
6. [Spaced Repetition (Leitner System)](#spaced-repetition-leitner-system)
7. [AI Chat Assistant](#ai-chat-assistant)
8. [Knowledge Graph](#knowledge-graph)
9. [Learning Plans](#learning-plans)
10. [Study Sessions](#study-sessions)
11. [Browser & Web Bookmarks](#browser--web-bookmarks)
12. [Quiz System](#quiz-system)
13. [Settings & Configuration](#settings--configuration)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Troubleshooting](#troubleshooting)

---

## Installation

### System Requirements

- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application, additional space for books and data
- **Node.js**: v14 or higher (for development only)

### Installing from Release

1. Download the latest release for your platform:
   - **Windows**: `SmartReader-Setup-x.x.x.exe`
   - **macOS**: `SmartReader-x.x.x.dmg` (Intel) or `SmartReader-x.x.x-arm64.dmg` (Apple Silicon)
   - **Linux**: `SmartReader-x.x.x.AppImage`

2. Run the installer:
   - **Windows**: Double-click the `.exe` file and follow the installation wizard
   - **macOS**: Open the `.dmg` file, drag SmartReader to Applications folder
   - **Linux**: Make the AppImage executable (`chmod +x SmartReader-x.x.x.AppImage`) and run it

3. Launch SmartReader from your applications menu or desktop shortcut.

### Building from Source

```bash
# Clone the repository
git clone https://github.com/your-repo/smart-reader-v2.git
cd smart-reader-v2

# Install dependencies
npm install

# Start in development mode
npm start

# Or build for production
npm run package
```

### Optional Components

#### AI Provider Setup

To use AI features, configure at least one AI provider in Settings:

| Provider | API Key Required | Local/Cloud |
|----------|------------------|-------------|
| OpenAI (ChatGPT) | Yes | Cloud |
| Anthropic (Claude) | Yes | Cloud |
| Google (Gemini) | Yes | Cloud |
| Ollama | No | Local |

#### ChromaDB (Optional - for semantic search)

```bash
pip install chromadb
chroma run --path ./chroma
```

---

## Getting Started

### First Launch

1. **Welcome Screen**: On first launch, you'll see the home dashboard with quick actions.

2. **Import Your First Book**: Click the "+" button in the bookshelf to import EPUB, PDF, or Word documents.

3. **Configure AI (Recommended)**: Go to Settings > AI Providers and add your API key for at least one provider.

### Main Navigation

The sidebar provides access to all major features:

| Icon | Feature | Description |
|------|---------|-------------|
| Home | Dashboard | Overview and quick actions |
| Book | Bookshelf | Your library of books |
| Bookmark | Bookmarks | Web bookmarks and saved pages |
| Notes | Notes | All your notes and annotations |
| Chat | AI Chat | Conversations with AI |
| School | Learning | Learning plans and study sessions |
| Quiz | Quizzes | Practice quizzes |
| Translate | Translation | Multi-step translation learning |
| Spellcheck | Grammar | Grammar checking and correction |
| Globe | Browser | Built-in web browser |
| Settings | Settings | App configuration |

---

## Reading Documents

### Supported Formats

- **EPUB**: Full support with text reflow, annotations, and navigation
- **PDF**: Native rendering with highlight and annotation support
- **Word (.docx)**: Converted to readable format (requires LibreOffice for advanced features)
- **HTML**: Web pages saved as books

### Opening a Book

1. Navigate to **Bookshelf**
2. Click on any book cover or spine to open it
3. The reader opens with a right sidebar for notes and AI chat

### Reader Controls

#### EPUB Reader

| Action | Method |
|--------|--------|
| Turn page | Click edges, swipe, or use arrow keys |
| Adjust font size | Use the "Aa" button in toolbar |
| Table of contents | Click the TOC icon |
| Search | Click the search icon or press `Ctrl+F` |
| Create bookmark | Click the bookmark icon |

#### PDF Reader

| Action | Method |
|--------|--------|
| Zoom | Use `+`/`-` buttons or scroll wheel with `Ctrl` |
| Navigate pages | Page number input or arrow keys |
| Fit to width/page | Toggle buttons in toolbar |
| Rotate | Click rotate button |

### Highlighting & Annotations

1. **Select text** by clicking and dragging
2. A **popup menu** appears with options:
   - **Highlight**: Choose color (yellow, green, blue, pink)
   - **Underline**: Add underline style
   - **Note**: Add a text annotation
   - **Copy**: Copy to clipboard
   - **AI Explain**: Get AI explanation
   - **Add to Vocabulary**: Create vocabulary card

3. View all highlights in the **My Notes** tab on the right sidebar.

### Text-to-Speech

1. Select any text
2. Click the **speaker icon** in the popup menu
3. The system will read the text aloud using your OS's built-in TTS

---

## Taking Notes

### Creating Notes

#### Method 1: From Reading

1. While reading, select text
2. Click "Create Note" in the popup
3. Add title, tags, and additional content
4. Click Save

#### Method 2: From Notes View

1. Go to **Notes** in the sidebar
2. Click the **+** button
3. Enter your note content
4. Optionally add to Leitner system for spaced repetition

### Note Features

- **Rich Text Editor**: Format with bold, italic, headers, lists, tables
- **LaTeX Support**: Use `$...$` for inline math, `$$...$$` for block equations
- **Wiki Links**: Type `[[` to link to vocabulary, concepts, or other notes
- **Tags**: Organize notes with tags for easy filtering
- **Images**: Paste or capture images from screen

### MoodBoard

Create visual mind maps with your notes:

1. Go to **MoodBoard** in the sidebar
2. Create a new board
3. Drag notes from the sidebar onto the canvas
4. Connect notes with relationships
5. Organize spatially for visual learning

---

## Vocabulary Learning

### Adding Vocabulary

#### Method 1: From Reading

1. Select a word while reading
2. Click "Add to Vocabulary"
3. Definition is auto-generated by AI (if configured)
4. Edit and save

#### Method 2: Manual Entry

1. Go to **Vocabulary** in the sidebar
2. Click the **+** button
3. Enter word, definition, examples
4. Assign to a vocabulary set (optional)

### Vocabulary Sets

Organize words into sets for focused study:

1. Create sets for different topics (GRE, TOEFL, Technical Terms)
2. Import vocabulary from:
   - CSV files
   - Quizlet (paste URL)
   - Manual entry

### Studying Vocabulary

1. Go to **Vocabulary** view
2. Click **Study** on any set
3. Use the flashcard interface:
   - Click card to flip
   - Rate your recall (Again, Hard, Good, Easy)
   - Cards move through Leitner boxes based on performance

---

## Spaced Repetition (Leitner System)

SmartReader uses a 5-box Leitner system for optimal long-term retention.

### How It Works

```
Box 1 → Box 2 → Box 3 → Box 4 → Box 5 → Mastered!
(1 day)  (2 days) (4 days) (7 days) (14 days)
```

- **Correct answer**: Move to next box
- **Incorrect answer**: Return to Box 1
- **Mastered**: After stable performance in Box 5

### What Can Be Learned

| Item Type | Source |
|-----------|--------|
| Vocabulary | Vocabulary cards |
| Notes | Any note marked for review |
| Concepts | Extracted from AI analysis |
| Formulas | Math/science content |
| Problems | Practice problems |

### Daily Review

1. The app shows **due items** on the home dashboard
2. Click **Study Now** to begin your daily review
3. Items are presented as flashcards
4. Rate each item to update its schedule

### Progress Tracking

- View your **streak** (consecutive days studied)
- See **mastery percentages** per topic
- Track **box distribution** (how many items in each box)
- Review **learning velocity** (improvement rate)

---

## AI Chat Assistant

### Starting a Chat

1. Go to **Chat** in the sidebar
2. Click **New Chat**
3. Type your question or request

### Chat Features

| Feature | How to Use |
|---------|------------|
| General Q&A | Ask any question |
| Explain text | Paste text and ask for explanation |
| Summarize | "Summarize this article..." |
| Grammar check | "Check the grammar: ..." |
| Translation | "Translate to English: ..." |
| Quiz generation | "Create quiz questions about..." |

### In-Context Chat

When reading a book or browsing:

1. Open the **AI Bot** tab in the right sidebar
2. Chat has context of the current document
3. Ask questions like:
   - "Explain this paragraph"
   - "What are the key points?"
   - "Define [term] in this context"

### Skill Commands

Type `/` to see available skill commands:

| Command | Description |
|---------|-------------|
| `/summarize` | Summarize selected text |
| `/explain` | Get detailed explanation |
| `/grammar` | Check grammar |
| `/quiz` | Generate quiz questions |
| `/translate` | Translate text |
| `/mindmap` | Generate mind map structure |
| `/simplify` | Simplify text for easier reading |

---

## Knowledge Graph

The Knowledge Graph visualizes connections between your learning materials.

### Viewing the Graph

1. Go to **Knowledge** in the sidebar
2. The interactive graph shows:
   - **Nodes**: Concepts, notes, vocabulary, books
   - **Edges**: Relationships between items

### Graph Features

| Feature | Description |
|---------|-------------|
| Pan & Zoom | Mouse drag and scroll wheel |
| Click node | View details |
| Learning paths | See prerequisite chains |
| Weak concepts | Identify areas needing practice |
| Clusters | Related concepts grouped together |

### Memory Timeline

View your learning history:

1. Go to Knowledge > Memory Timeline tab
2. See consolidated memories over time
3. Identify gaps in review coverage
4. Track concept mastery progression

---

## Learning Plans

Create structured learning curricula for any topic.

### Creating a Learning Plan

1. Go to **Learning** in the sidebar
2. Click **Create New Plan**
3. Follow the wizard:

   **Step 1: Define Goal**
   - Enter learning goal name
   - Select domain (vocabulary, math, language, etc.)

   **Step 2: Select Material**
   - Upload files (CSV, JSON, TXT, Excel)
   - Select from your library
   - Import from URL (Quizlet, Anki Web)
   - Manual entry

   **Step 3: Import Items**
   - Preview and edit imported items
   - Map columns for CSV/Excel
   - Add tags and difficulty levels

   **Step 4: Set Commitment**
   - Daily study time (5-120 minutes)
   - Target completion date (optional)
   - Preferred study time

   **Step 5: Review & Create**
   - Review all settings
   - Enable notifications
   - Create the plan

### Managing Plans

- **Pause/Resume**: Temporarily stop a plan
- **Edit**: Modify plan settings
- **Archive**: Complete or archive old plans
- **Delete**: Remove a plan and its items

---

## Study Sessions

### Starting a Study Session

1. From Learning Plans, click **Study** on any plan
2. Or click **Study All** for all due items across plans
3. Choose session mode:

| Mode | Description |
|------|-------------|
| Standard | Review all due items |
| Quick | 5-10 minute burst (15 items max) |
| Focused | Single topic filter |
| Cram | All items regardless of schedule |

### During a Session

1. **Front of card** shows question/term
2. Press `Space` or click to **flip**
3. **Rate your answer**:
   - `1` Again (reset to Box 1)
   - `2` Hard (stay in box, shorter interval)
   - `3` Good (advance to next box)
   - `4` Easy (skip a box)

### Session Features

| Key | Action |
|-----|--------|
| `Space` | Flip card |
| `1-4` | Rate answer |
| `H` | Show hint |
| `R` | Pronounce word (TTS) |
| `S` | Skip card |
| `P` | Pause session |
| `Esc` | End session |

### AI Hints

Press `H` for progressive hints:
1. First letter
2. Category/type
3. Usage context
4. Partial reveal

### Session Summary

After completing a session:
- View accuracy percentage
- See items by difficulty
- Review mistakes
- Track your streak

---

## Browser & Web Bookmarks

### Built-in Browser

SmartReader includes a web browser for research and reading:

1. Go to **Browser** in the sidebar
2. Enter URL or search query
3. Browse normally

### Browser Features

| Feature | Description |
|---------|-------------|
| History tree | Visual navigation history |
| Reading mode | Simplified reading layout |
| Save as book | Save webpage for offline reading |
| Area capture | Capture sections as images |
| Smart Summary | AI-powered summary with animations |

### Smart Summary (Word Constellation)

1. Select text on a webpage
2. Right-click > **Smart Summary**
3. Watch words fly from source to summary
4. Vocabulary words glow gold
5. Save the summary as a note

### Paragraph Icons

Enable floating icons next to paragraphs:

1. Click the sparkle icon in browser toolbar
2. Icons appear next to substantive paragraphs
3. Click for quick actions:
   - Smart Summary
   - Mind Map
   - Entity Links

### Web Bookmarks

Save and organize web pages:

1. Click the bookmark icon while browsing
2. Choose a folder
3. Access from **Bookmarks** in sidebar
4. Organized in folder hierarchy

---

## Quiz System

### Taking Quizzes

1. Go to **Quiz** in the sidebar
2. Select a quiz or generate new questions
3. Answer questions
4. Review results

### Quiz Types

| Type | Description |
|------|-------------|
| Multiple Choice | Select correct answer |
| True/False | Judge statement accuracy |
| Fill in Blank | Complete the sentence |
| Short Answer | Type your response |

### Generating Quizzes

1. From any text or note, use `/quiz` command
2. Specify:
   - Number of questions (1-10)
   - Difficulty (easy, medium, hard)
   - Question types
3. AI generates questions from the content

### Quiz Modes

| Mode | Feedback |
|------|----------|
| Instant Result | See correct answer after each question |
| Scored | See results only at the end |

---

## Settings & Configuration

### AI Providers

Configure your preferred AI service:

1. Go to Settings > AI Providers
2. Select a provider (ChatGPT, Claude, Gemini, etc.)
3. Enter your API key
4. Choose default model
5. Test connection

### Reader Settings

| Setting | Options |
|---------|---------|
| Reader Level | Elementary, Middle, High School, College |
| Study Mode | General, Language, Math, Programming |
| Font Size | Adjustable per reader |
| Theme | Light, Dark, Sepia |

### Leitner Settings

| Setting | Description |
|---------|-------------|
| Review Speed | Adjust box intervals |
| Daily Goal | Target items per day |
| Notifications | Remind for due reviews |

### Data Management

- **Export**: Backup notes, vocabulary, bookmarks
- **Import**: Restore from backup
- **Clear Data**: Selectively clear notes, books, chats

### Graph Database

Configure the knowledge graph backend:

| Option | Description |
|--------|-------------|
| Kuzu (Default) | Embedded, no setup required |
| Neo4j | External server, more features |

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New note |
| `Ctrl+F` | Search |
| `Ctrl+,` | Open settings |
| `Ctrl+Q` | Quit application |

### Reader

| Shortcut | Action |
|----------|--------|
| `Left/Right` | Previous/Next page |
| `Ctrl+F` | Search in document |
| `Ctrl+B` | Toggle bookmark |
| `Ctrl+H` | Highlight selection |

### Study Session

| Shortcut | Action |
|----------|--------|
| `Space` | Flip card |
| `1` | Again |
| `2` | Hard |
| `3` | Good |
| `4` | Easy |
| `H` | Hint |
| `R` | Pronounce |
| `P` | Pause |
| `Esc` | End session |

### Chat

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `/` | Show skill commands |

---

## Troubleshooting

### Common Issues

#### App won't start

1. Check system requirements
2. Try running as administrator (Windows)
3. Check for conflicting software
4. Reinstall the application

#### AI features not working

1. Verify API key in Settings
2. Check internet connection
3. Ensure selected provider is online
4. Try a different AI provider

#### Books won't import

1. Check file format is supported (EPUB, PDF, DOCX)
2. Ensure file is not corrupted
3. Check file permissions
4. Try a smaller file first

#### Slow performance

1. Close unused tabs and features
2. Clear old data (Settings > Data Management)
3. Restart the application
4. Check available disk space

#### Graph database errors

1. The app uses embedded Kuzu by default (no setup needed)
2. If errors persist, check logs in:
   - Windows: `%APPDATA%\SmartReader\logs`
   - macOS: `~/Library/Logs/SmartReader`
   - Linux: `~/.config/SmartReader/logs`

### Getting Help

- **Documentation**: Check the `/docs` folder
- **Issues**: Report bugs at [GitHub Issues](https://github.com/your-repo/smart-reader-v2/issues)
- **Community**: Join discussions on GitHub

### Logs and Diagnostics

Access logs for debugging:

1. Go to Settings > About
2. Click "Open Logs Folder"
3. Share relevant log files when reporting issues

---

## Appendix

### File Locations

| Platform | Data Location |
|----------|---------------|
| Windows | `%APPDATA%\SmartReader` |
| macOS | `~/Library/Application Support/SmartReader` |
| Linux | `~/.config/SmartReader` |

### Database Files

| File | Purpose |
|------|---------|
| `sqlite_tables.db` | Main SQLite database |
| `kuzu_graph/` | Knowledge graph data |
| `chroma/` | Vector embeddings (if enabled) |

### Backup Recommendations

1. Regularly export your data (Settings > Export)
2. Back up the data folder periodically
3. Sync to cloud storage for safety

---

*SmartReader v1.0.2 - AI-Powered Smart Reader*

*For the latest updates and features, visit the project repository.*
