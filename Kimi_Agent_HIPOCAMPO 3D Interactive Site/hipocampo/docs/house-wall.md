# Encaixe da parede da entrada — 6/11/2026

A parede da entrada estava subordinada à transformação de perspectiva da porta
fotografada. Ao olhar para trás, suas extremidades ficavam inclinadas em relação
ao piso, teto e laterais, deixando frestas.

A parede agora pertence à estrutura reta da sala e tem volume de 20 cm. Seu
contorno alcança piso, teto e paredes laterais, com pequena sobreposição nas
junções. O recorte da abertura continua seguindo os quatro cantos calibrados da
porta. A porta conserva a transformação que a encaixa na fachada original.

A geometria da parede é refeita somente quando a largura da sala muda entre
celular e desktop, descartando a geometria anterior. Sem mudanças nas fotos,
molduras, balanço, rotação 360°, iluminação ou percurso.

Validação: `python3 tools/house-wall-qa.py`. Capturas antes/depois e resultados em
`artifacts/house-wall/`. O navegador de referência recebe somente o módulo
anterior de `14304d3`; a comparação não altera o site. A rotina verifica limites
da parede e colisões por raios na base, laterais e teto, abertura livre e mesma
calibração, rotação, retorno à fachada e acesso à próxima seção branca.

Backup: `backup/antes-parede-entrada-2026-11-06` → `14304d3`.
Entrega: `release/parede-entrada-2026-11-06`. Para desfazer somente esta correção:
`git revert release/parede-entrada-2026-11-06`, preservando trabalho posterior.

Resultado: 16 verificações focadas aprovadas em 1366×768 e 390×844, além de
build e sintaxe. Sem erros JavaScript ou recursos locais faltando.
[Captura real após a correção](house-wall-preview.webp).
