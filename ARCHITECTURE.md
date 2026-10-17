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
```

---

## 2. Estrutura e Responsabilidade dos Arquivos Frontend

O frontend adota **ES Modules nativos (`type="module"`)** e está estritamente segregado por responsabilidades:

```text
/
├── index.html            # Markup semântico e barras de controle (sem CSS/JS inline).
├── admin.html            # Painel administrativo web para gestão visual do taxonomia.json.
├── css/
│   ├── main.css          # Variáveis CSS (Tema Escuro), reset, layout top-bar e container.
│   └── components.css    # Estilos de cards, badges, gavetas, seletores e modais.
├── js/
│   ├── state.js          # Objeto de estado global (state), configurações e cache.
│   ├── taxonomy.js       # Extrator/Parser de taxonomia (cat/grupo/tags) e lógica do modal.
│   ├── render.js         # Geração sintética do DOM dos cards, fuzzy search, ordenação e renderização.
│   └── app.js            # Ponto de entrada (bootstrap), event listeners do DOM e controle de estado.
└── firebase-config.js    # Inicialização do Firebase Auth, Firestore Listener e Hooks Globais.
```

---

## 3. Contrato de Escopo Global (`window`) e Integração Firebase

Como o projeto utiliza ES Modules, o isolamento de escopo exige que hooks de sincronização reativa com o Firebase Firestore sejam explicitamente anexados ao objeto `window`.

### 3.1. Variáveis Globais Expostas
* `window.currentUser` `(Object|null)`: Guarda a referência do usuário autenticado no Firebase Auth.
* `window.userProgressCache` `(Object)`: Dicionário `{ [videoId: string]: number }` contendo o status de progresso do usuário logado.

### 3.2. Funções Globais Expostas (Hooks do Firebase & Frontend)
* `window.renderList()`: Função de re-renderização completa da lista de vídeos (definida em `js/app.js` e consumida pelo listener `onSnapshot` no `firebase-config.js`).
* `window.loginWithGoogle()`: Aciona o popup de autenticação do Google.
* `window.logoutFromFirebase()`: Encerra a sessão e limpa os listeners ativados.
* `window.updateVideoProgress(videoId, selectedValue)`: Sincroniza a alteração do select do card com o cache local e o documento do usuário no Firestore (`users/{uid}`).
* `window.exportProgressJSON()` / `window.importProgressJSON(event)`: Utilitários de backup/restauração local de progresso.

---

## 4. Regras de Ouro para Alterações no Código (Guidelines)

1. **Manutenção de Escopo:** NENHUMA alteração deve remover as pontes de integração no objeto `window` sem um refatoramento explícito de módulos de importação/exportação no `firebase-config.js`.
2. **Edição Modular Concentrada:** Alterações visuais devem ser feitas **exclusivamente** nos arquivos dentro de `css/`. Alterações na renderização dos cards pertencem **exclusivamente** ao `js/render.js`.
3. **Preservação do `index.html`:** O arquivo HTML deve permanecer limpo, servindo apenas como estrutura e contendo apenas as chamadas `<script type="module">` no final do `<body>`.
4. **Trabalho por Branches:** Qualquer nova funcionalidade ou teste abrangente deve ser executado em uma branch separada (ex: `feature-*` ou `refatoracao-*`) antes do merge na branch `main`.