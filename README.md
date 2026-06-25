# 🌊 Barraca Delícias do Mar — Sistema de Gestão de Restaurantes

Bem-vindo à documentação oficial do **Barraca Delícias do Mar**, um sistema completo e de alta performance projetado para a gestão moderna de restaurantes, quiosques de praia e barracas. Desenvolvido com uma arquitetura robusta, o sistema oferece fluxos de trabalho específicos e otimizados para três perfis essenciais: **Clientes**, **Garçons** e **Administradores (Co-Master)**.

---

## 🚀 Tecnologias Utilizadas

A aplicação foi desenvolvida utilizando as melhores práticas do ecossistema moderno do React:

- **Framework**: [React 18](https://react.dev/) com o empacotador ultrarrápido [Vite](https://vite.dev/).
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/) para design responsivo, elegante e de alto contraste.
- **Animações**: [Framer Motion](https://motion.dev/) (através de `motion/react`) para transições suaves, efeitos de toque e feedbacks táteis.
- **Ícones**: [Lucide React](https://lucide.dev/) para uma biblioteca consistente de ícones vetoriais.
- **Banco de Dados & Autenticação**: [Firebase](https://firebase.google.com/) (Firestore para tempo real, Authentication para login e cadastro seguro).
- **Sincronização Secundária**: Integração nativa de backup com [Supabase](https://supabase.com/).
- **Gráficos**: [Recharts](https://recharts.org/) e [D3.js](https://d3js.org/) para relatórios financeiros e de consumo dinâmicos.

---

## 📂 Estrutura do Projeto

A organização de arquivos segue o padrão modular para assegurar escalabilidade e fácil manutenção:

```text
├── .env.example                 # Exemplo de configuração das variáveis de ambiente
├── firebase-applet-config.json  # Credenciais de conexão do projeto Firebase
├── firebase-blueprint.json      # Esquemas de banco de dados para provisionamento
├── firestore.rules              # Regras de segurança robustas do Firestore
├── package.json                 # Scripts de desenvolvimento, compilação e dependências
├── src/
│   ├── App.tsx                  # Ponto de entrada do React, roteamento de páginas e contexto de autenticação
│   ├── main.tsx                 # Inicializador da aplicação no DOM
│   ├── index.css                # Configuração global de fontes (Inter, Space Grotesk) e diretivas do Tailwind
│   ├── types.ts                 # Definição estrita de interfaces TypeScript (User, Table, Order, etc.)
│   ├── constants.ts             # Dados estáticos iniciais (cardápio padrão com peixes, carnes, bebidas)
│   ├── firebase.ts              # Driver inteligente unificado (Bypass com simulador local caso offline/sem Firebase)
│   ├── supabaseSync.ts          # Utilitários de sincronização em tempo real de coleções com o Supabase
│   ├── components/              # Componentes de interface compartilhados
│   │   ├── Navbar.tsx           # Barra de navegação com perfil e deslogue inteligente
│   │   ├── Footer.tsx           # Rodapé elegante com informações do estabelecimento
│   │   ├── Logo.tsx             # Identidade visual náutica estilizada
│   │   ├── ReviewModal.tsx      # Modal de avaliação de pedidos em 5 estrelas
│   │   └── Toast.tsx            # Sistema customizado de notificações visuais ("Toast")
│   └── pages/                   # Páginas/Telas principais do sistema
│       ├── LoginPage.tsx        # Tela de acesso unificado por guias (Cliente, Garçom, Admin)
│       ├── CustomerPage.tsx     # Área interativa de autoatendimento para o Cliente
│       ├── WaiterPage.tsx       # Painel de atendimento rápido e controle de pedidos para o Garçom
│       ├── AdminPage.tsx        # Dashboard financeiro e administrativo para o Co-Master
│       └── MenuPage.tsx         # Visualização limpa do cardápio público
```

---

## 🔑 Perfis de Acesso e Funcionalidades

### 1. 🌊 Área do Cliente (`CustomerPage`)
Focada em proporcionar uma experiência de consumo ágil e interativa direto na mesa:
- **Vínculo à Mesa**: O cliente insere o número da mesa ou faz o escaneamento para vincular-se e iniciar o consumo.
- **Pedido Autônomo**: Navegação detalhada por categorias (Peixes, Carnes, Bebidas, Tira-Gostos) com imagens, descrição e adição ao carrinho com cálculo automático.
- **Chamado ao Garçom**: Envio instantâneo de alerta para o painel dos garçons em caso de dúvidas ou assistência.
- **Fechamento de Conta**: Solicitação de encerramento de conta que calcula taxas de serviço (10%) e notifica o staff.
- **Avaliações (Feedback)**: Possibilidade de avaliar cada pedido realizado com nota (1 a 5 estrelas) e comentário.

### 2. 盆 Área do Garçom (`WaiterPage`)
A ferramenta ideal para os colaboradores na linha de frente:
- **Painel de Mesas**: Grade em tempo real contendo o status de cada mesa (`Livre`, `Ocupada`, `Conta Solicitada`, `Paga`).
- **Gestão de Notificações**: Alertas visuais e sonoros de fechamentos e chamados de assistência ordenados por horário.
- **Atendimento**: Atribuição rápida de garçons a mesas específicas.
- **Pedidos**: Acompanhamento de pedidos ativos e possibilidade de atualizá-los ou finalizá-los.

### 3. 🛡️ Área do Administrador / Co-Master (`AdminPage`)
O cérebro financeiro e gerencial do restaurante:
- **Dashboard Financeiro**: Gráficos analíticos de faturamento diário, volume de pedidos, tíquete médio e desempenho por categoria de prato.
- **Gestão do Cardápio**: Adicionar novos itens, alterar preços, atualizar descrições, mudar fotos e gerenciar a disponibilidade na cozinha.
- **Gestão de Equipe**: Controle de usuários cadastrados, atribuição de cargos (`Admin`, `Garçom`, `Cliente`) e ativação/desativação de funcionários.
- **Sincronização e Sementes**: Ferramentas de emergência para restaurar o cardápio padrão ou sincronizar dados críticos com o Supabase.

---

## 💾 Driver Inteligente Firebase (`src/firebase.ts`)

Para garantir que o aplicativo funcione perfeitamente sob qualquer circunstância (mesmo sem credenciais do Firebase configuradas ou em ambientes de testes sem internet), criamos o **Driver Inteligente**:

1. **Modo Simulação (Mock)**: Se o arquivo `firebase-applet-config.json` contiver valores genéricos ou vazios, o driver ativa automaticamente o modo simulador local. Todos os dados (usuários, mesas, pedidos) são gravados e persistidos de forma reativa no `localStorage` do navegador.
2. **Auto-Heal & Conta Master**: O e-mail administrativo principal `edinelsonept@gmail.com` com senha `@Coelho60` é assegurado pelo sistema. Se o banco Firebase real for conectado, na primeira tentativa de login o sistema cria e configura automaticamente o perfil de Co-Master no Firestore com regras e privilégios totais de escrita.
3. **Tratamento de Erros Robusto**: Se houver perda repentina de internet, o driver intercepta os erros de timeout/offline do Firebase SDK e faz fallback transparente para leituras do cache nativo ou localStorage, evitando telas de travamento para o usuário.

---

## 🛠️ Configuração e Instalação

### Pré-requisitos
Certifique-se de possuir o [Node.js](https://nodejs.org/) instalado na versão 18 ou superior.

### Instalação de Dependências
```bash
npm install
```

### Executar em Desenvolvimento
```bash
npm run dev
```
O servidor de desenvolvimento iniciará na porta padrão `3000`.

### Compilação de Produção
```bash
npm run build
```
Os arquivos otimizados serão gerados na pasta `dist/`.

### Iniciar Servidor de Produção
```bash
npm run start
```

---

## 🔒 Variáveis de Ambiente e Credenciais

Caso queira configurar a persistência em servidores reais de nuvem, renomeie o arquivo `.env.example` para `.env` e defina as variáveis de conexão com o Supabase e seu projeto Firebase:

```env
# Configurações do Supabase (Opcional - Sincronização de segurança)
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_supabase
```

As credenciais do Firebase devem ser configuradas no arquivo `/firebase-applet-config.json` com a estrutura padrão fornecida pelo console do Firebase.

---

*Desenvolvido com dedicação para a **Barraca Delícias do Mar**.* 🌊🍤🍹
