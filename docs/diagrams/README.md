# System Architecture & Technical Diagrams

This directory contains technical architecture specifications and diagrams for the **Job Intelligence** platform.

---

## 📁 Available Diagram Documents

| File | Format | Description |
| :--- | :--- | :--- |
| **[backend-architecture-vertical.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/backend-architecture-vertical.md)** | `.md` | **Vertical Backend Architecture (PDF / Print Optimized):** Strictly Y-axis-oriented backend module flow designed for portrait PDF documents. Maps ingress, controllers, feature modules, domain services, workers, and infrastructure without horizontal sprawl. |
| **[backend-architecture.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/backend-architecture.md)** | `.md` | **Backend Modular Architecture:** In-depth backend-focused diagram mapping HTTP ingress, API controllers, NestJS feature modules, domain services, zero-mutation boundaries, shared libraries (`@app/*`), CLI workers, and external boundaries. |
| **[system-architecture.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/system-architecture.md)** | `.md` | **System Architecture Specification (C4 Container View):** Top-down architecture diagram covering clients, gateway, core domains, CLI workers, storage, and external integrations. |
| **[system-architecture-.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/system-architecture-.md)** | `.md` | **System Architecture (Detailed Layout):** Left-to-right (`flowchart LR`) complete architecture covering actors, client applications, API gateway, feature services, workers, storage, external integrations, and technical architecture logic notes. |
| **[pipeline-and-concurrency.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/pipeline-and-concurrency.md)** | `.md` | **Pipeline, Concurrency & Dataflow Architecture:** Sequence diagram breaking down advisory lock quota reservations, bounded streaming crawling, hybrid matching, and deduplicated SMTP notification delivery. |
| **[compact-architecture.md](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/docs/diagrams/compact-architecture.md)** | `.md` | **Compact Architecture:** Streamlined horizontal architecture visual and summary of key technical highlights. |

---

## 🛠️ Usage & Rendering

- **Mermaid Live Editor:** You can view, edit, or export any of the diagrams by opening [mermaid.live](https://mermaid.live) and pasting the Mermaid block.
- **Exporting to SVG / PNG:** For presentations or documentation exports, SVG provides lossless vector scaling at any resolution, or export high-resolution PNG @ 3x.
