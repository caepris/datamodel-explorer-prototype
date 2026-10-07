# DataModel Explorer Prototype

A browser prototype for product managers to see how Roblox Studio's Explorer and Properties panels represent the engine's DataModel, and to mock up how a product might appear in it. It is purely visual: nothing is executed, simulated, replicated, or saved.

Live site: https://caepris.github.io/datamodel-explorer-prototype/

## Make your own copy

This repository is a GitHub template. Engineers can duplicate it and change anything without affecting the shared demo.

1. Open the repo and choose **Use this template**, then **Create a new repository**.
2. Clone your new repo and run it locally:

```bash
npm install
npm run dev        # http://localhost:5173
```

3. Push to `main`. The included GitHub Actions workflow builds the site and deploys it. The first time, open the repo’s **Settings → Pages** and set **Source** to **GitHub Actions** if the deployment does not start on its own. Your copy is then served at `https://<your-user>.github.io/<your-repo>/`.

A fork works the same way if you want to propose changes back to this demo. **Restore class** and **Reset demo** only affect the browser session; nothing is written back to the repo until you commit.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # reducer + UI tests
npm run build      # typecheck and production build
```

## What you can do

- **Explorer:** expand and collapse the tree, filter by name or class, select, rename (double-click or F2), insert (hover +, header +, or Ctrl+I), duplicate (Ctrl+D), delete (Delete key or right-click), and drag instances onto new parents.
- **Properties:** properties are defined by the instance's class and its ancestor classes, grouped by category. Edit or reset their values with typed editors (text, multiline source, boolean, number/range, enum, Vector2/Vector3, CFrame, Color3, and instance references). Read-only and computed properties are dimmed.
- **Customize a class:** press **Customize** in Properties to add, edit, or delete properties for that instance type. Subclasses inherit the customization, existing and future instances update together, and **Restore class** clears that class's overlay.
- **Attributes:** add, rename, retype, edit, and remove custom per-instance key/value data.
- **Reset demo** restores the sample place; the walkthrough panel suggests a six-step PM tour.

## How it maps to the engine

| Engine concept | Prototype |
|---|---|
| `Instance` tree with a single `Parent` | `InstanceNode` with `parentId` and ordered `children` (`src/model/types.ts`) |
| `ClassDescriptor` / RIDL-generated reflection | Static class catalog with inheritance, creatability, and services (`src/model/classCatalog.ts`) |
| `PropertyDescriptor` flags (public, read-only, category) | `PropertySchema` with `hidden`, `readOnly`, `compute`, `category` |
| Product concept properties | Per-class overlays with additions, removals, and metadata/default overrides |
| `Instance::setParent` checks | Locked service parents, self-parenting, and circular-reference rejection (`src/model/dataModelReducer.ts`) |
| `Instance::destroy` | Recursive subtree removal, then invalid references are cleared |
| Attributes | Typed key/value list with the engine's naming rules |

The catalog includes common place instances plus MeshPart and PBR materials, rigid and layered accessory authoring (Attachments, WrapLayer, WrapTarget, SurfaceAppearance), Terrain, the complete reflected Constraint family, UI constraints, and CSG PartOperations. The seed place includes accessory, material, Terrain, constraint, and CSG demo trees. Built-in classes live in `classCatalog.ts` and `extendedClassCatalog.ts`; the Explorer, Insert dialog, and Properties panel pick them up automatically.

Out of scope: Luau execution, physics and the 3D viewport, replication and Team Create, RBXL import/export, packages, security/capabilities, undo/redo, and a live engine connection.
