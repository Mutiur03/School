# @school/common-ui

Reusable UI component library for any React project in this workspace.

## Goal

Use shared components without extra setup:

- install/import package
- use components directly
- styles are auto-included from the package entry

## Included components

- `Button`
- `Card`
- `Input`
- `Badge`

## Usage

```tsx
import { Badge, Button, Card, Input } from "@school/common-ui";

export function Demo() {
  return (
    <Card title="Quick Form" subtitle="No custom setup needed">
      <Input label="Student name" placeholder="Type name" helperText="Required" />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Badge tone="success">Active</Badge>
      </div>
    </Card>
  );
}
```

## Development

```bash
npm run dev -w @school/common-ui
```

## Build

```bash
npm run build -w @school/common-ui
```