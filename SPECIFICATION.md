# 📋 Especificação Funcional do Sistema (Requisitos & Regras de Negócio)

Este documento detalha o comportamento esperado de cada componente, rotina e elemento visual do projeto.

---

## 1. Pipeline de Coleta e Tratamento de Dados (ETL & Automations)

### 1.1. Automação via GitHub Actions (`coleta.yml`)
* **Agendamento Rápido:** Executado de hora em hora (`cron: '21 * * * *'`) para buscar vídeos recém-publicados nos canais monitorados.
* **Varredura Completa Diária:** Executada de madrugada (`cron: '21 3 * * *'`) para auditar a base inteira e reconciliar vídeos privados, não listados ou removidos (`privacyStatus: 'removed'`).
* **Disparo Manual (`workflow_dispatch`):** Permite executar apenas o tratamento (`tratador.js`) ou forçar varredura completa.

### 1.2. Módulo Importador (`importador.js`)
* **Fontes:** Coleta vídeos via YouTube Data API v3 dos canais configurados.
* **Early Exit (Parada Antecipada):** Na checagem rápida, assim que encontra um vídeo já conhecido na base, encerra a busca no canal para economizar a quota da API.
* **Persistência:** Salva o resultado bruto em `videos_bruto.json`.

### 1.3. Módulo Tratador e Deduplicação (`tratador.js`)
* **AutoMaster (Cronológico):** Ordena os vídeos por data de publicação; o vídeo mais antigo de um grupo é eleito como `Master Original` (`isMaster: true`).
* **Critérios de Deduplicação Automática:**
  * **Critério A:** Títulos idênticos com variação de duração <= 2 minutos.
  * **Critério B:** Substrings/Reenvios com variação de duração <= 5 minutos.
  * **Critério C:** Algoritmo de Jaccard com similaridade de texto >= 75% e duração <= 2 minutos.
  * **Trava de Segurança:** Se os vídeos possuírem numerações de episódios/partes distintas (ex: *Parte 1* vs *Parte 2*), a aglutinação é bloqueada.
* **Overrides Manuais (`overrides.json`):** Permite forçar ou corrigir agrupamentos de vídeos manualmente informando quem deve ser o `masterId`.
* **Taxonomia (`taxonomia.json`):** Injeta categorias e marcadores nos vídeos processados antes de gerar a base final `database.json`.

---

## 2. Painel Administrativo de Taxonomia (`admin.html`)

* **Finalidade:** Interface gráfica leve para atribuição rápida de categorias e tags por vídeo.
* **Formato do Input:** Aceita valores no formato `cat:Categoria | grupo:Nome | #tag`.
* **Exportação:** Gera e baixa diretamente o arquivo `taxonomia.json` atualizado para ser commitado no repositório.

---

## 3. Interface Principal do Usuário (`index.html` & Módulos JS)

### 3.1. Barra de Controles e Filtros
* **Campo de Busca (`searchInput`):** Filtro por texto em tempo real (busca fuzzy em títulos). Possui botão `✕` para limpar o texto digitado.
* **Modo de Exibição (`viewModeSelect`):**
  * **Consolidado:** Oculta duplicados e agrupa edições do mesmo vídeo em gavetas retráteis.
  * **Sequência Mesclada:** Exibe todos os vídeos em ordem cronológica pura.
  * **Sequência Separada:** Agrupa e exibe vídeos divididos por cabeçalhos de canal.
* **Ordenação (`sortBySelect` & `sortOrderBtn`):** Ordena por Data, Título, Duração, Categoria ou Status. Permite alternar a direção entre Crescente (`Asc ▲`) e Decrescente (`Desc ▼`).
* **Filtro de Grupos/Taxonomia (`taxonomyModalBtn`):** Abre modal com checkboxes para ocultar/exibir categorias específicas.
* **Filtro de Canais (`channelsModalBtn`):** Abre modal com checkboxes para ocultar/exibir canais específicos.

### 3.2. Autenticação & Progresso do Usuário
* **Estado Deslogado:** Exibe o botão `Entrar`. Os seletores de status dos cards ficam desativados para edição.
* **Estado Logado:** Exibe o e-mail/nome do usuário e o botão `Sair`. Ativa a edição dos seletores de progresso nos cards.
* **Sincronização em Tempo Real:** Alterar o status de um vídeo salva a informação no Firebase Firestore (`users/{uid}`) e atualiza o cache local instantaneamente.
* **Backup/Restauração:** Botões para exportar o progresso em `.json` local ou importar um backup em arquivo.

### 3.3. Cards de Vídeo
* **Borda Lateral Colorida:** Identifica visualmente a categoria do vídeo.
* **Seletor de Status:** Permite marcar como `Status...`, `Visto` (Verde), `Alta` (Vermelho), `Média` (Laranja) e `Baixa` (Amarelo).
* **Gaveta Retrátil (`+N`):** Em cards com vídeos duplicados/reenviados, abre uma gaveta sanfonada listando as versões alternativas e transmissões correlatas.