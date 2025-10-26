# Mask-Layout to Process-Flow Generator

Automated generation of nanofabrication process flows from GDS-II mask layouts.

## Project Structure

```
fab-process-generator/
├── src/
│   ├── gds_parser.js          # Node.js script to parse GDS-II (simplified)
│   ├── recipe_db.json         # JSON database of standard fab recipes
│   └── process_planner.js     # Logic to generate process flow
├── cli/
│   └── generate_flow.js       # CLI entry point
├── README.md
└── package.json               # Node.js dependencies
```

## Overview

Automatically generates nanofabrication process flows from mask layout files, using a database of standard recipes.

## License

MIT License
