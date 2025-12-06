# 8004 Agents Explorer

A web app to discover and explore AI agents registered on the ERC-8004 protocol.

{add-screenshot}

## What is ERC-8004?

ERC-8004 is an Ethereum standard for on-chain AI agent identity. Agents get a unique identity, metadata, reputation scores, and trust models—making them discoverable and verifiable on-chain.

🔗 [Demo](https://erc-8004-explorer.vercel.app)

## Features

- 🔍 **Search** - Find agents by name
- 🏷️ **Filters** - Filter by reviews, API endpoints
- 📄 **Pagination** - Configurable page sizes
- ⭐ **Reviews** - View agent ratings and feedback
- 🔗 **Endpoints** - See MCP and A2A API endpoints
- 🌙 **Dark UI** - Clean, minimal dark theme

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Eversmile12/8004-explorer
cd 8004-agent-explorer

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **The Graph** - Blockchain data indexing
- **Lucide** - Icons

## Project Structure

```
src/
├── app/
│   ├── agent/[id]/page.tsx   # Agent detail page
│   ├── page.tsx              # Listing page
│   └── layout.tsx            # Root layout
├── components/
│   └── PageSizeSelect.tsx    # Page size dropdown
└── lib/
    └── subgraph.ts           # GraphQL client
```

## Data Source

Agent data is fetched from the [Agent0 subgraph](https://thegraph.com/explorer/subgraphs/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT) on Ethereum Sepolia.

## Tutorial

Want to build this from scratch? Check out the step-by-step tutorial:

📖 [**TUTORIAL.md**](./TUTORIAL.md)

## License

MIT
