# Spring Lakeside Farm

A live 8-bit spring farm wallpaper for [Wallpaper Engine](https://www.wallpaperengine.io/) (web wallpaper, HTML/JS canvas).
Every pixel is drawn by code: no image, font or audio assets. Day and night cycle, drifting cloud shadows, villagers with daily routines,
farm animals and pets that wander, and mouse interaction.

Made with the help of AI (Claude, by Anthropic), which wrote the code that draws and animates everything.

## Run it

Serve the folder over HTTP and open `index.html` (for example `python -m http.server 8123`).
Preview switches: `?time=HH:MM|dawn|day|dusk|night`, `?speed=N`, `?guides=0`, `?people=0&livestock=0&pets=0`, `?scale=fit`.

## Wallpaper Engine

`sh package.sh` builds `dist/spring-farm`. Copy it to `wallpaper_engine/projects/myprojects/`.
User properties are declared in `project.json`.

## Layout

`src/` engine, palette, buildings, props, animals, characters, navigation, agents, ambient effects, scene and main loop.
`ART_BIBLE.md` records the art decisions. `charsheet.html` is the character design sheet.
