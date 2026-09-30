# Profiles

Behavior profiles are structured configuration. They are not stored prompt text.

## Root profiles

A root profile owns all of its behavior values.

Editing a root changes the resolved behavior for every derived profile that still inherits the edited field.

## Derived profiles

A derived profile points to one base profile.

When it is created, every behavior field inherits from the base. The derived profile therefore follows future base changes automatically.

Editing a value in Humanize creates a local override for that field only.

Example:

```text
Principal Engineer
  Directness 92
  Verification 96

Backend Engineer
  inherits Principal Engineer
  Humor 4
```

If Principal Engineer later changes Verification to 100, Backend Engineer resolves to Verification 100 while keeping its local Humor 4.

## Reset overrides

Reset overrides returns every behavior field to inheritance. It does not copy the current base values into permanent local values.

## Detach

Detach resolves the full profile once and turns it into an independent root.

Use detach when a variant should stop following its base.

## Duplicate

Duplicate creates an independent materialized copy. It does not preserve the inheritance link.

Use Derive when future base changes should continue to flow. Use Duplicate when they should not.

## Delete behavior

Deleting a profile never leaves its direct children with a dangling base reference.

Direct children are detached first using their currently resolved behavior. Profiles derived from those children continue to work through the newly detached parent.

## Import and export

A single exported profile is portable. Derived profiles are materialized before export so the file does not depend on another local profile that may not exist on the destination machine.

Schema v1 and v2 profile files migrate to schema v3 as independent root profiles.
