# pi-polyglot

Aprender um idioma enquanto trabalha com o Pi, sem transformar o chat de programação em uma aula.

## Protótipo visual concluído — C4 escolhida

**Decisão validada:** feedback abaixo do composer, com uma única frase marcada e uma dica curta abaixo. O texto não alterado aparece só uma vez; remoções são riscadas e adições sublinhadas. Não há seta, duas versões da frase ou etiqueta “polyglot · DEMO”.

Cabeçalho aprovado: **`English · 1 change`** / **`English · N changes`**. O nome indica o idioma-alvo; `·` é o marcador. Uma substituição conta como uma alteração, não duas. Os exemplos fixos atuais têm uma alteração cada; a contagem de várias alterações será ligada ao resultado da revisão real.

C4 é o padrão ao habilitar após iniciar/recarregar. As variantes C, C1, C2 e C3 permanecem disponíveis apenas como referências do experimento. Este passo ainda usa **exemplos fixos**, não corrige mensagens reais e não chama IA. `/polyglot next` permite comparar as opções na TUI real do Pi, sem capturar as setas do editor.

### Experimentar

Requer o Pi instalado no PATH (experimentado com 0.85.1). Não precisa de `npm install`:

```sh
npm run prototype
```

Dentro do Pi:

```text
/polyglot on
/polyglot c1
/polyglot c2
/polyglot c3
/polyglot c4
/polyglot c
/polyglot lang ja
/polyglot off
```

Também é possível usar `/reload` numa sessão deste projeto para carregar `.pi/extensions/polyglot-prototype.ts`, desde que o projeto esteja confiado. Não há instalação global.

| Comando | Efeito |
| --- | --- |
| `/polyglot` | Liga/desliga; começa desligado, com C4 selecionada |
| `/polyglot on` / `/polyglot off` | Habilita / remove widget e status |
| `/polyglot c` | **Base anterior:** antes/depois em linhas separadas + dica |
| `/polyglot c1` | **Inline:** alteração com seta dentro da frase + dica, sem cabeçalho |
| `/polyglot c2` | **Colunas:** antes/depois lado a lado; empilha abaixo de 76 colunas |
| `/polyglot c3` | **Didática:** frase corrigida primeiro, ajuste, explicação e padrão |
| `/polyglot c4` | **Escolhida:** idioma + contagem, uma frase com alterações e dica |
| `/polyglot next` | Alterna C → C1 → C2 → C3 → C4 → C |
| `/polyglot lang en` / `es` / `ja` | Exemplo em inglês / espanhol / japonês |
| `/polyglot help` | Ajuda |

Escolher uma variante ou idioma também liga a demonstração. As explicações deste passo estão em português. Trechos removidos usam cor de remoção + riscado; novos trechos usam cor de adição + sublinhado. Em C4, o texto não alterado aparece apenas uma vez, sem seta ou linhas `−`/`+`; o riscado e o sublinhado distinguem as mudanças sem depender só da cor. A frase pode quebrar visualmente em terminal estreito, sem virar duas versões. A aparência exata depende do tema e do suporte do terminal a esses estilos.

As variantes não exibem a etiqueta “polyglot · DEMO”. O rodapé identifica ligado, variante e nome, idioma-alvo, idioma da explicação e posição. Ao desligar, não sobra indicador. Recarregar, reiniciar ou trocar a sessão restaura o estado inicial desligado, com **C4 selecionada**. Alternar off/on sem recarregar mantém a variante escolhida.

### Limites intencionais

- Somente comandos e widgets: nenhum hook de input, prompt, ferramenta ou mensagem adicionado ao contexto do modelo pela extensão.
- Não lê histórico, arquivos, texto do composer ou credenciais.
- Não reescreve o que você digita, substitui o editor, abre modais automaticamente ou registra atalhos.
- Nenhum histórico de aprendizado ou preferência persistida; estado apenas em memória.
- O Pi continua normal: **mensagens comuns ainda podem chamar seu modelo**. `--offline` desliga operações de rede na inicialização, não as chamadas do chat. Use os comandos `/polyglot` para avaliar sem chamadas de IA.
- Somente TUI; nenhum componente em print/JSON/RPC.
- Não há sessão de revisão ainda. Os exemplos em três idiomas não significam suporte de correção implementado.

### Encerramento do experimento

A escolha visual está fechada. O rodapé de comparação e os comandos das variantes são controles do protótipo, não decisões sobre a interface final.

O código em `prototypes/` é descartável; não é base de produção. Antes da implementação real, arquivar o experimento numa branch de protótipo e implementar só o visual aprovado. Esse arquivamento ainda está pendente: este diretório não tem repositório Git nem issue de implementação.

## Funcionamento aprovado — ainda não implementado

- Quando habilitado, revisar automaticamente após o envio da mensagem, nunca bloquear o envio ao agente de trabalho.
- O Pi recebe o texto original intacto. A revisão roda em paralelo, numa sessão isolada e descartável por mensagem.
- A revisão recebe apenas a mensagem e as preferências de idioma, não o histórico de trabalho.
- Idioma-alvo inicial: **inglês**. As explicações devem ser dadas no **idioma nativo configurado**, não necessariamente no idioma estudado. Idioma-alvo e idioma nativo são preferências independentes; trocar o idioma estudado não muda o idioma das explicações.
- Por padrão, cada revisão usa o **modelo ativo do Pi no momento do envio**. Trocar o modelo do Pi passa a valer para as próximas revisões.
- Permitir configurar um **modelo específico para revisão**, independente do modelo de programação. Remover essa configuração volta a seguir o modelo ativo. Essa escolha não altera o modelo da sessão principal.
- Usar o mesmo modelo não significa compartilhar a sessão ou seu contexto: a revisão continua isolada.
- Mostrar o resultado somente no widget, sem acrescentar correções ao contexto principal.
- Manter o feedback visível até o próximo envio, sem desaparecimento por tempo. No novo envio, limpar o feedback anterior; mostrar somente a revisão da mensagem mais recente, sem acumular histórico. Resultados atrasados de mensagens anteriores não devem reaparecer.
- Quando não houver erros nem sugestões úteis, não mostrar feedback: nenhum aviso de “tudo certo” ou widget vazio. Remover também o resultado anterior para não exibir correções desatualizadas.
- Desligar cancela a revisão e limpa a interface.
- Incluir **correções de erros** e **sugestões para soar mais natural**. Distinguir as duas: uma preferência de estilo não deve ser apresentada como erro; sugestões de naturalidade são opcionais.

## Próximos baby steps — não implementados

1. Definir limites de quantidade de feedback.
2. Validar uma revisão real em contexto isolado e efêmero, sem ferramentas, histórico de trabalho, skills ou extensões herdadas. Idioma-alvo e idioma nativo configuráveis, com as explicações seguindo o idioma nativo.
3. Conectar essa revisão ao envio normal em paralelo, conforme o funcionamento aprovado acima.
4. Descartar resultados obsoletos e cancelar revisões também ao trocar idioma/sessão ou encerrar. Limitar latência, custo e quantidade de feedback.

As correções ficam na UI, nunca via `sendMessage`/`sendUserMessage` na sessão principal. Não usar `ctx.newSession()` para a revisão: isso substituiria a sessão de trabalho. O mecanismo da sessão isolada será validado no passo 2, antes de conectar um modelo.
