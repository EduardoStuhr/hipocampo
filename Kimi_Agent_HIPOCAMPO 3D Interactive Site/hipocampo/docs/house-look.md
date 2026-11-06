# Olhar em 360° dentro da casa — 6/11/2026

O visitante pode virar a câmera para observar qualquer parede ou moldura,
sem sair do percurso conduzido pelo scroll.

- Computador: arraste na cena para olhar. Também é possível ativar “olhar ao
  redor” e usar as setas. A roda do mouse continua avançando pela casa.
- Celular: toque em “olhar ao redor” e arraste. Toque em “voltar ao percurso”
  para retomar o gesto vertical da página.
- “Voltar ao percurso”, Home ou Esc recentram a câmera. O giro horizontal não
  tem limite; a inclinação vertical é limitada para não inverter a visão.

Os controles aparecem somente na parte interna. Ao voltar para a porta ou
seguir para a saída, a direção manual se recompõe e os controles desaparecem.
Capturas de ponteiro são liberadas mesmo quando se sai da casa durante o arraste.
Nenhum controle de scroll global, pin, geometria, fotografia ou moldura foi
alterado. O balanço pelo mouse e a trajetória existentes continuam ativos.

`house-look.js` trata a orientação e os controles locais. `page3-house.js`
aplica a orientação depois da direção do percurso, usando a mesma renderização.
A direção manual se dissolve nos limites da sala; não cria um segundo loop.
Com movimento reduzido, a câmera só atualiza ao receber entrada. Perda de
contexto e página oculta fecham os controles e liberam a interação.

Validação com mouse real, teclado e toque pelo protocolo do Chromium em
`tools/house-look-qa.py`. Regressão da passagem em `tools/house-journey-qa.py`.
Evidências em `artifacts/house-look/` e `artifacts/house-depth/`.

```bash
python3 tools/house-look-qa.py
python3 tools/house-journey-qa.py
npm run build
```

Backup anterior: `backup/antes-olhar-360-casa-2026-11-06` → `d967a93`.
Entrega: `release/olhar-360-casa-2026-11-06`. Para desfazer somente a rotação
manual, use `git revert release/olhar-360-casa-2026-11-06`, preservando trabalho
posterior.

[Captura real ao olhar para uma moldura](house-look-preview.webp) ·
[Captura móvel](house-look-mobile.webp).

A regressão ampla sincroniza as medidas após duas mudanças automatizadas de
viewport e aceita a interpolação já invisível no final branco: a renderização
pode parar fora da tela antes de atingir o último valor numérico, também na
versão anterior. Os testes de porta, paredes e percurso visível mantêm os critérios.

Resultado final: **93 verificações aprovadas** — 23 de interação e 70 da passagem
original. Incluem giro superior a 360°, direção real da câmera, limites verticais,
mouse/toque/setas, Escape/reset, roda e gesto vertical, liberação de captura ao
sair, retorno pela porta, movimento reduzido, contexto perdido, fallback sem
WebGL, porta estável, limites laterais, balanço, resize e próxima seção.
Sem erros JavaScript, shaders ou recursos locais faltando. Build e sintaxe
aprovados. Chromium/SwiftShader emulado; sem teste em aparelho físico nesta revisão.
