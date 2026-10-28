# 2026-10-23 — App no telemóvel: retomar sem "recarregar"

**Problema (Rui, Android):** ao mudar de app e voltar, a RG mostrava o logo como se arrancasse de novo.

**Causa:** o Android fecha a PWA em segundo plano para libertar memória. Ao voltar, a app arranca do zero no `start_url` (/dashboard). Isto juntava-se a outros fatores:
- `reloadOnOnline: true` recarregava a página quando a rede voltava.
- Cada deploy obriga a um recarregamento, o que hoje aconteceu várias vezes.
- Voltar à app descarregava sempre os equipamentos (até 2000).

**Feito (commit a8e9c45, em produção):**
- `AppResume.tsx`:
  - Guarda a última página aberta.
  - Ao abrir a app instalada, reabre essa página se tiver sido vista há menos de 12 h.
  - Se a página veio da cache, pede logo os dados frescos.
- Service worker: nova regra `pages-nav` (NetworkFirst com timeout de 4 s). Com rede lenta abre a última versão guardada em vez de ficar no logo.
- `reloadOnOnline: false`.
- Sincronização offline:
  - Os dados de referência só se descarregam a cada 30 min.
  - A contagem de pendentes lê só os documentos marcados.
  - Os ouvintes de "voltar à app" deixaram de se acumular.

**Limite:** impedir o Android de fechar a app não é possível numa PWA. O que mudou foi o regresso, que agora é mais rápido e abre no sítio certo.
