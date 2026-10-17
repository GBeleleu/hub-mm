# 🏛️ Arquitetura do Projeto — [meuGuia]

Este documento especifica a estrutura, os contratos de integração, o fluxo de dados e as convenções do projeto. Todas as futuras modificações no código devem respeitar rigorosamente as diretrizes aqui estabelecidas.

---

## 1. Visão Geral da Pipeline de Dados

```text
[YouTube Data API / Fontes]
          │
          ▼
     importador.js (ETL - Coleta)
          │
          ▼
      tratador.js (ETL - Tratamento, Merges & Overrides)
          │
          ├──── overrides.json
          └──── taxonomia.json
          │
          ▼
    database.json (Base estática consumida pelo Frontend)
          │
          ▼
   Frontend Modular (GitHub Pages ES Modules + Firebase Firestore)
