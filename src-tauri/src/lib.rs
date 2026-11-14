use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri_plugin_autostart::MacosLauncher;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
};

const LIST_APPS_SCRIPT: &str = include_str!("../scripts/list_apps.ps1");
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static APPS_CACHE: Mutex<Option<Vec<AppEntry>>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppEntry {
    name: String,
    app_id: String,
    target: Option<String>,
    icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    ext: String,
    size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DriveEntry {
    letter: String,
    label: String,
    total: u64,
    free: u64,
}

fn desktop_dir() -> Result<PathBuf, String> {
    if let Some(dir) = dirs::desktop_dir() {
        if dir.exists() {
            return Ok(dir);
        }
    }
    let home = std::env::var("USERPROFILE").map_err(|_| "找不到用户目录".to_string())?;
    Ok(PathBuf::from(home).join("Desktop"))
}

fn file_entry(path: &Path) -> Option<FileEntry> {
    let metadata = fs::metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    if name.eq_ignore_ascii_case("desktop.ini") {
        return None;
    }
    let is_dir = metadata.is_dir();
    let ext = if is_dir {
        String::new()
    } else {
        path.extension()
            .map(|value| value.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    };
    Some(FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        ext,
        size: if is_dir { 0 } else { metadata.len() },
    })
}

fn read_dir_entries(dir: &Path, limit: usize) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let reader = fs::read_dir(dir).map_err(|error| format!("无法读取目录: {error}"))?;

    for item in reader.flatten() {
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('$') || name.starts_with('.') {
            continue;
        }
        if name.eq_ignore_ascii_case("System Volume Information")
            || name.eq_ignore_ascii_case("RECYCLER")
            || name.eq_ignore_ascii_case("Thumbs.db")
        {
            continue;
        }
        if let Some(entry) = file_entry(&path) {
            entries.push(entry);
        }
        if entries.len() >= limit {
            break;
        }
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[cfg(windows)]
fn run_powershell_script(script: &str, file_name: &str) -> Result<String, String> {
    let script_dir = std::env::temp_dir().join("resleek-launcher");
    fs::create_dir_all(&script_dir).map_err(|error| format!("创建临时目录失败: {error}"))?;
    let script_path = script_dir.join(file_name);
    fs::write(&script_path, script).map_err(|error| format!("写入脚本失败: {error}"))?;

    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&script_path)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("启动 PowerShell 失败: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stdout_preview: String = stdout.chars().take(240).collect();
        return Err(format!(
            "PowerShell 退出码 {:?}: {} {}",
            output.status.code(),
            stderr.trim(),
            stdout_preview.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(windows)]
fn run_powershell(script: &str) -> Result<String, String> {
    run_powershell_script(script, "list-apps.ps1")
}

#[cfg(not(windows))]
fn run_powershell(_script: &str) -> Result<String, String> {
    Err("应用列表目前仅支持 Windows".to_string())
}

#[cfg(not(windows))]
fn run_powershell_script(_script: &str, _file_name: &str) -> Result<String, String> {
    Err("该操作目前仅支持 Windows".to_string())
}

fn is_absolute_windows_path(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

#[tauri::command]
fn list_apps(force: Option<bool>) -> Result<Vec<AppEntry>, String> {
    if !force.unwrap_or(false) {
        if let Ok(cache) = APPS_CACHE.lock() {
            if let Some(apps) = cache.as_ref() {
                return Ok(apps.clone());
            }
        }
    }

    let output = run_powershell(LIST_APPS_SCRIPT)?;
    let start = output.find('[').ok_or_else(|| "应用列表输出为空".to_string())?;
    let end = output.rfind(']').ok_or_else(|| "应用列表输出不完整".to_string())?;
    let apps: Vec<AppEntry> =
        serde_json::from_str(&output[start..=end]).map_err(|error| format!("解析应用列表失败: {error}"))?;

    if let Ok(mut cache) = APPS_CACHE.lock() {
        *cache = Some(apps.clone());
    }
    Ok(apps)
}

#[tauri::command]
fn launch_app(app_id: String, target: Option<String>) -> Result<(), String> {
    if let Some(target) = target.as_deref().filter(|value| !value.trim().is_empty()) {
        if target.contains("://") {
            Command::new("rundll32.exe")
                .args(["url.dll,FileProtocolHandler", target])
                .spawn()
                .map_err(|error| format!("打开链接失败: {error}"))?;
            return Ok(());
        }

        if is_absolute_windows_path(target) {
            let path = Path::new(target);
            if path.is_file() {
                if path
                    .extension()
                    .map(|value| value.eq_ignore_ascii_case("lnk"))
                    .unwrap_or(false)
                {
                    Command::new("explorer.exe")
                        .arg(path)
                        .spawn()
                        .map_err(|error| format!("启动快捷方式失败: {error}"))?;
                } else {
                    Command::new(path)
                        .spawn()
                        .map_err(|error| format!("启动应用失败: {error}"))?;
                }
                return Ok(());
            }
            if path.is_dir() {
                Command::new("explorer.exe")
                    .arg(path)
                    .spawn()
                    .map_err(|error| format!("打开文件夹失败: {error}"))?;
                return Ok(());
            }
            return Err(format!("快捷方式目标不存在: {target}"));
        }
    }

    if is_absolute_windows_path(&app_id) {
        let path = Path::new(&app_id);
        if path.is_file() {
            Command::new(path)
                .spawn()
                .map_err(|error| format!("启动应用失败: {error}"))?;
            return Ok(());
        }
        if path.is_dir() {
            Command::new("explorer.exe")
                .arg(path)
                .spawn()
                .map_err(|error| format!("打开文件夹失败: {error}"))?;
            return Ok(());
        }
        return Err(format!("应用路径不存在: {app_id}"));
    }

    if app_id.starts_with("shell:") {
        Command::new("explorer.exe")
            .arg(&app_id)
            .spawn()
            .map_err(|error| format!("打开系统位置失败: {error}"))?;
        return Ok(());
    }

    if app_id.contains("://") {
        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &app_id])
            .spawn()
            .map_err(|error| format!("打开协议链接失败: {error}"))?;
        return Ok(());
    }

    Command::new("explorer.exe")
        .arg(format!("shell:AppsFolder\\{app_id}"))
        .spawn()
        .map_err(|error| format!("启动应用失败: {error}"))?;
    Ok(())
}

#[tauri::command]
fn open_special(kind: String) -> Result<(), String> {
    let target = match kind.as_str() {
        "this-pc" => "shell:MyComputerFolder",
        "recycle-bin" => "shell:RecycleBinFolder",
        _ => return Err("未知的系统位置".to_string()),
    };
    Command::new("explorer.exe")
        .arg(target)
        .spawn()
        .map_err(|error| format!("打开系统位置失败: {error}"))?;
    Ok(())
}

#[tauri::command]
fn list_desktop_files() -> Result<Vec<FileEntry>, String> {
    read_dir_entries(&desktop_dir()?, 400)
}

#[cfg(windows)]
#[tauri::command]
fn list_removable_drives() -> Vec<DriveEntry> {
    let mut drives = Vec::new();
    let mask = unsafe { GetLogicalDrives() };

    for index in 0..26u32 {
        if mask & (1 << index) == 0 {
            continue;
        }
        let letter = (b'A' + index as u8) as char;
        let root = format!("{letter}:\\");
        let wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

        let drive_type = unsafe { GetDriveTypeW(wide.as_ptr()) };
        if drive_type != 2 {
            continue;
        }

        let mut label_buffer = [0u16; 261];
        let got_label = unsafe {
            GetVolumeInformationW(
                wide.as_ptr(),
                label_buffer.as_mut_ptr(),
                label_buffer.len() as u32,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                0,
            )
        };

        let label = if got_label != 0 {
            let length = label_buffer
                .iter()
                .position(|value| *value == 0)
                .unwrap_or(0);
            String::from_utf16_lossy(&label_buffer[..length])
        } else {
            String::new()
        };

        let mut free = 0u64;
        let mut total = 0u64;
        let got_space = unsafe {
            GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, &mut total, std::ptr::null_mut())
        };

        drives.push(DriveEntry {
            letter: format!("{letter}:"),
            label: if label.is_empty() {
                "可移动设备".to_string()
            } else {
                label
            },
            total: if got_space != 0 { total } else { 0 },
            free: if got_space != 0 { free } else { 0 },
        });
    }

    drives
}

#[cfg(not(windows))]
#[tauri::command]
fn list_removable_drives() -> Vec<DriveEntry> {
    Vec::new()
}

#[tauri::command]
fn list_drive_files(root: String) -> Result<Vec<FileEntry>, String> {
    let trimmed = root.trim();
    let bytes = trimmed.as_bytes();
    let valid_root = bytes.len() == 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/');
    if !valid_root {
        return Err("无效的设备路径".to_string());
    }
    let path = PathBuf::from(format!("{}\\", &trimmed[..2]));
    read_dir_entries(&path, 400)
}

#[tauri::command]
fn list_folder_files(path: String) -> Result<Vec<FileEntry>, String> {
    let folder = PathBuf::from(path.trim());
    if !folder.is_absolute() || !folder.is_dir() {
        return Err("无效的文件夹路径".to_string());
    }
    read_dir_entries(&folder, 400)
}

#[tauri::command]
fn eject_drive(letter: String) -> Result<(), String> {
    let trimmed = letter
        .trim()
        .trim_end_matches(&['\\', '/'][..])
        .to_uppercase();
    let bytes = trimmed.as_bytes();
    if bytes.len() != 2 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' {
        return Err("无效的驱动器盘符".to_string());
    }

    const EJECT_SCRIPT: &str = include_str!("../scripts/eject_drive.ps1");
    let script = format!(
        "\u{feff}{}",
        EJECT_SCRIPT.replace("__LETTER__", &trimmed)
    );
    run_powershell_script(&script, "eject-drive.ps1")?;
    Ok(())
}

fn unique_destination(dir: &Path, source: &Path) -> PathBuf {
    let name = source
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "未命名".to_string());
    let mut candidate = dir.join(&name);
    if !candidate.exists() {
        return candidate;
    }

    let source_path = Path::new(&name);
    let stem = source_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| name.clone());
    let extension = source_path.extension().map(|value| value.to_string_lossy());
    let mut index = 2;
    loop {
        let file_name = match &extension {
            Some(ext) => format!("{stem} ({index}).{ext}"),
            None => format!("{stem} ({index})"),
        };
        candidate = dir.join(file_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

fn copy_dir_all(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| format!("创建目录失败: {error}"))?;
    for item in fs::read_dir(source)
        .map_err(|error| format!("读取目录失败: {error}"))?
        .flatten()
    {
        let path = item.path();
        let destination = target.join(item.file_name());
        if path.is_dir() {
            copy_dir_all(&path, &destination)?;
        } else {
            fs::copy(&path, &destination).map_err(|error| format!("复制文件失败: {error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn copy_to_desktop(source: String) -> Result<FileEntry, String> {
    let source_path = PathBuf::from(&source);
    if !source_path.exists() {
        return Err("源文件不存在".to_string());
    }

    let destination_dir = desktop_dir()?;
    fs::create_dir_all(&destination_dir).map_err(|error| format!("创建桌面目录失败: {error}"))?;
    let destination = unique_destination(&destination_dir, &source_path);

    if source_path.is_dir() {
        copy_dir_all(&source_path, &destination)?;
    } else {
        fs::copy(&source_path, &destination).map_err(|error| format!("复制文件失败: {error}"))?;
    }

    file_entry(&destination).ok_or_else(|| "复制完成但无法读取目标文件".to_string())
}

#[tauri::command]
fn recycle_path(path: String) -> Result<(), String> {
    let source = PathBuf::from(&path);
    if !source.exists() {
        return Err("文件不存在".to_string());
    }
    if !is_absolute_windows_path(&path) {
        return Err("无效的文件路径".to_string());
    }

    let escaped = path.replace('\'', "''");
    let method = if source.is_dir() {
        "DeleteDirectory"
    } else {
        "DeleteFile"
    };
    let script = format!(
        "Add-Type -AssemblyName Microsoft.VisualBasic\n[Microsoft.VisualBasic.FileIO.FileSystem]::{method}('{escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')"
    );
    run_powershell_script(&script, "recycle.ps1")?;
    Ok(())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("文件不存在".to_string());
    }

    if target.is_dir() {
        Command::new("explorer.exe")
            .arg(target)
            .spawn()
            .map_err(|error| format!("打开文件夹失败: {error}"))?;
    } else {
        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &path])
            .spawn()
            .map_err(|error| format!("打开文件失败: {error}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            list_apps,
            launch_app,
            open_special,
            list_desktop_files,
            list_removable_drives,
            list_drive_files,
            list_folder_files,
            eject_drive,
            copy_to_desktop,
            recycle_path,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
