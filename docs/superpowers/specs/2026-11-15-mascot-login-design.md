# Login tecnológico com mascote — design aprovado

## Intenção

Substituir o cartão simples de Compras por uma experiência de acesso corporativo escura, com o mascote e o logo oficiais da Só Sal. A interação deve ter dois momentos: ao selecionar **Acessar plataforma**, o mascote puxa o formulário de baixo para cima; após a autenticação bem-sucedida, ele puxa o formulário novamente e revela a Central de Gestão. O usuário escolheu explicitamente a animação nos dois momentos.

## Abordagens

- **Escolhida — experiência em estágios:** recepção animada, formulário revelado pelo mascote, saída animada somente após autenticação válida. Oferece narrativa visual clara, sem confundir tentativas inválidas com sucesso.
- Formulário exposto com animação apenas na submissão: acesso um pouco mais direto, mas não cumpre a primeira entrada solicitada.
- Animação integral em vídeo: renderização rígida e pesada, além de pouco adaptável a celular e preferência por movimento reduzido.

## Restrições

- Usar os PNGs oficiais fornecidos; manter GIF original como loader.
- Não alterar o método de login, autorização Master, banco, políticas RLS ou variáveis de ambiente.
- A falha de login mantém o formulário e mostra erro, sem revelar o ERP.
- Entrada por teclado, foco visível, sem campos escondidos disponíveis ao teclado; `prefers-reduced-motion` abre e fecha sem movimento.
- CSS e componentes React existentes, sem dependências novas.
- Sem commit ou deploy sem autorização explícita.
