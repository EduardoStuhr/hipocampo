# Instalação 3D — 3 de novembro de 2026

A instalação segue o conceito aprovado em `installation-concept.webp`: fundo
preto, três mesas, cabideiro, luz dura e geladeira com luz vermelha. A mesa de luz
recebe fotografias, negativos e frascos de outras ilhas. São malhas WebGL reais,
com materiais e sombras; a imagem do conceito não é usada como fundo da cena.

## Arquivos de entrada

- `index.html`: stylesheet e import map que direciona somente o chunk antigo da
  instalação para o novo módulo. A URL compartilhada de React permanece a mesma.
- `public/assets/installation-room.js`: seção React, controles, memórias e
  alternativa acessível.
- `public/assets/installation-scene.js`: geometria, materiais, luzes, projeção,
  eventos, movimento entre ilhas e liberação de recursos WebGL.
- `public/assets/installation-room.css`: estilos limitados à instalação.
- `public/images/installation/`: texturas locais geradas de madeira e esmalte.
- `public/images/trail/photo-{1,2,3,4}.webp`: fotografias já existentes no projeto.

Os bundles recuperados e as outras seções não foram alterados. Usa-se o Three.js
local já empregado pela transição da casa, sem adicionar dependências de runtime.
O import map é suportado pelos navegadores atuais. A entrada antiga continua
intacta para restauração.

## Interações

- Mouse: arrastar um objeto de qualquer ilha até a mesa de luz; clicar lê sua
  memória. Soltar fora da mesa devolve à ilha. Arrastar o fundo gira a câmera.
- Toque: os alvos ampliados dos objetos aceitam arrastar; tocar lê a memória.
  O fundo mantém a rolagem vertical da página.
- Teclado: Tab encontra objetos; Enter/Espaço leva à mesa; setas deslocam;
  Escape devolve à ilha. “Explorar sem arrastar” lista todos os fragmentos.
- “Recompor a sala” restaura objetos, câmera e porta aberta. “Visão inicial”
  restaura somente a câmera. Abrir/fechar a porta controla a luz vermelha.
- A renderização é por demanda e para fora da tela/aba oculta. DPR limitado a
  1,5, shadow maps atualizados quando necessário e recursos liberados no unmount.
- Com movimento reduzido, as transferências e a porta mudam sem animação. Sem
  WebGL, a leitura de memórias continua disponível na lista de objetos.

As fotos da cliente podem substituir os quatro arquivos de fotografia usados
pela cena; outros objetos podem ser adicionados no catálogo `FRAGMENTS`.

## Executar e validar

Na pasta desta aplicação:

```bash
npm run dev
npm run build
```

O servidor usa por padrão `http://127.0.0.1:8443/`; a seção é `/#instalacao`.
`HOST` e `PORT` ajustam o endereço. `dist/` é um produto de build ignorado no Git.
O push no GitHub não comprova uma publicação em `kimi.page` ou outro provedor.

Com Python Playwright e Chromium instalados:

```bash
HOST=0.0.0.0 PORT=4173 npm run dev
python3 tools/installation-qa.py
```

`HIPOCAMPO_QA_URL` e `HIPOCAMPO_CHROME` permitem usar outro endereço e executável.
Capturas e resultados são escritos em `artifacts/installation/` (ignorado).

## Ponto de restauração

- Repositório efetivamente configurado: `EduardoStuhr/hipocampo`.
- Commit anterior: `46f0105d279be59470522ace5d6f044ac939348d`.
- Tag de backup no GitHub: `backup/instalacao-antes-3d-2026-11-03`.
- Tag da nova versão: `release/instalacao-3d-2026-11-03`.
- Branch de trabalho: `feat/instalacao-3d-realista`.

Para desfazer esta entrega preservando o histórico posterior, reverta o commit
identificado pela tag da nova versão e faça um push normal:

```bash
git revert release/instalacao-3d-2026-11-03
git push origin HEAD:main
```

Se mudanças posteriores gerarem conflito, aplique somente a reversão desta
instalação. Não use reset/force push sobre trabalho posterior. A tag de backup
permite consultar todos os arquivos anteriores. Para desativar somente o novo
runtime, retire do HTML o mapeamento do chunk `Instalacao3D-B1S3w8qj.js` e a
stylesheet `installation-room.css`; o bundle original continua no repositório.
