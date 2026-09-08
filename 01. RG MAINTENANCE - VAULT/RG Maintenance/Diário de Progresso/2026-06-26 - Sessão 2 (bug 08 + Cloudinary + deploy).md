---
data: 2026-06-26
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, bug08, cloudinary, vercel, deploy]
sessao: diurna (com Rui presente)
---

# 2026-06-26 (Sessão 2) — Bug 08 (não grava equipamentos) + migração Cloudinary + deploy Vercel

## Diagnóstico do bug 08

- Sintoma (screenshot do Rui): criar equipamento "bomba" com foto → erro
  `Firebase Storage: Max retry time for operation exceeded (storage/retry-limit-exceeded)`.
- **Causa raiz:** o upload da foto ao Firebase Storage rebentava **antes** de gravar o registo, em
  `handleSubmit` (`uploadPhotoToStorage` → só depois `createAssetAction`), arrastando tudo. O ativo nunca era criado.
- A foto **já ia comprimida** (`lib/image.ts`, 1600px/JPEG72%, ~300 KB) — logo o erro **não era tamanho**.
- Confirmado na consola Firebase: projeto em **plano Spark**; **Storage exige upgrade para Blaze** (cartão).

## Decisão do Rui: Cloudinary (sem cartão) em vez de Firebase Storage

- `src/lib/upload.ts` (novo) — `uploadImage(file, folder)`: POST unsigned ao Cloudinary, devolve `secure_url`.
- 3 sítios migrados de Firebase Storage → Cloudinary, **todos não-bloqueantes** (registo grava sempre, foto é extra):
  - `dashboard/assets/AssetsClient.tsx` — foto de equipamento (pasta `assets`) + banner âmbar de aviso
  - `dashboard/profile/ProfileClient.tsx` — avatar (pasta `avatars`)
  - `dashboard/tasks/[id]/TaskDetailClient.tsx` — fotos de intervenção (pasta `interventions`)
- Limpeza: removido `getFirebaseStorage` de `src/lib/firebase/client.ts`; `next.config.ts` images →
  `res.cloudinary.com` (era resíduo `*.supabase.co`); `.env.example` + `.env.local` com 2 vars Cloudinary.
- `storage.rules`/entrada storage no `firebase.json` criadas e depois **revertidas** (não se usa Firebase Storage).
- `npm run build` verde, sem resíduos `firebase/storage`.

## Configuração Cloudinary (Rui executou)

- Cloud name `dqghwstk4`; preset **Unsigned** `rg-maintenance` (folder vazio — app passa a pasta por upload).
- `.env.local`: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dqghwstk4`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=rg-maintenance`.

## Deploy Vercel (o alvo é produção, não localhost)

- Projeto ligado ao Vercel via **CLI** (`.vercel/project.json`, `enea-spirit/rg-maintenance`), sem git.
- `vercel env add` das 2 vars Cloudinary em **Production**; `vercel --prod` → **READY**.
- Live: **https://rg-maintenance.vercel.app** com o código Cloudinary.

## Estado

- ✅ **Bug 08 FECHADO** — Rui confirmou "RG Maintenance ok" (fotos sobem em produção). Tarefa 08 marcada no Google Tasks.
- Lista CLAUDE_RG MAINTENANCE: **8/18** concluídas.
