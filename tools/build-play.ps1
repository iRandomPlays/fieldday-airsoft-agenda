param([string]$Sdk="$env:LOCALAPPDATA\Android\Sdk",[string]$Jdk='C:\Program Files\Android\Android Studio\jbr',[string]$Gradle='',[string]$TrustStore='')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(!$Gradle){$Gradle=(Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-9.3.1-bin" -Filter gradle.bat -Recurse | Select-Object -First 1).FullName}
if(!$Gradle -or !(Test-Path -LiteralPath $Gradle)){throw 'Gradle 9.3.1 ontbreekt. Geef het pad via -Gradle.'}
$signingFile=Join-Path $taskRoot 'data\play-signing.properties'
$signingKey=Join-Path $taskRoot 'data\fieldday-play-upload.keystore'
if(!(Test-Path -LiteralPath $signingFile)){
 if(Test-Path -LiteralPath $signingKey){throw 'Uploadsleutel bestaat al zonder configuratie. Herstel de configuratie; overschrijf de sleutel niet.'}
 $bytes=New-Object byte[] 32
 $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
 $rng.GetBytes($bytes);$rng.Dispose()
 $env:FIELDDAY_STORE_PASSWORD=[Convert]::ToBase64String($bytes)
 try{
  & "$Jdk\bin\keytool.exe" -genkeypair -keystore $signingKey -storepass:env FIELDDAY_STORE_PASSWORD -keypass:env FIELDDAY_STORE_PASSWORD -alias fieldday-upload -dname 'CN=Fieldday Upload,O=Fieldday,C=NL' -keyalg RSA -keysize 3072 -validity 10000
  if($LASTEXITCODE -ne 0){throw 'Uploadsleutel aanmaken mislukt'}
  $keyPath=$signingKey.Replace('\','/')
  @("storeFile=$keyPath","storePassword=$env:FIELDDAY_STORE_PASSWORD",'keyAlias=fieldday-upload',"keyPassword=$env:FIELDDAY_STORE_PASSWORD") | Set-Content -LiteralPath $signingFile -Encoding ascii
 }finally{Remove-Item Env:FIELDDAY_STORE_PASSWORD -ErrorAction SilentlyContinue}
}
$env:JAVA_HOME=$Jdk
$env:ANDROID_HOME=$Sdk
$gradleJvmArgs='-Xmx2048m -Dfile.encoding=UTF-8'
if($TrustStore){$gradleJvmArgs+=' -Djavax.net.ssl.trustStore="'+$TrustStore.Replace('\','/')+'"'}
& $Gradle -p "$taskRoot\android\play" --no-daemon "-Dorg.gradle.jvmargs=$gradleJvmArgs" bundleRelease
if($LASTEXITCODE -ne 0){throw 'Play Store-bouw mislukt'}
New-Item -ItemType Directory -Force (Join-Path $taskRoot 'outputs') | Out-Null
$out=Join-Path $taskRoot 'outputs\Fieldday-Play.aab'
Copy-Item -LiteralPath "$taskRoot\android\play\build\outputs\bundle\release\FielddayPlay-release.aab" -Destination $out -Force
& "$Jdk\bin\jarsigner.exe" -verify $out
if($LASTEXITCODE -ne 0){throw 'Bundelhandtekening klopt niet'}
Write-Output "Play Store-bundel: $out"
Write-Output 'Bewaar data/fieldday-play-upload.keystore en data/play-signing.properties veilig. Publiceer ze nooit.'
