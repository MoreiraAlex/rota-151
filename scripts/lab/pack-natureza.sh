#!/usr/bin/env bash
# Pacotes de natureza do laboratório de biomas (docs/features/066-revisao-
# dos-biomas.md): árvores, arbustos e pedras do Ultimate Stylized Nature
# (`usn`) e do MegaKit (`megakit`), da Quaternius, guardados no depósito
# pessoal. As folhas de outono saem verdes e a casca avermelhada, marrom
# (`--recolor`). O lab usa estes ids no botão "Árvores dos pacotes".
#
# Uso: scripts/lab/pack-natureza.sh <pasta temporária>
set -euo pipefail
TMP="${1:?faltou a pasta temporária}"
A=".exemple/ambient"
BLENDER="${BLENDER:-/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
win() { if command -v wslpath >/dev/null; then wslpath -w "$1"; else echo "$1"; fi; }

mkdir -p "$TMP/usn" "$TMP/megakit"
unzip -q -o "$A/Ultimate Stylized Nature - May 2022-20261009T152945Z-1-001.zip" \
  '*/FBX/NormalTree*' '*/FBX/MapleTree*' '*/FBX/DeadTree*' '*/FBX/Bush*' '*/FBX/Rock*' '*/Textures/*' -d "$TMP/usn"
unzip -q -o "$A/Stylized Nature MegaKit[Standard].zip" \
  'FBX/CommonTree_*' 'FBX/TwistedTree_*' 'FBX/Bush_Common*' 'FBX/Rock_Medium_*' 'Textures/*' -d "$TMP/megakit"

USN="$(win "$TMP/usn/Ultimate Stylized Nature - May 2022/FBX")"
MK="$(win "$TMP/megakit/FBX")"
OUT="$(win public/assets/lab)"
pack() { "$BLENDER" --background --python "$(win scripts/lab/pack-lab.py)" -- "$@" --out "$OUT"; }

pack --src "$USN" --pack usn --label "Ultimate Nature" --category tree --match NormalTree --height 8 --recolor "Leaves=#4a8034:0.7,Bark=#5a4c40:0.7"
pack --src "$USN" --pack usn --label "Ultimate Nature" --category tree --match MapleTree --height 8 --recolor "Leaves=#4f8a36:0.9,Bark=#5a4c40:0.6"
# Árvores secas (só galhos), para a savana.
pack --src "$USN" --pack usn --label "Ultimate Nature" --category tree --match DeadTree --height 8 --recolor "Bark=#5a4c40:0.6"
pack --src "$USN" --pack usn --label "Ultimate Nature" --category bush --match Bush --height 1.2
pack --src "$USN" --pack usn --label "Ultimate Nature" --category rock --match Rock --height 1.5
pack --src "$MK" --pack megakit --label MegaKit --category tree --match CommonTree --height 8 --recolor "Bark=#5a4c40:0.7"
pack --src "$MK" --pack megakit --label MegaKit --category tree --match TwistedTree --height 8 --recolor "Leaves=#4a7a32:0.9,Bark=#5a4c40:0.6"
pack --src "$MK" --pack megakit --label MegaKit --category bush --match Bush_Common --height 1.2
pack --src "$MK" --pack megakit --label MegaKit --category rock --match Rock_Medium --height 1.5
