# Compiler dialects

Prompt IR is provider-neutral. The final compiler pass translates the same behavior and task into a structure suited to the selected provider.

This is intentionally not a collection of hand-written prompt templates.

## OpenAI

OpenAI targets render as Markdown sections.

Developer-style instructions place identity and stable behavior before task-specific context. User prompts lead with the concrete task.

This follows current OpenAI guidance that developer instructions carry application behavior and that Markdown headings can clarify prompt hierarchy.

Official source:

https://developers.openai.com/api/docs/guides/prompt-engineering

Verified: 2026-09-30

## Anthropic

Anthropic targets render each IR block in a descriptive XML tag.

The compiler keeps role, objective, task, context, output, and constraints independently addressable instead of placing unrelated material inside one generic instructions blob.

This follows current Claude prompting guidance recommending consistent, descriptive XML tags when prompts mix instructions, context, examples, and variable inputs.

Official source:

https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

Verified: 2026-09-30

## Gemini

Gemini targets also use a consistent XML structure, but ordering differs from Claude.

For standalone Gemini user prompts, stable policy comes first, supplied context precedes the concrete task, and task or output instructions appear late. This follows current Gemini guidance to keep prompts direct and well structured, prioritize critical behavioral constraints, and place specific questions after large context.

Official source:

https://ai.google.dev/gemini-api/docs/prompting-strategies

Verified: 2026-09-30

## Constraint optimization

Dialect rendering happens before final budget checks.

Balanced and Compact modes therefore measure the actual provider-specific text, including markup. Humanizer does not optimize against one generic representation and then discover that provider syntax pushed the final prompt over its limit.

## Rule

A provider dialect may change syntax and ordering. It must not silently change user intent, lower the priority of required constraints, or invent capabilities that the selected surface does not have.
