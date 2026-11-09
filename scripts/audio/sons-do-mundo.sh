#!/usr/bin/env bash
# Converte os sons do mundo (docs/features/065-sons-do-mundo.md) de .exemple/ para public/assets/audio/.
set -euo pipefail
ROOT=/home/alexmoreira/projetos/pessoal/rota-151
SRC=$ROOT/.exemple
OUT=$ROOT/public/assets/audio
mkdir -p "$OUT/music" "$OUT/ambient"

lufs() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}'; }

# música: ganho linear até o alvo, corta logo depois do loopEnd (o fade e a 2ª volta saem), vorbis estéreo
music() { # arquivo destino loopEnd
  local in="$SRC/music/$1" out="$OUT/music/$2.ogg" end=$3
  local g; g=$(python3 -c "print(-16 - ($(lufs "$in")))")
  ffmpeg -v error -y -i "$in" -t "$(python3 -c "print($end + 0.5)")" -af "volume=${g}dB" -ar 48000 -c:a libvorbis -q:a 4 "$out"
  echo "$2 ganho ${g}dB $(du -h "$out" | cut -f1)"
}
# música de exploração (estilo Minecraft): toca inteira uma vez, com o fade
# do próprio arquivo; só iguala o volume e tira o silêncio do fim
song() { # arquivo-em-music-pla destino
  local in="$SRC/music-pla/$1" out="$OUT/music/$2.ogg"
  local g; g=$(python3 -c "print(-16 - ($(lufs "$in")))")
  ffmpeg -v error -y -i "$in" -af "volume=${g}dB,alimiter=limit=0.89:level=false,areverse,silenceremove=start_periods=1:start_threshold=-70dB,areverse" -ar 48000 -c:a libvorbis -q:a 3 "$out"
  echo "$2 ganho ${g}dB $(du -h "$out" | cut -f1)"
}
song "1-13. Obsidian Fieldlands- 1-1.mp3"  plains-day-1
song "2-07. Cobalt Coast- 1-1.mp3"         plains-day-2
song "2-12. Cobalt Coast- 2-1.mp3"         plains-day-3
song "1-23. Obsidian Fieldlands- 2-1.mp3"  forest-day-1
song "4-03. Obsidian Fieldlands- 1-2.mp3"  forest-day-2
song "4-12. Lake.mp3"                      forest-day-3
song "2-01. Crimson Mirelands- 1-1.mp3"    savanna-day-1
song "2-04. Crimson Mirelands- 2-1.mp3"    savanna-day-2
song "4-06. Crimson Mireland- 2-2.mp3"     savanna-day-3
song "2-03. Village.mp3"                   city-day-1
song "1-06. Jubilife Village.mp3"          city-day-2
song "2-10. Night.mp3"                     night-1
song "3-02. Late Night.mp3"                night-2
song "2-11. Investigation Report Night.mp3" night-3
song "4-11. Clefairy's Moonlit Meeting.mp3" night-4

# música de batalha: loop (BDSP), cortada logo depois do fim do loop
music "011. Battle! (Wild Pokémon).mp3" battle-wild 74.380

# ambiente em loop: corta em LEN s e funde os últimos XF s com os primeiros (emenda sem clique)
bed() { # origem destino LEN canais alvoLUFS
  local in="$SRC/ambient-065/$1" out="$OUT/ambient/$2.ogg" len=$3 ch=$4 target=$5 xf=3
  local g; g=$(python3 -c "print($target - ($(lufs "$in")))")
  ffmpeg -v error -y -i "$in" -filter_complex \
    "[0:a]atrim=0:${len},asetpts=N/SR/TB,volume=${g}dB,alimiter=limit=0.7:level=false,aformat=channel_layouts=$([ "$ch" = 1 ] && echo mono || echo stereo),asplit[a][b];\
     [a]atrim=${xf},asetpts=N/SR/TB[body];[b]atrim=0:${xf},asetpts=N/SR/TB[head];\
     [body][head]acrossfade=d=${xf}:c1=qsin:c2=qsin[o]" \
    -map "[o]" -ar 48000 -c:a libvorbis -q:a 3 "$out"
  echo "$2 ganho ${g}dB $(du -h "$out" | cut -f1)"
}
# fundos em mono e com cerca de um minuto: ficam decodificados na memória
bed floresta-dia/2749-forest-4.ogg           forest-day    63 1 -23
bed planicie-dia/0097-countryside.ogg        plains-day    63 1 -23
bed savana-dia/3002-cicadas.ogg              savanna-day   48 1 -23
bed noite/1469-campaign-at-night-3.ogg       night         63 1 -23
bed cidade/1346-village-city-center-1.ogg    city          63 1 -23
bed lago/0691-pond-in-a-field.ogg            lake          48 1 -23
bed rio/0823-small-stream.ogg                river         48 1 -23

# avulsos: coruja (mono, sem silêncio nas pontas)
shot() { # origem destino
  local in="$SRC/ambient-065/$1" out="$OUT/ambient/$2.ogg"
  local g; g=$(python3 -c "print(-18 - ($(lufs "$in")))")
  ffmpeg -v error -y -i "$in" -af "volume=${g}dB,silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" -ac 1 -ar 48000 -c:a libvorbis -q:a 3 "$out"
  echo "$2 ganho ${g}dB $(du -h "$out" | cut -f1)"
}
shot coruja/1763-tawny-owl-1.ogg owl-01
shot coruja/1764-tawny-owl-2.ogg owl-02
