$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = Join-Path $root 'runtime/local-model'
New-Item -ItemType Directory -Force -Path $target | Out-Null
$env:TEMP = Join-Path $root '.cache/tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$files = @(
  @{ name='llama-b11719-bin-win-vulkan-x64.zip'; url='https://github.com/ggml-org/llama.cpp/releases/download/b11719/llama-b11719-bin-win-vulkan-x64.zip'; sha='08dde7f4133443ac629431c35f0435e267ca73251fc002cb95e10625424e2963' },
  @{ name='qwen2.5-coder-7b-instruct-q4_k_m.gguf'; url='https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/13fb94bfda8c8cf22497dc57b78f391a9acb426a/qwen2.5-coder-7b-instruct-q4_k_m.gguf'; sha='509287f78cb4d4cf6b3843734733b914b2c158e43e22a7f4bf5e963800894d3c' }
)
foreach ($file in $files) {
  $destination = Join-Path $target $file.name
  if (!(Test-Path -LiteralPath $destination)) {
    Write-Output "Downloading $($file.name) into the project runtime."
    & curl.exe --fail --location --retry 3 --speed-limit 1024 --speed-time 60 --continue-at - --output "$destination.partial" $file.url
    if ($LASTEXITCODE -ne 0) { throw 'Download failed; partial file retained for resume.' }
    if ((Get-FileHash -LiteralPath "$destination.partial" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha) { throw 'Download hash mismatch.' }
    Move-Item -LiteralPath "$destination.partial" -Destination $destination
  }
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha) { throw 'Local asset hash mismatch.' }
}
$binary = Join-Path $target 'llama-b11719'
if (!(Test-Path -LiteralPath $binary)) { Expand-Archive -LiteralPath (Join-Path $target $files[0].name) -DestinationPath $binary }
$files | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'provenance.json') -Encoding utf8
Write-Output 'Verified local runtime and model. Use npm run model:start.'
