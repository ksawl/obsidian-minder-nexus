# Nexus for Obsidian

Nexus is a powerful semantic knowledge graph and bidirectional linking engine for Obsidian. It allows you to define formal relationships between your notes, creating a structured ontology directly within your vault.

## Key Features

### 🔗 Semantic Linking
Define exactly *how* notes are related using two powerful syntaxes:
- **Semantic Alias**: `[[Note|type]]` — Uses the built-in alias syntax to define a relationship.
- **Dataview Inline Fields**: `type:: [[Note]]` — Compatible with the Dataview ecosystem.

### ✨ Visual Enhancements
Nexus makes your semantic connections visible and interactive:
- **Reading Mode Badges**: Semantic links are automatically styled with type-specific badges.
- **Live Preview Integration**: See relationship types directly in the editor as you type.
- **Hover Previews**: Native Obsidian page previews work seamlessly for all semantic links.
- **Dead Link Detection**: Visual indicators for semantic links that lead to non-existent notes.

### 🔄 Sync Master (Bidirectional Links)
Never lose track of a relationship. Nexus automatically manages bidirectional connections:
- **Properties Sync**: When you link A to B with type "supports", Nexus can automatically record "supported-by" (or the same type) in the properties of Note B.
- **Grouped Updates**: Optimized performance for batch operations and large files.

### 🔍 Backlinks Enhancer
A dedicated view that groups your backlinks by their semantic type, giving you instant clarity on how the current note sits within your knowledge web.

### 🛠️ Dead Link Watcher
A vault-wide scanner that identifies broken semantic links, helping you maintain a healthy and robust knowledge graph.

---

## Installation

1. Install via Community Plugins in Obsidian (Search for "Nexus").
2. Configure your **Trusted Types** in the Nexus settings tab (e.g., `supports`, `contradicts`, `part of`).
3. Enable the modules you need (Semantic Engine, Sync Master, etc.).

---

## Support & Sponsorship

Nexus is a labor of love by Kharizma & Latreia. If it helps you build a better second brain, consider supporting its development:

- [Buy me a coffee (Ko-fi)](https://ko-fi.com/kharizma)
- [Support on Boosty](https://boosty.to/kharizma)

---

## License

This project is licensed under the MIT License.
