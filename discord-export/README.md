# Гайди з Discord → вкладка «Гайди»

Як оновити гайди, якщо в діскорді (PW Helper / Бібліотека) щось змінилось.

## 1. Експорт із Discord

Через [DiscordChatExporter CLI](https://github.com/Tyrrrz/DiscordChatExporter):

```powershell
$env:DISCORD_TOKEN="<твій user-токен>"
cd "D:\DiscordChatExporter.Cli.win-x64"
.\DiscordChatExporter.Cli.exe export `
  -c 1471192417305624597 1471054490068062390 1471222321976184863 1471223335177420893 `
  --include-threads All -f Json --media -o "D:\pw-calc\discord-export\"
```

ID — це форум-канали: `база-гільдії`, `корисне`, `куб`, `титули`.

## 2. ASCII-копії (Node на Windows не читає emoji-імена)

```powershell
$src="D:\pw-calc\discord-export"; $dst="$src\raw"
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem -LiteralPath $src -Filter *.json | Where-Object {$_.Name -notlike "_*"} | ForEach-Object {
  if ($_.Name -match '\[(\d+)\]\.json$') { Copy-Item -LiteralPath $_.FullName (Join-Path $dst ($Matches[1]+".json")) -Force }
}
```

## 3. Збірка даних + копіювання картинок

```powershell
node discord-export\build-guides.js   # -> guides-data.js + _media-manifest.json
```

Потім скопіювати лише використані картинки в `assets/guides/<id>/` (за маніфестом):

```powershell
$src="D:\pw-calc\discord-export"; $assets="D:\pw-calc\assets\guides"
$manifest = Get-Content "$src\_media-manifest.json" -Raw | ConvertFrom-Json
$byId=@{}; Get-ChildItem -LiteralPath $src -Directory | ? {$_.Name -like "*.json_Files"} | % { if ($_.Name -match '\[(\d+)\]\.json_Files$'){$byId[$Matches[1]]=$_.FullName} }
foreach ($e in $manifest) { $f=$byId[$e.id]; if($f){$s=Join-Path $f $e.base; if(Test-Path -LiteralPath $s){$d=Join-Path $assets $e.id; New-Item -ItemType Directory -Force $d|Out-Null; Copy-Item -LiteralPath $s (Join-Path $d $e.base) -Force}} }
```

## Що комітиться

- `guides-data.js` (у корені) + `assets/guides/**` — потрібні сайту.
- `discord-export/build-guides.js` + цей README.
- Сирий експорт (`raw/`, `*.json`, `*_Files/`) — **ні** (див. `.gitignore`).
