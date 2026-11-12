#!/usr/bin/env bash
# Sons do Pokécenter e da loja por dentro (docs/features/068-interior-dos-
# predios.md):
#
# - a porta (public/assets/audio/interior/door.ogg) NÃO sai daqui: o usuário
#   pôs o som dele no lugar do sintetizado (o volume fica em
#   `INTERIOR_SOUNDS.door`);
# - o passo no piso de dentro (public/assets/audio/footsteps/indoor/): o passo
#   seco em chão liso da biblioteca (.exemple/Steps/Steps/AI_Walk_Concrete e
#   AI_Run_Concrete) com um eco curto de sala, na intensidade média do passo
#   do treinador (footsteps/medium);
# - a música (public/assets/audio/music/pokecenter.ogg): PROVISÓRIA — o tema
#   do Pokécenter não está no depósito; por ora "Jubilife City (Night)" do
#   BDSP (.exemple/music/), cortada logo depois do fim do trecho que repete
#   (`loopEnd` em musicTracks.js), no volume da música de batalha;
# - a música da loja (public/assets/audio/music/poke-mart.ogg): PROVISÓRIA
#   também — o tema da loja não está no depósito; por ora "Jubilife City
#   (Day)" do BDSP, a versão de dia da do Pokécenter, cortada do mesmo jeito.
#
# Trocar um som: mudar a origem aqui e rodar de novo.
set -euo pipefail
ROOT=/home/alexmoreira/projetos/pessoal/rota-151
EX=$ROOT/.exemple
OUT=$ROOT/public/assets/audio

mean() { ffmpeg -hide_banner -nostats -i "$1" -af volumedetect -f null - 2>&1 | grep mean_volume | awk '{print $5}'; }
avg() { local s=0 n=0; for f in "$@"; do s=$(python3 -c "print($s + $(mean "$f"))"); n=$((n + 1)); done; python3 -c "print($s / $n)"; }
lufs() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}'; }

# Passo no piso de dentro.
STEPS=$EX/Steps/Steps
DEST=$OUT/footsteps/indoor
mkdir -p "$DEST"
rm -f "$DEST"/*.ogg
target=$(avg "$OUT"/footsteps/medium/walk-*.ogg)
# O ganho é medido já com o eco (ele espalha o som e baixa a média).
WET=$(mktemp --suffix=.wav)
step() {
  local in=$1 out=$2
  local g
  ffmpeg -v error -y -i "$in" -af "aecho=0.85:0.5:35|60:0.22|0.12" -ac 1 -ar 48000 "$WET"
  g=$(python3 -c "print($target - ($(mean "$WET")))")
  ffmpeg -v error -y -i "$WET" -af "volume=${g}dB" -c:a libvorbis -q:a 4 "$out"
}
n=1; for f in "$STEPS"/AI_Walk_Concrete_0*.ogg; do step "$f" "$(printf '%s/walk-%02d.ogg' "$DEST" $n)"; n=$((n + 1)); done
n=1; for f in "$STEPS"/AI_Run_Concrete_0*.ogg; do step "$f" "$(printf '%s/run-%02d.ogg' "$DEST" $n)"; n=$((n + 1)); done

# Músicas (provisórias), no volume da de batalha: a origem, o fim do trecho
# que repete e o arquivo.
music() {
  local in=$1 loop_end=$2 out=$3
  local g
  g=$(python3 -c "print($(lufs "$OUT/music/battle-wild.ogg") - ($(lufs "$in")))")
  ffmpeg -v error -y -i "$in" -t "$(python3 -c "print($loop_end + 0.5)")" -af "volume=${g}dB" -ar 48000 -c:a libvorbis -q:a 4 "$out"
}
music "$EX/music/027. Jubilife City (Night).mp3" 51.5475 "$OUT/music/pokecenter.ogg"
music "$EX/music/026. Jubilife City (Day).mp3" 50.576375 "$OUT/music/poke-mart.ogg"

rm -f "$WET"
ls "$DEST" "$OUT/music/pokecenter.ogg" "$OUT/music/poke-mart.ogg"
