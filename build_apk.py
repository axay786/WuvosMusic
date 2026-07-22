import os
import shutil
import urllib.request
import zipfile
import subprocess
import sys

# Constants
JDK_URL = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/adoptium?project=jdk"
JDK_ZIP = "jdk17.zip"
JDK_DIR = "jdk-17"
APK_ASSETS_DIR = os.path.join("APK", "app", "src", "main", "assets")

def setup_assets():
    print("Setting up Android assets...")
    # Clean and recreate target assets folder
    if os.path.exists(APK_ASSETS_DIR):
        shutil.rmtree(APK_ASSETS_DIR)
    os.makedirs(APK_ASSETS_DIR, exist_ok=True)
    
    # Copy templates/index.html to index.html in assets
    src_index = os.path.join("templates", "index.html")
    dest_index = os.path.join(APK_ASSETS_DIR, "index.html")
    shutil.copy(src_index, dest_index)
    
    # Copy static/ to assets/static/
    src_static = "static"
    dest_static = os.path.join(APK_ASSETS_DIR, "static")
    shutil.copytree(src_static, dest_static)
    
    # Copy git_config.json to assets/git_config.json
    src_config = "git_config.json"
    dest_config = os.path.join(APK_ASSETS_DIR, "git_config.json")
    shutil.copy(src_config, dest_config)
    print("Assets setup completed successfully (explicitly excluding the APK folder itself).")

def download_jdk():
    if os.path.exists(JDK_DIR):
        print("Found existing JDK folder. Skipping download.")
        return
    
    print("Downloading portable JDK 17...")
    headers = {"User-Agent": "Wuvos-Builder"}
    req = urllib.request.Request(JDK_URL, headers=headers)
    
    with urllib.request.urlopen(req) as response, open(JDK_ZIP, 'wb') as out_file:
        total_size = int(response.info().get('Content-Length', 0))
        downloaded = 0
        chunk_size = 1024 * 1024
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total_size:
                percent = (downloaded / total_size) * 100
                print(f"Downloading: {percent:.1f}% ({downloaded / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB)", end='\r')
        print("\nDownload finished.")
        
    print("Extracting JDK...")
    with zipfile.ZipFile(JDK_ZIP, 'r') as zip_ref:
        zip_ref.extractall("jdk_temp")
        
    # Move the extracted subfolder to jdk-17
    extracted_dirs = os.listdir("jdk_temp")
    if extracted_dirs:
        shutil.move(os.path.join("jdk_temp", extracted_dirs[0]), JDK_DIR)
        
    # Clean up temp files
    shutil.rmtree("jdk_temp")
    if os.path.exists(JDK_ZIP):
        os.remove(JDK_ZIP)
    print("JDK setup completed.")

def build_apk():
    print("Building Android APK...")
    # Find absolute path of JDK dir
    jdk_abs_path = os.path.abspath(JDK_DIR)
    
    # Find gradlew.bat
    gradlew = os.path.abspath(os.path.join("APK", "gradlew.bat"))
    if not os.path.exists(gradlew):
        print(f"Error: gradlew.bat not found at {gradlew}")
        return False
        
    env = os.environ.copy()
    env["JAVA_HOME"] = jdk_abs_path
    
    print(f"Using JAVA_HOME={jdk_abs_path}")
    print("Running gradlew assembleDebug...")
    
    proc = subprocess.run([gradlew, "assembleDebug"], cwd="APK", env=env)
    if proc.returncode == 0:
        print("APK Build Successful!")
        # Copy output APK
        src_apk = os.path.join("APK", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
        dest_apk = "WuvosMusic.apk"
        if os.path.exists(src_apk):
            shutil.copy(src_apk, dest_apk)
            print(f"Copied APK to root directory: {os.path.abspath(dest_apk)}")
            return True
        else:
            print("Error: Built APK file not found at the expected location.")
    else:
        print(f"Error: Gradle build failed with code {proc.returncode}")
        
    return False

if __name__ == "__main__":
    setup_assets()
    try:
        download_jdk()
        build_apk()
    except Exception as e:
        print(f"An error occurred during build: {e}")
