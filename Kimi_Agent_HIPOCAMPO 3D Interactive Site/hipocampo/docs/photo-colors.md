# Cores naturais das fotografias — 5 de novembro de 2026

Revisão posterior: [recorte transparente do filme e restauração da montanha](image-refinement.md).
Ela substitui o filtro SVG descrito neste registro por imagens com transparência própria.

O envelope, a montagem de montanhas e o filme deixaram de usar
`mix-blend-mode: multiply`. Essa mistura com o fundo amarelo tornava o papel e
as fotografias amarelados. O fundo, as medidas, posições, textos e interações
continuam os mesmos. Os arquivos originais das fotografias não foram alterados.

![Envelope e montanha com os tons naturais](photo-colors-preview.webp)

![Filme e colagem com os tons naturais](photo-colors-film.webp)

A montagem da montanha conserva o recorte: um filtro SVG usa somente a
luminosidade do entorno claro para gerar transparência. A faixa entre luminâncias
220 e 185 em sRGB suaviza o contorno; o centro do papel é protegido por uma região
opaca. A última composição usa os pixels RGB da imagem original. Assim, não se
recorre à multiplicação pelo fundo nem se expõe o retângulo cinza da digitalização.
O filme mantém sua máscara suave original, e o envelope mantém o recorte e a troca
de fotos por mouse/setas.

Passaram **48 verificações**: 16 de cor/renderização e 32 de composição/fundos.
As amostras interiores do envelope, da montanha e do filme renderizadas sobre
amarelo coincidem com as amostras sobre branco em desktop e celular. Os cantos da
montagem mostram o amarelo do fundo. A comparação com `6c1f822` continua sem
diferenças de geometria acima de 0,75 px nas quatro resoluções existentes.
Build e sintaxe aprovados; sem exceções JavaScript ou recursos locais indisponíveis.

```bash
python3 tools/photo-colors-qa.py
python3 tools/color-story-qa.py
npm run build
```

Capturas, comparação e resultados em `artifacts/photo-colors/`; a comparação de
medidas continua em `artifacts/layout-restoration/`. Os registros acima são
capturas do viewport real, não imagens geradas da página.

Backup anterior: `backup/antes-cores-naturais-2026-11-05` → `225492c`.
Entrega: `release/cores-naturais-2026-11-05`. Para desfazer somente esta correção,
use `git revert release/cores-naturais-2026-11-05`, preservando trabalho posterior.
