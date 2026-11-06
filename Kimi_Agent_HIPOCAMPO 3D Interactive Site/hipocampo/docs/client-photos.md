# Fotos enviadas pela cliente — 6/11/2026

Origem: `imagens.zip`, cinco JPEGs numerados. Conversão para WebP em qualidade 92,
sem recortar, redimensionar ou modificar as cores. Arquivos de produção em
`public/images/client-2026-11/`.

| Arquivo do ZIP | Uso |
| --- | --- |
| imagem-1.jpeg | Última moldura da parede esquerda da casa |
| imagem-2.jpeg | Última moldura da parede direita da casa |
| imagem-3.jpeg | Acrescentada ao rastro do mouse, recorte de papel |
| imagem-4.jpeg | Acrescentada ao rastro do mouse, recorte oval |
| imagem-5.jpeg | Acrescentada ao rastro do mouse, recorte em arco |

A galeria conserva seis molduras, seu balanço e os quatro outros elementos do
acervo. As fotos cabem inteiras nas molduras, sem deformação. As duas texturas
entram na preparação assíncrona existente antes de mostrar a cena e são liberadas
no descarte. O rastro passa de nove para doze imagens, preservando todas as
anteriores, o limite de elementos, a preferência por movimento reduzido e a
rolagem. Não foram alterados os fundos brancos ou as fotos da câmera.

Validação: `python3 tools/client-photos-qa.py`, build e sintaxe. Evidências em
`artifacts/client-photos/`. Teste real do mouse verifica as doze imagens; o renderer
é inspecionado para confirmar as duas fotos, proporções e seis molduras, com
entrada/retorno e acesso à seção seguinte em 1600×900 e 390×844.

Backup: `backup/antes-fotos-cliente-2026-11-06` → `ffb73dd`.
Entrega: `release/fotos-cliente-2026-11-06`. Para desfazer somente esta entrega:
`git revert release/fotos-cliente-2026-11-06`, preservando trabalho posterior.

Resultado: 16 verificações aprovadas, sem erros JavaScript ou recursos locais
faltando. Build e sintaxe aprovados. A validação percorreu a casa nos dois
sentidos; não houve alteração dos pendentes ou das quatro outras molduras.

Revisão: as duas fotografias passaram para as últimas molduras, em z = -11,15 m.
As peças que ocupavam esses lugares foram movidas para as primeiras molduras,
preservando o acervo. Backup: `backup/antes-ultimas-molduras-2026-11-06`.
As 18 verificações da revisão passaram, incluindo a posição mundial das duas
fotos nas últimas molduras, além de entrada, retorno e sequência do mouse.
Entrega da mudança de posição: `release/ultimas-molduras-2026-11-06`.

## Encaixe das duas fotografias

As duas últimas molduras acompanham a proporção das fotos, com margem interna
uniforme de 8 cm no espaço 3D. A fotografia horizontal recebe moldura horizontal;
a vertical recebe uma moldura mais estreita. O conteúdo fica inteiro, sem corte
ou distorção, e os centros continuam nas mesmas posições perto da saída. As
outras molduras e os pendentes mantêm as dimensões anteriores.

Backup: `backup/antes-encaixe-molduras-2026-11-06` → `4878ab2`.
Entrega: `release/encaixe-molduras-2026-11-06`.

Build e 20 verificações da revisão aprovados, incluindo margens medidas no
renderer em desktop e celular. [Captura real do encaixe](client-frame-fit-preview.webp).
