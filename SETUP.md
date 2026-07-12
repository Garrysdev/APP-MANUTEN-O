# RG Maintenance — Guia de Setup (Fase 1 · Firebase)

## O que precisas de fazer (≈ 20 minutos)

O código está todo gerado (Next.js 15 + **Firebase**: Auth + Firestore). Precisas apenas de
criar o projeto Firebase gratuito, preencher o `.env.local` e ligar o deploy.

---

## PASSO 1 — GitHub (3 min)

1. Vai a **https://github.com** → cria conta (ou usa a que já tens)
2. Clica **"New repository"** · Nome: `rg-maintenance` · **Private** · Create
3. Na pasta `rg-maintenance`, executa:

```bash
git init
git add .
git commit -m "feat: Fase 1 — RG Maintenance (Firebase)"
git branch -M main
git remote add origin https://github.com/SEU-UTILIZADOR/rg-maintenance.git
git push -u origin main
```

---

## PASSO 2 — Projeto Firebase (8 min)

1. Vai a **https://console.firebase.google.com** → **Add project** → nome `rg-maintenance`
   (podes desativar o Google Analytics). **Não precisa de cartão.**
2. **Authentication** → Get started → **Sign-in method** → ativa **Email/Password**.
3. **Firestore Database** → Create database → modo **Production** → região **eur3 (Europe)**.
4. **Regras do Firestore:** cola o conteúdo de `firestore.rules` (separador Rules → Publish).
5. **Credenciais CLIENTE (web):** Project Settings (⚙️) → "Os teus apps" → Web (`</>`) →
   regista a app → copia o objeto `firebaseConfig` para o `.env.local` (ver `.env.example`,
   variáveis `NEXT_PUBLIC_FIREBASE_*`).
6. **Credenciais ADMIN (servidor):** Project Settings → **Service accounts** →
   **Generate new private key** → do JSON descarregado preenche no `.env.local`:
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (entre aspas, com `\n`).

Copia `.env.example` → `.env.local` e preenche os valores. Depois `npm run dev`.

---

## PASSO 3 — Vercel (5 min)

1. **https://vercel.com** → login com GitHub → **Add New Project** → importa `rg-maintenance`
2. Em **Environment Variables**, adiciona **todas** as variáveis do `.env.local`
   (as `NEXT_PUBLIC_FIREBASE_*` + as 3 de Admin).
3. **Deploy** → aguarda ~2 min.

---

## PASSO 4 — Criar empresa + utilizador de teste (3 min)

1. **Authentication → Users → Add user** com o teu e-mail + password.
   Copia o **User UID** gerado.
2. **Firestore → Start collection** `companies` → cria um documento (ID à escolha, ex.
   `demo`) com os campos:
   `name` (string) "Empresa Demo", `slug` "empresa-demo", `plan` "starter",
   `maxTechnicians` (number) 5, `createdAt` (string) data ISO.
3. Coleção `users` → cria documento com **ID = o User UID** do passo 1, campos:
   `companyId` "demo", `email`, `name` "Rui Garrido", `role` "manager",
   `active` (bool) true, `createdAt` (string) ISO.

> Na Fase 2 isto passa a um ecrã de registo que cria empresa + gestor automaticamente.

---

## PASSO 5 — Verificar Gate A1

Acede ao URL do Vercel, faz login. Se o dashboard carregar → **Gate A1 aprovado**.
Cria um equipamento em **Equipamentos** e uma tarefa em **Tarefas & Plano** para confirmar o CRUD.

Responde "A1 aprovado" ao Claude para avançar para a Fase 2.

---

## Ficheiros-chave desta fase

| Ficheiro | Descrição |
|---|---|
| `src/lib/firebase/client.ts` | Firebase client SDK (auth no browser) |
| `src/lib/firebase/admin.ts` | Admin SDK (servidor, lazy init) |
| `src/lib/firebase/session.ts` | Verificação do cookie de sessão + perfil |
| `src/lib/firebase/data.ts` | Acesso a dados scoped por empresa |
| `src/app/api/auth/session/route.ts` | Troca idToken→cookie de sessão / logout |
| `src/middleware.ts` | Proteção leve de rotas (presença de sessão) |
| `src/types/models.ts` | Tipos do domínio (Company, Asset, Task, …) |
| `src/app/dashboard/assets/` | CRUD Equipamentos |
| `src/app/dashboard/tasks/` | CRUD Tarefas / Plano de Manutenção |
| `firestore.rules` · `firestore.indexes.json` | Segurança e índices Firestore |
| `.env.example` | Template das variáveis de ambiente |
