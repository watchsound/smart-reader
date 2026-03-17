---
name: flashcard_generate
description: Generate flashcards for spaced repetition learning from text content. Creates question-answer pairs suitable for the Leitner system.
parameters:
  - name: text
    type: string
    required: true
    description: The source text to create flashcards from
  - name: count
    type: number
    default: 5
    description: Number of flashcards to generate (1-20)
  - name: style
    type: string
    enum: [definition, question, cloze, concept_map]
    default: question
    description: Style of flashcards to generate
  - name: language
    type: string
    default: english
    description: Language for the flashcards
category: ai
user-invocable: true
---

# Flashcard Generator

Generate high-quality flashcards from the provided text content for spaced repetition learning.

## Card Styles

### definition
Create term-definition pairs:
- Front: The term or concept name
- Back: Clear, concise definition with an example

### question
Create question-answer pairs:
- Front: A question testing comprehension
- Back: The complete answer

### cloze
Create fill-in-the-blank cards:
- Front: A sentence with a key term replaced by [...]
- Back: The missing term and brief explanation

### concept_map
Create concept relationship cards:
- Front: Two related concepts
- Back: Explanation of how they relate

## Output Format

Return your response as a JSON object:

```json
{
  "flashcards": [
    {
      "front": "Front of card (question/term/cloze)",
      "back": "Back of card (answer/definition)",
      "tags": ["optional", "tags"],
      "difficulty": "easy|medium|hard"
    }
  ],
  "summary": "Brief description of what these cards cover"
}
```

## Guidelines

1. Each card should test ONE concept or fact
2. Keep cards concise - front under 50 words, back under 100 words
3. Avoid ambiguous questions with multiple valid answers
4. Use the most important information from the text
5. Ensure cards are self-contained (don't require external context)
6. Vary difficulty levels across the set
7. Include relevant tags for organization
