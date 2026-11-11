/**
 * Mostra um modelo (que nasceu invisível) só quando o desenho dele estiver
 * pronto, sem travar o quadro (docs/features/066-revisao-dos-biomas.md,
 * desempenho):
 *
 * 1. compila os shaders dos materiais com `compileAsync` — com a extensão
 *    de compilação em paralelo do navegador, o trabalho sai do quadro;
 * 2. sobe as texturas (`textures`) para a placa de vídeo, uma por quadro
 *    (`initTexture`; a já enviada não custa nada);
 * 3. deixa o modelo visível.
 *
 * Sem isso, a primeira criatura de cada espécie compilava e subia tudo no
 * quadro em que aparecia (travadas de dezenas a centenas de ms).
 *
 * `scene` é a cena onde o modelo vai ser desenhado (as luzes e a névoa de
 * lá entram na chave do shader). `isCancelled`: o modelo saiu antes de
 * ficar pronto — não mostra nem continua subindo. Erro em qualquer passo
 * só pula o passo: o modelo nunca fica escondido para sempre.
 *
 * Devolve uma promessa que termina depois de mostrar (ou de desistir).
 */
export async function revealWhenReady({
  object,
  renderer,
  camera,
  scene,
  textures = [],
  isCancelled = () => false,
  nextFrame = (callback) => requestAnimationFrame(callback),
}) {
  try {
    if (renderer.compileAsync) {
      await renderer.compileAsync(object, camera, scene)
    }
  } catch {
    // Sem compilar antes: o primeiro desenho compila, como sempre.
  }

  for (const texture of new Set(textures)) {
    await new Promise((resolve) => nextFrame(resolve))
    if (isCancelled()) return
    try {
      renderer.initTexture(texture)
    } catch {
      // Sobe no primeiro desenho.
    }
  }

  if (!isCancelled()) object.visible = true
}
