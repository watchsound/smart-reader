# Development Documentation

Development notes, decisions, and ongoing work tracking.

## Contents

### Development Notes

| Document | Description |
|----------|-------------|
| [development-note.md](development-note.md) | Ongoing development notes and decisions |

## Development Workflow

### Quick Start

```bash
# Install dependencies
npm install

# Start development
npm start

# Or start processes separately
npm run start:renderer  # Terminal 1
npm run start:main      # Terminal 2
```

### Key Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start dev mode with hot reload |
| `npm run build` | Build for production |
| `npm run package` | Package for distribution |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run rebuild` | Rebuild native modules |

### Development Tools

- **Hot Reload**: Webpack dev server on port 3000
- **DevTools**: Press `Ctrl+Shift+I` in app
- **React DevTools**: Available in development mode
- **Redux DevTools**: Integrated in Redux store

## Project Structure

See [Architecture Overview](../technical/ARCHITECTURE.md) for detailed structure.

```
src/
├── main/              # Electron main process
│   ├── main.ts        # Entry point
│   ├── preload.ts     # IPC bridge
│   ├── db/            # Database managers
│   ├── ipc/           # IPC handlers
│   ├── utils/         # Utilities
│   ├── brain/         # AI Learning Brain
│   └── skills/        # Skill system
├── renderer/          # React frontend
│   ├── views/         # Pages
│   ├── components/    # UI components
│   ├── api/           # IPC clients
│   ├── store/         # Redux
│   └── theme/         # MUI themes
└── commons/           # Shared code
```

## Development Guidelines

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Write JSDoc comments for public APIs
- Prefer functional components in React

### Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
test: test additions/changes
refactor: code refactoring
style: formatting changes
chore: maintenance tasks
```

### Testing

- Write tests for new features
- Maintain 80%+ coverage
- Run tests before committing: `npm test`

### Pull Requests

1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Run tests and linting
4. Submit PR with clear description

## Debugging

### Main Process

```bash
# Add to main process code
console.log('Debug info:', variable);

# Or use debugger
debugger;
```

Check logs in:
- Windows: `%APPDATA%\SmartReader\logs`
- macOS: `~/Library/Logs/SmartReader`
- Linux: `~/.config/SmartReader/logs`

### Renderer Process

Use Chrome DevTools:
- `Ctrl+Shift+I` - Toggle DevTools
- Console tab - View logs
- Sources tab - Debug with breakpoints
- Network tab - Monitor IPC calls

### Database Debugging

```bash
# SQLite
sqlite3 sqlite_tables.db ".schema"
sqlite3 sqlite_tables.db "SELECT * FROM books LIMIT 10;"

# Neo4j (if configured)
# Connect to Neo4j Browser at localhost:7474
MATCH (n) RETURN n LIMIT 25;
```

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Complete developer reference
- [Architecture Overview](../technical/ARCHITECTURE.md)
- [Testing Documentation](../testing/)

---

*For the latest development status, check [development-note.md](development-note.md)*
