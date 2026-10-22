#!/bin/sh
# Builds dist/spring-farm: the folder to drop into Wallpaper Engine (Create Wallpaper > or projects/myprojects).
set -e
out=dist/spring-farm
rm -rf "$out"; mkdir -p "$out/src"
cp index.html project.json preview.gif "$out/"
cp src/*.js "$out/src/"
echo "built $out ($(ls "$out/src" | wc -l) scripts)"
