---
name: brainstorm
description: Generate diverse, out-of-the-box insights using cognitive enhancement strategies. Analyzes topics to select optimal thinking strategies and generates structured insights.
parameters:
  - name: topic
    type: string
    required: true
    description: The topic or question to brainstorm about
  - name: mode
    type: string
    enum: [interactive, direct]
    default: direct
    description: Interactive asks follow-up questions first, direct generates immediately
  - name: depth
    type: string
    enum: [surface, intermediate, deep, profound]
    default: deep
    description: How deep to explore the topic
  - name: strategyCount
    type: number
    default: 3
    description: Number of cognitive strategies to apply (1-5)
  - name: context
    type: string
    description: Additional context about the topic (e.g., constraints, background)
category: ai
user-invocable: true
---

# Brainstorm Skill

Generate diverse, out-of-the-box insights using cognitive enhancement strategies for the provided topic.

## Process

### Step 1: Analyze the Topic

Analyze the topic to detect:
- **Domain**: scientific, business, creative, technical, philosophical, or general
- **Question Type**: what-if, why, how-to, improve, explain, compare, creative, general
- **Complexity**: simple, moderate, complex

### Step 2: Select Strategies

Based on the analysis, select optimal cognitive strategies:

| Strategy | Best For |
|----------|----------|
| assumption_challenge | Challenging hidden assumptions, philosophical questions |
| semantic_expansion | Exploring word meanings, definitional questions |
| adversarial_questioning | Finding counter-arguments, improving ideas |
| causal_analysis | Understanding why/causes, scientific questions |
| analogical_reasoning | Finding parallels, creative solutions |
| knowledge_graph | Exploring relationships, technical topics |
| scenario_simulation | What-if questions, future planning |
| mental_model | Building frameworks, complex problems |

**Selection guide:**
- "what if" → scenario_simulation, assumption_challenge, causal_analysis
- "why" → causal_analysis, assumption_challenge, knowledge_graph
- "how to" → analogical_reasoning, knowledge_graph, mental_model
- "improve" → adversarial_questioning, assumption_challenge, scenario_simulation
- Business topics → scenario_simulation, adversarial_questioning, mental_model
- Technical topics → knowledge_graph, causal_analysis, mental_model

### Step 3: Generate Insights

For each selected strategy, generate 3-5 insights that:
- Reference provided context (if available)
- Respect stated constraints
- Go beyond surface-level thinking
- Challenge conventional wisdom
- Are actionable when appropriate

### Step 4: Synthesize

Find patterns and highlight:
- Convergent themes across strategies
- Unique perspectives from each strategy
- Recommended next actions

## Output Format

Return your response as a JSON object:

```json
{
  "topic": "The brainstorming topic",
  "analysis": {
    "domain": "business",
    "questionType": "improve",
    "complexity": "moderate"
  },
  "strategies": [
    {
      "name": "assumption_challenge",
      "rationale": "Good fit for improvement questions",
      "insights": [
        {
          "title": "Challenge the status quo",
          "description": "Detailed insight...",
          "actionable": true
        }
      ]
    }
  ],
  "synthesis": {
    "convergentThemes": ["Theme 1", "Theme 2"],
    "uniquePerspectives": {
      "assumption_challenge": "Distinctive insight",
      "scenario_simulation": "Different angle"
    },
    "recommendedActions": [
      "Action 1",
      "Action 2"
    ]
  }
}
```

## Guidelines

1. **Depth Levels**:
   - **surface**: Quick, high-level insights (2-3 per strategy)
   - **intermediate**: Balanced exploration (3-4 per strategy)
   - **deep**: Thorough analysis (4-5 per strategy)
   - **profound**: Exhaustive, paradigm-challenging (5+ per strategy)

2. **Context Usage**:
   - If context is provided, tailor insights to those constraints
   - Reference specific details from context in insights
   - Skip generic advice that doesn't apply to the context

3. **Quality Criteria**:
   - Each insight should add unique value
   - Avoid repetition across strategies
   - Balance theoretical and practical insights
   - Include both quick wins and long-term considerations

4. **Reader Level Awareness**:
   - Adapt vocabulary complexity to the reader's level
   - Elementary: Simple terms, concrete examples
   - Middle: Some technical terms with explanations
   - College: Full technical vocabulary, abstract concepts

## Examples

### Example 1: Business Topic
```
Topic: How can we improve customer retention?
Context: B2B SaaS, 15% annual churn, small team

Analysis:
- Domain: business
- Question Type: improve
- Complexity: moderate

Selected Strategies:
1. adversarial_questioning - Challenge retention assumptions
2. assumption_challenge - Question what "retention" really means
3. scenario_simulation - Model different retention scenarios
```

### Example 2: Technical Topic
```
Topic: Why is our API response time increasing?

Analysis:
- Domain: technical
- Question Type: why
- Complexity: simple

Selected Strategies:
1. causal_analysis - Trace the cause chain
2. knowledge_graph - Map system dependencies
3. assumption_challenge - Question performance assumptions
```

### Example 3: Creative Topic
```
Topic: How can we make our product more engaging?

Analysis:
- Domain: creative
- Question Type: how_to
- Complexity: moderate

Selected Strategies:
1. analogical_reasoning - Learn from other engaging products
2. scenario_simulation - Imagine ideal user experiences
3. assumption_challenge - Question what "engaging" means
```
