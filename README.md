# 🛣️ Pave Path Progress

> Plataforma de acompanhamento e gestão de progresso de obras de pavimentação.

![TypeScript](https://img.shields.io/badge/TypeScript-96.8%25-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?style=flat-square&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## 📋 Sobre o Projeto

**Pave Path Progress** é uma aplicação web para monitoramento e gestão do progresso de obras viárias e de pavimentação. A plataforma permite acompanhar o avanço de trechos, registrar etapas concluídas e visualizar métricas de progresso em tempo real.

---

## 🚀 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vitejs.dev/) |
| Estilização | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Backend / Auth / DB | [Supabase](https://supabase.com/) |
| Package Manager | [Bun](https://bun.sh/) |
| Testes | [Vitest](https://vitest.dev/) |

---

## ⚙️ Pré-requisitos

- [Node.js](https://nodejs.org/) v18+ **ou** [Bun](https://bun.sh/) v1+
- Conta no [Supabase](https://supabase.com/) com projeto criado
- Variáveis de ambiente configuradas (ver seção abaixo)

---

## 🛠️ Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/KingKratus/pave-path-progress.git

# 2. Acesse o diretório
cd pave-path-progress

# 3. Instale as dependências
npm install
# ou, usando Bun:
bun install

# 4. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Supabase

# 5. Inicie o servidor de desenvolvimento
npm run dev
# ou:
bun dev
```

A aplicação estará disponível em `http://localhost:5173`.

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

> ⚠️ **Nunca** exponha sua `service_role` key no frontend.

---

## 📁 Estrutura do Projeto

```
pave-path-progress/
├── public/              # Assets estáticos
├── src/
│   ├── components/      # Componentes reutilizáveis (shadcn/ui + customizados)
│   ├── pages/           # Páginas da aplicação
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilitários e configurações (Supabase client, etc.)
│   └── types/           # Tipos TypeScript globais
├── supabase/
│   └── migrations/      # Migrations do banco de dados (PLpgSQL)
├── .env                 # Variáveis de ambiente (não versionar)
├── vite.config.ts       # Configuração do Vite
├── tailwind.config.ts   # Configuração do Tailwind
└── vitest.config.ts     # Configuração de testes
```

---

## 🧪 Testes

```bash
# Executar todos os testes
npm run test

# Modo watch
npm run test:watch
```

---

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`.

---

## ☁️ Deploy

### Via Lovable
Abra o [projeto no Lovable](https://lovable.dev) e clique em **Share → Publish**.

### Manual (Vercel / Netlify)
1. Faça o build: `npm run build`
2. Aponte a plataforma para a pasta `dist/`
3. Configure as variáveis de ambiente na plataforma escolhida

---

## 🗄️ Banco de Dados

As migrations do Supabase estão em `supabase/migrations/`. Para aplicá-las:

```bash
# Instale a Supabase CLI
npm install -g supabase

# Aplique as migrations no projeto remoto
supabase db push
```

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit suas alterações: `git commit -m 'feat: adiciona minha feature'`
4. Push para a branch: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

## 👤 Autor

**KingKratus** — [@KingKratus](https://github.com/KingKratus)
