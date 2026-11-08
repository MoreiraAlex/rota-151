/**
 * Velocidade de andar (`running` false) ou correr (true) da entidade agora:
 * `walkSpeed`/`runSpeed` da espécie × o modificador de passo das condições
 * (`modifier`, o `movement` de `readConditionModifier` — ex.: a teia do
 * String Shot). Regra única de quem anda/corre (jogador, time seguindo/
 * lutando, selvagem vagando/perseguindo/saindo). A vida não muda a
 * velocidade (a penalidade de vida baixa saiu na
 * docs/features/063-revisao-da-ia-selvagem.md).
 */
export function resolveMoveSpeed(stats, running, modifier = 1) {
  const base = running ? stats.runSpeed : stats.walkSpeed
  return base * modifier
}
