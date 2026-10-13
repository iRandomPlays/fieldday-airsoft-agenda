param([string]$Bundle='outputs/Fieldday-Play.aab',[string]$BundleTool='android/play/build/tools/bundletool.jar',[string]$Jdk='C:\Program Files\Android\Android Studio\jbr')
$ErrorActionPreference='Stop'
$validation=& "$Jdk\bin\java.exe" -jar $BundleTool validate "--bundle=$Bundle" 2>&1
if($LASTEXITCODE -ne 0){throw "Ongeldige app-bundel: $validation"}
$raw=& "$Jdk\bin\java.exe" -jar $BundleTool dump manifest "--bundle=$Bundle" --module=base 2>$null
if($LASTEXITCODE -ne 0){throw 'Bundelmanifest kon niet gelezen worden'}
[xml]$manifest=$raw -join "`n"
$ns=New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$ns.AddNamespace('a','http://schemas.android.com/apk/res/android')
if($manifest.manifest.package -ne 'nl.fieldday.app'){throw 'Verkeerde pakketnaam'}
if($manifest.SelectSingleNode('/manifest/application[@a:debuggable="true"]',$ns)){throw 'Debugversie'}
if($manifest.SelectSingleNode('/manifest/uses-permission[@a:name="android.permission.REQUEST_INSTALL_PACKAGES"]',$ns)){throw 'APK-installatiepermissie aanwezig'}
if($manifest.SelectSingleNode('/manifest/application/provider[contains(@a:name,"UpdateApkProvider")]',$ns)){throw 'APK-provider aanwezig'}
$signature=& "$Jdk\bin\jarsigner.exe" -verify $Bundle 2>&1
if($LASTEXITCODE -ne 0 -or !($signature -match 'jar verified')){throw 'Bundelhandtekening ongeldig'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Bundle))
try{
 $dex=$zip.GetEntry('base/dex/classes.dex')
 if(!$dex){throw 'Appcode ontbreekt'}
 $stream=$dex.Open();$memory=New-Object System.IO.MemoryStream
 try{$stream.CopyTo($memory);$code=[System.Text.Encoding]::UTF8.GetString($memory.ToArray())}finally{$stream.Dispose();$memory.Dispose()}
 if($code -match 'UpdateApkProvider|ApkDownload|app-update.json'){throw 'GitHub-installer in Play-bundel aanwezig'}
 if(!$code.Contains('Lcom/google/android/play/core/appupdate/AppUpdateManager;')){throw 'Play-updater ontbreekt'}
 if($zip.Entries.FullName -match '\.keystore$|play-signing.properties$'){throw 'Privésleutel in bundel'}
 foreach($file in @('index.html','app.js','app.css','social.mjs','logo.svg')){
  $entry=$zip.GetEntry("base/assets/$file");if(!$entry){throw "Asset ontbreekt: $file"}
  $reader=New-Object System.IO.StreamReader($entry.Open())
  try{$actual=$reader.ReadToEnd()}finally{$reader.Dispose()}
  $expected=[System.IO.File]::ReadAllText((Join-Path $PWD "android/app/src/main/assets/$file"))
  if($actual -cne $expected){throw "Asset wijkt af: $file"}
 }
}finally{$zip.Dispose()}
Write-Output 'Play-bundel gecontroleerd: ondertekend, juiste pakketnaam, actuele interface, Play-updater, geen APK-installer of privésleutels.'
