# Built-in File-Based Skills

This directory contains file-based skills that are bundled with SmartReader.

## Directory Structure

Each skill has its own subdirectory containing a `SKILL.md` file:

```
resources/skills/
├── README.md
├── study_guide/
│   └── SKILL.md
├── flashcard_generate/
│   └── SKILL.md
└── <your_skill>/
    └── SKILL.md
```

## Adding a New Built-in Skill

1. Create a new directory with your skill name (snake_case)
2. Create a `SKILL.md` file inside with:
   - YAML frontmatter defining name, description, parameters
   - Markdown instructions for the AI

## SKILL.md Format

```markdown
---
name: my_skill
description: Brief description
parameters:
  - name: input
    type: string
    required: true
    description: Parameter description
category: ai
user-invocable: true
---

# My Skill

Instructions for the AI...
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `study_guide` | Create study guides with concepts, vocabulary, and questions |
| `flashcard_generate` | Generate flashcards for spaced repetition learning |

## Notes

- These skills are loaded automatically when the app starts
- They cannot be modified by users (bundled in app package)
- User skills in `~/.smartreader/skills/` take precedence if same name exists
