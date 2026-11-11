#!/usr/bin/env bash
# Passos na grama (docs/features/066-revisao-dos-biomas.md): da biblioteca de
# passos do depósito pessoal (.exemple/Steps/Steps/) para
# public/assets/audio/footsteps/grass/. A biblioteca não tem grama: por ora,
# o passo em terra (`ConcreteDirtFootStepWalk`, metade andando e metade
# correndo). Cada arquivo sai com a intensidade média do passo do treinador
# (`footsteps/medium`), para tocar no volume do passo de cada espécie.
# Trocar o som: apontar SRC/PATTERN para outros arquivos e rodar de novo.
set -euo pipefail
ROOT=/home/alexmoreira/projetos/pessoal/rota-151
SRC=$ROOT/.exemple/Steps/Steps
PATTERN=ConcreteDirtFootStepWalk_
OUT=$ROOT/public/assets/audio/footsteps/grass
REF=$ROOT/public/assets/audio/footsteps/medium
mkdir -p "$OUT"
rm -f "$OUT"/*.ogg

mean() { ffmpeg -hide_banner -nostats -i "$1" -af volumedetect -f null - 2>&1 | grep mean_volume | awk '{print $5}'; }
avg() { local s=0 n=0; for f in "$@"; do s=$(python3 -c "print($s + $(mean "$f"))"); n=$((n + 1)); done; python3 -c "print($s / $n)"; }

target=$(avg "$REF"/walk-*.ogg)
files=("$SRC"/"$PATTERN"*.ogg)
half=$(( (${#files[@]} + 1) / 2 ))
for i in "${!files[@]}"; do
  in=${files[$i]}
  if (( i < half )); then gait=walk; n=$((i + 1)); else gait=run; n=$((i - half + 1)); fi
  out=$(printf '%s/%s-%02d.ogg' "$OUT" "$gait" "$n")
  g=$(python3 -c "print($target - ($(mean "$in")))")
  ffmpeg -v error -y -i "$in" -af "volume=${g}dB" -ac 1 -ar 48000 -c:a libvorbis -q:a 4 "$out"
done
ls "$OUT"
