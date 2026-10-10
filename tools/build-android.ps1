param([string]$Sdk="$env:LOCALAPPDATA\Android\Sdk",[string]$Jdk='C:\Program Files\Android\Android Studio\jbr')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$buildPath=Join-Path $taskRoot 'android\build'
$assetPath=Join-Path $taskRoot 'android\app\src\main\assets'
$bt=Join-Path $Sdk 'build-tools\36.0.0'
$platform=Join-Path $Sdk 'platforms\android-36\android.jar'
New-Item -ItemType Directory -Force $buildPath,(Join-Path $buildPath 'generated'),(Join-Path $buildPath 'classes'),(Join-Path $buildPath 'dex'),(Join-Path $taskRoot 'outputs') | Out-Null
function Check-Exit {if($LASTEXITCODE -ne 0){throw "Android-bouwstap mislukt (code $LASTEXITCODE)."}}
& "$bt\aapt2.exe" compile --dir "$taskRoot\android\app\src\main\res" -o "$buildPath\resources.zip"
Check-Exit
& "$bt\aapt2.exe" link -I $platform --manifest "$taskRoot\android\app\src\main\AndroidManifest.xml" --java "$buildPath\generated" -A $assetPath -o "$buildPath\unsigned.apk" "$buildPath\resources.zip"
Check-Exit
$javaSources=@(Get-ChildItem "$taskRoot\android\app\src\main\java","$buildPath\generated" -Filter '*.java' -Recurse | ForEach-Object FullName)
& "$Jdk\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $platform -d "$buildPath\classes" @javaSources
Check-Exit
& "$Jdk\bin\jar.exe" cf "$buildPath\classes.jar" -C "$buildPath\classes" .
Check-Exit
$env:JAVA_HOME=$Jdk
& "$bt\d8.bat" --lib $platform --min-api 26 --output "$buildPath\dex" "$buildPath\classes.jar"
Check-Exit
& "$Jdk\bin\jar.exe" uf "$buildPath\unsigned.apk" -C "$buildPath\dex" classes.dex
Check-Exit
& "$bt\zipalign.exe" -f 4 "$buildPath\unsigned.apk" "$buildPath\aligned.apk"
Check-Exit
$signingKey=Join-Path $taskRoot 'data\android-debug.keystore'
if(!(Test-Path -LiteralPath $signingKey)){& "$Jdk\bin\keytool.exe" -genkeypair -keystore $signingKey -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Fieldday,C=NL' -keyalg RSA -keysize 2048 -validity 10000;Check-Exit}
$out=Join-Path $taskRoot 'outputs\Fieldday.apk'
& "$bt\apksigner.bat" sign --ks $signingKey --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $out "$buildPath\aligned.apk"
Check-Exit
& "$bt\apksigner.bat" verify --verbose $out
Check-Exit
& "$bt\aapt2.exe" dump badging $out
Check-Exit
Write-Output "APK: $out"

