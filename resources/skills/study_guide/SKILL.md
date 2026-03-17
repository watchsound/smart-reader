---
name: study_guide
description: Create a comprehensive study guide from text content with key concepts, vocabulary, and review questions.
parameters:
  - name: text
    type: string
    required: true
    description: The text content to create a study guide from
  - name: focus
    type: string
    enum: [concepts, vocabulary, questions, all]
    default: all
    description: What to focus on in the study guide
  - name: difficulty
    type: string
    enum: [beginner, intermediate, advanced]
    default: intermediate
    description: Target difficulty level
category: ai
user-invocable: true
---

# Study Guide Generator

Create a comprehensive study guide from the provided text content to help students understand and retain key information.

## Output Structure

Based on the `focus` parameter, include these sections:

### If focus is "concepts" or "all":
**Key Concepts**
- List the main concepts with clear explanations
- Use simple language appropriate for the difficulty level
- Include examples where helpful

### If focus is "vocabulary" or "all":
**Important Vocabulary**
- Define key terms from the text
- Provide usage examples
- Note any related terms

### If focus is "questions" or "all":
**Review Questions**
- Create 3-5 questions that test understanding
- Include a mix of recall and comprehension questions
- Provide brief answer hints

## Difficulty Guidelines

- **beginner**: Use simple language, focus on basic concepts, provide many examples
- **intermediate**: Balance explanation with technical terms, moderate depth
- **advanced**: Use domain-specific terminology, explore nuances and connections

## Response Format

Use clear markdown formatting:
- Use headings (##, ###) for sections
- Use bullet points for lists
- Use **bold** for key terms
- Keep explanations concise but thorough
