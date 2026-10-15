param([Parameter(Mandatory=$true)][string]$AndroidJar, [Parameter(Mandatory=$true)][string]$BuildTools, [Parameter(Mandatory=$true)][string]$Jdk)
$ErrorActionPreference='Stop'
$projectDir=$PSScriptRoot
$buildDir=Join-Path $projectDir 'build'
$javaDir=Join-Path $Jdk 'bin'
$sourceDir=Join-Path $projectDir 'app/src/main'
foreach ($directory in @($buildDir,"$buildDir/generated","$buildDir/classes","$buildDir/dex")) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
function Run-Tool([string]$tool,[string[]]$arguments) { & $tool @arguments; if ($LASTEXITCODE -ne 0) { throw "Build failed: $tool" } }
Run-Tool "$BuildTools/aapt2.exe" @('compile','--dir',"$sourceDir/res",'-o',"$buildDir/resources.zip")
$manualManifest = [xml](Get-Content -LiteralPath "$sourceDir/AndroidManifest.xml" -Raw -Encoding UTF8)
$manualManifest.DocumentElement.SetAttribute('package','io.studentos.shortcuts')
$manualManifest.Save("$buildDir/AndroidManifest.xml")
Run-Tool "$BuildTools/aapt2.exe" @('link','-o',"$buildDir/resources.apk",'-I',$AndroidJar,'--manifest',"$buildDir/AndroidManifest.xml",'--java',"$buildDir/generated",'--min-sdk-version','26','--target-sdk-version','35','--version-code','2','--version-name','preview','--debug-mode',"$buildDir/resources.zip")
$sources=@(Get-ChildItem -LiteralPath "$sourceDir/java","$buildDir/generated" -Recurse -Filter '*.java' | ForEach-Object {$_.FullName})
Run-Tool "$javaDir/javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-bootclasspath',"$AndroidJar;$BuildTools/core-lambda-stubs.jar",'-d',"$buildDir/classes") + $sources)
Run-Tool "$javaDir/jar.exe" @('cf',"$buildDir/classes.jar",'-C',"$buildDir/classes",'.')
Run-Tool "$javaDir/java.exe" @('-cp',"$BuildTools/lib/d8.jar",'com.android.tools.r8.D8','--lib',$AndroidJar,'--min-api','26','--output',"$buildDir/dex","$buildDir/classes.jar")
Copy-Item -LiteralPath "$buildDir/resources.apk" -Destination "$buildDir/unsigned.apk" -Force
Run-Tool "$javaDir/jar.exe" @('uf',"$buildDir/unsigned.apk",'-C',"$buildDir/dex",'classes.dex')
Run-Tool "$BuildTools/zipalign.exe" @('-f','4',"$buildDir/unsigned.apk","$buildDir/aligned.apk")
$key=Join-Path $buildDir 'preview.jks'
if (!(Test-Path -LiteralPath $key)) {
    Run-Tool "$javaDir/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','preview','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Student OS Local Preview,O=Student OS,C=TH')
}
$output=Join-Path $projectDir 'studentos-shortcuts-preview.apk'
Run-Tool "$javaDir/java.exe" @('-jar',"$BuildTools/lib/apksigner.jar",'sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$output,"$buildDir/aligned.apk")
Run-Tool "$javaDir/java.exe" @('-jar',"$BuildTools/lib/apksigner.jar",'verify','--verbose',$output)
Write-Output "APK: $output"
