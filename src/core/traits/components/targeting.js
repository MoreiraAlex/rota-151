import { relation } from 'koota'

/**
 * A criatura embaixo do retículo AGORA, enquanto o modo scanner está
 * ativo — pedido do usuário: "ao apontar a pokédex para uma criatura,
 * tem que ter alguma iteração no hud que sinalize isso" (ver
 * docs/features/032-*.md). Relação, não um id guardado num trait comum
 * — regra do projeto (`docs/rules/README.md`, seção "R3F + Koota"):
 * "grafos de entidade (posse, hierarquia, alvo, continência) usam
 * `relation()` do Koota, não IDs string guardados em traits". `Targeting`
 * é exatamente "alvo".
 *
 * `exclusive: true` — só um alvo por vez (o próprio koota troca sozinho
 * ao chamar `.add(Targeting(novoAlvo))` de novo, sem precisar remover o
 * antigo primeiro).
 *
 * Dono de escrita: `scannerModeSystem.js`, todo tick enquanto
 * `ScanMode.active` — raycast novo a cada frame, então sempre reflete
 * EXATAMENTE o que está embaixo do retículo agora (`null`/nada quando o
 * modo desliga não é limpo explicitamente: como o system só escreve
 * enquanto `active`, o valor simplesmente CONGELA no último alvo válido
 * assim que o modo desliga — é esse congelamento que faz `Scanned`
 * (abaixo) funcionar: o clique de confirmar lê `Targeting` no MESMO
 * tick em que desliga o modo).
 */
export const Targeting = relation({ exclusive: true })

/**
 * A última criatura ESCANEADA de verdade (segundo clique direito, com
 * um `Targeting` válido, ver `scannerModeSystem.js`) — pedido do
 * usuário original (docs/features/032-*.md): "ao fazer o scanner, tem
 * que abrir a tela de status... do pokémon alvo". Diferente de
 * `Targeting` (muda a cada frame enquanto mirando), `Scanned` só muda
 * numa confirmação de verdade e fica FIXA depois.
 *
 * Desde docs/features/033-*.md, nenhuma tela lê mais esta relação pra
 * decidir o que exibir — isso virou responsabilidade de `ScanHistory`
 * (`core/traits/components/scanHistory.js`, `registrarScan` grava as
 * duas juntas, `core/actions/scanning.js`), que sobrevive à entidade
 * escaneada sendo destruída depois (snapshot, não referência viva).
 * Mantida escrita por segurança/uso futuro, sem custo — remover exigiria
 * uma limpeza maior (trait, export, testes) sem ganho funcional agora.
 *
 * Dono de escrita: `scannerModeSystem.js`, só no instante do clique de
 * confirmação.
 */
export const Scanned = relation({ exclusive: true })
