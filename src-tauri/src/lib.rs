use http_range::HttpRange;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use anyhow::Result;
use uuid::Uuid;
use std::sync::{Arc, LazyLock};
use tokio::sync::Mutex;
use warp::Filter;
use warp::http::{header, StatusCode};
use base64::{Engine as _, engine::general_purpose};
use reqwest::Client;
use std::fs::{self, File};
use std::io::copy;
use zip::ZipArchive;

fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    
    // Hide command window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd
}

fn create_hidden_command_with_path(path: &std::path::Path) -> Command {
    let mut cmd = Command::new(path);
    
    // Hide command window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd
}

const GITHUB_API_URL: &str = "https://api.github.com/repos/";

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub format: String,
    pub output_path: String,
    pub anonymize_filename: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub id: String,
    pub url: String,
    pub progress: f64,
    pub status: String,
    pub filename: Option<String>,
    pub error: Option<String>,
    pub is_anonymized: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EditRequest {
    pub input_path: String,
    pub output_path: String,
    pub operations: Vec<EditOperation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EditOperation {
    pub operation_type: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaInfo {
    pub filename: String,
    pub duration: Option<String>,
    pub resolution: Option<String>,
    pub format: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfoRequest {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfoResponse {
    pub title: Option<String>,
    pub duration: Option<String>,
    pub available_resolutions: Vec<String>,
    pub max_resolution: Option<String>,
    pub has_audio: bool,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GithubRelease {
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub default_quality: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_quality: "1080p".to_string(),
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    request: DownloadRequest,
) -> Result<String, String> {
    let download_id = Uuid::new_v4().to_string();
    
    // Emit initial progress
    let progress = DownloadProgress {
        id: download_id.clone(),
        url: request.url.clone(),
        progress: 0.0,
        status: "starting".to_string(),
        filename: None,
        error: None,
        is_anonymized: Some(request.anonymize_filename),
    };
    
    app.emit("download-progress", &progress)
        .map_err(|e| e.to_string())?;

    // Start download in background
    let app_clone = app.clone();
    let download_id_clone = download_id.clone();
    
    tauri::async_runtime::spawn(async move {
        if let Err(e) = execute_download(app_clone, download_id_clone, request).await {
            eprintln!("Download error: {}", e);
        }
    });

    Ok(download_id)
}

async fn execute_download(
    app: tauri::AppHandle,
    download_id: String,
    request: DownloadRequest,
) -> Result<()> {
    let ytdlp_cmd = get_yt_dlp_command();
    let mut cmd = if ytdlp_cmd == "managed" {
        let ytdlp_path = get_yt_dlp_path(&app);
        create_hidden_command_with_path(&ytdlp_path)
    } else {
        create_hidden_command("yt-dlp")
    };

    // Generate filename based on anonymization setting
    let filename_pattern = if request.anonymize_filename {
        // Generate anonymized filename: video_timestamp_random.ext
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let random_string: String = (0..6)
            .map(|_| {
                let chars = b"abcdefghijklmnopqrstuvwxyz0123456789";
                chars[fastrand::usize(..chars.len())] as char
            })
            .collect();
        format!("{}/video_{}_{}.%(ext)s", request.output_path, timestamp, random_string)
    } else {
        // Use original video title
        format!("{}/%(title)s.%(ext)s", request.output_path)
    };

    cmd.arg("--format")
        .arg(&request.format)
        .arg("--output")
        .arg(&filename_pattern)
        .arg("--progress")
        .arg("--no-warnings")
        .arg(&request.url);

    // Emit progress updates
    let progress = DownloadProgress {
        id: download_id.clone(),
        url: request.url.clone(),
        progress: 50.0,
        status: "downloading".to_string(),
        filename: Some("video.mp4".to_string()),
        error: None,
        is_anonymized: Some(request.anonymize_filename),
    };
    
    let _ = app.emit("download-progress", &progress);

    // Execute the command (simplified for demo)
    match cmd.output() {
        Ok(output) => {
            let final_progress = DownloadProgress {
                id: download_id,
                url: request.url,
                progress: 100.0,
                status: if output.status.success() { "completed".to_string() } else { "error".to_string() },
                filename: Some("video.mp4".to_string()),
                error: if output.status.success() { 
                    None 
                } else { 
                    Some(String::from_utf8_lossy(&output.stderr).to_string()) 
                },
                is_anonymized: Some(request.anonymize_filename),
            };
            let _ = app.emit("download-progress", &final_progress);
        }
        Err(e) => {
            let error_progress = DownloadProgress {
                id: download_id,
                url: request.url,
                progress: 0.0,
                status: "error".to_string(),
                filename: None,
                error: Some(e.to_string()),
                is_anonymized: Some(request.anonymize_filename),
            };
            let _ = app.emit("download-progress", &error_progress);
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_video_info(app: tauri::AppHandle, file_path: String) -> Result<MediaInfo, String> {
    let ffprobe_cmd = get_ffprobe_command();
    let mut cmd = if ffprobe_cmd == "managed" {
        let ffprobe_path = get_ffprobe_path(&app);
        create_hidden_command_with_path(&ffprobe_path)
    } else {
        create_hidden_command("ffprobe")
    };

    cmd.arg("-v")
        .arg("quiet")
        .arg("-print_format")
        .arg("json")
        .arg("-show_format")
        .arg("-show_streams")
        .arg(&file_path);

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                // Try to parse real ffprobe output, fallback to basic info
                let output_str = String::from_utf8_lossy(&output.stdout);
                
                // Basic file info
                let filename = PathBuf::from(&file_path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                
                let size = std::fs::metadata(&file_path)
                    .map(|meta| meta.len())
                    .unwrap_or(0);
                
                // Try to extract info from JSON output
                let (duration, resolution, format) = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
                    let duration = json.get("format")
                        .and_then(|f| f.get("duration"))
                        .and_then(|d| d.as_str())
                        .and_then(|d| d.parse::<f64>().ok())
                        .map(|d| format!("{:02}:{:02}", (d as u64) / 60, (d as u64) % 60));
                    
                    let video_stream = json.get("streams")
                        .and_then(|s| s.as_array())
                        .and_then(|streams| streams.iter().find(|s| 
                            s.get("codec_type").and_then(|c| c.as_str()) == Some("video")
                        ));
                    
                    let resolution = video_stream
                        .and_then(|s| {
                            let width = s.get("width")?.as_u64()?;
                            let height = s.get("height")?.as_u64()?;
                            Some(format!("{}x{}", width, height))
                        });
                    
                    let format = json.get("format")
                        .and_then(|f| f.get("format_name"))
                        .and_then(|f| f.as_str())
                        .unwrap_or("Unknown")
                        .to_uppercase();
                    
                    (duration, resolution, format)
                } else {
                    // Fallback values
                    (None, None, "Unknown".to_string())
                };
                
                let info = MediaInfo {
                    filename,
                    duration,
                    resolution,
                    format,
                    size,
                };
                Ok(info)
            } else {
                Err("Failed to get video info".to_string())
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn process_video(
    app: tauri::AppHandle,
    request: EditRequest,
) -> Result<String, String> {
    let process_id = Uuid::new_v4().to_string();
    
    // Start processing in background
    let app_clone = app.clone();
    let process_id_clone = process_id.clone();
    
    tauri::async_runtime::spawn(async move {
        if let Err(e) = execute_video_processing(app_clone, process_id_clone, request).await {
            eprintln!("Processing error: {}", e);
        }
    });

    Ok(process_id)
}

async fn execute_video_processing(
    app: tauri::AppHandle,
    process_id: String,
    request: EditRequest,
) -> Result<()> {
    let ffmpeg_cmd = get_ffmpeg_command();
    let mut cmd = if ffmpeg_cmd == "managed" {
        let ffmpeg_path = get_ffmpeg_path(&app);
        create_hidden_command_with_path(&ffmpeg_path)
    } else {
        create_hidden_command("ffmpeg")
    };

    // Disable fontconfig to avoid configuration errors on Windows
    cmd.env("FONTCONFIG_FILE", "");
    cmd.env("FONTCONFIG_PATH", "");
    
    // Collect all trim operations to handle multiple segments
    let mut trim_operations: Vec<(f64, f64)> = Vec::new();
    
    for operation in &request.operations {
        if operation.operation_type == "trim" {
            if let Some(start) = operation.params.get("start").and_then(|v| v.as_f64()) {
                if let Some(end) = operation.params.get("end").and_then(|v| v.as_f64()) {
                    trim_operations.push((start, end));
                }
            }
        }
    }
    
    cmd.arg("-i").arg(&request.input_path);
    
    // Handle multiple trim segments using select filter
    let mut trim_filters = Vec::new();
    if !trim_operations.is_empty() {
        for (i, (start, end)) in trim_operations.iter().enumerate() {
            let duration = end - start;
            trim_filters.push(format!("[0:v]trim=start={}:duration={},setpts=PTS-STARTPTS[v{}]", start, duration, i));
            trim_filters.push(format!("[0:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS[a{}]", start, duration, i));
        }
        
        // Concatenate all segments if multiple
        if trim_operations.len() > 1 {
            let concat_inputs: String = (0..trim_operations.len())
                .map(|i| format!("[v{}][a{}]", i, i))
                .collect();
            trim_filters.push(format!("{}concat=n={}:v=1:a=1[trimmed_v][trimmed_a]", concat_inputs, trim_operations.len()));
        } else {
            trim_filters.push("[v0][a0]concat=n=1:v=1:a=1[trimmed_v][trimmed_a]".to_string());
        }
    }

    // Build filter complex for video operations
    let mut video_filters = Vec::new();
    let mut audio_filters = Vec::new();
    
    for operation in &request.operations {
        match operation.operation_type.as_str() {
            "trim" => {
                // Already handled above
                continue;
            }
            "crop" => {
                if let Some(x) = operation.params.get("x").and_then(|v| v.as_f64()) {
                    if let Some(y) = operation.params.get("y").and_then(|v| v.as_f64()) {
                        if let Some(width) = operation.params.get("width").and_then(|v| v.as_f64()) {
                            if let Some(height) = operation.params.get("height").and_then(|v| v.as_f64()) {
                                video_filters.push(format!("crop={}:{}:{}:{}", width, height, x, y));
                            }
                        }
                    }
                }
            }
            "filter" => {
                if let Some(filter_type) = operation.params.get("filterType").and_then(|v| v.as_str()) {
                    let filter = match filter_type {
                        "blur" => {
                            let intensity = operation.params.get("intensity").and_then(|v| v.as_f64()).unwrap_or(2.0);
                            format!("boxblur={}:1", intensity)
                        },
                        "sharpen" => {
                            let intensity = operation.params.get("intensity").and_then(|v| v.as_f64()).unwrap_or(1.0);
                            format!("unsharp=5:5:{}:5:5:0.0", intensity)
                        },
                        "brightness" => {
                            let intensity = operation.params.get("intensity").and_then(|v| v.as_f64()).unwrap_or(0.2);
                            format!("eq=brightness={}", intensity)
                        },
                        "contrast" => {
                            let intensity = operation.params.get("intensity").and_then(|v| v.as_f64()).unwrap_or(1.5);
                            format!("eq=contrast={}", intensity)
                        },
                        "saturation" => {
                            let intensity = operation.params.get("intensity").and_then(|v| v.as_f64()).unwrap_or(1.5);
                            format!("eq=saturation={}", intensity)
                        },
                        "grayscale" => "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3".to_string(),
                        "sepia" => "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131".to_string(),
                        "vintage" => "curves=vintage".to_string(),
                        "invert" => "negate".to_string(),
                        _ => continue,
                    };
                    video_filters.push(filter);
                }
            }
            "volume" => {
                if let Some(level) = operation.params.get("level").and_then(|v| v.as_f64()) {
                    audio_filters.push(format!("volume={}", level));
                }
            }
            "rotate" => {
                if let Some(angle) = operation.params.get("angle").and_then(|v| v.as_f64()) {
                    match angle as i32 {
                        90 => video_filters.push("transpose=1".to_string()),
                        180 => video_filters.push("transpose=2,transpose=2".to_string()),
                        270 => video_filters.push("transpose=2".to_string()),
                        _ => {}
                    }
                }
            }
            "speed" => {
                if let Some(speed) = operation.params.get("speed").and_then(|v| v.as_f64()) {
                    video_filters.push(format!("setpts={}*PTS", 1.0 / speed));
                    audio_filters.push(format!("atempo={}", speed));
                }
            }
            "fade" => {
                if let Some(fade_type) = operation.params.get("fadeType").and_then(|v| v.as_str()) {
                    if let Some(duration) = operation.params.get("duration").and_then(|v| v.as_f64()) {
                        match fade_type {
                            "in" => video_filters.push(format!("fade=t=in:st=0:d={}", duration)),
                            "out" => video_filters.push(format!("fade=t=out:st={}:d={}", duration, duration)),
                            _ => {}
                        }
                    }
                }
            }
            "text" => {
                if let Some(text) = operation.params.get("text").and_then(|v| v.as_str()) {
                    let x = operation.params.get("x").and_then(|v| v.as_f64()).unwrap_or(50.0);
                    let y = operation.params.get("y").and_then(|v| v.as_f64()).unwrap_or(50.0);
                    let font_size = operation.params.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(24.0);
                    let color = operation.params.get("color").and_then(|v| v.as_str()).unwrap_or("#ffffff");
                    let font_family = operation.params.get("fontFamily").and_then(|v| v.as_str()).unwrap_or("Arial");
                    let start_time = operation.params.get("startTime").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let duration = operation.params.get("duration").and_then(|v| v.as_f64()).unwrap_or(5.0);
                    
                    // Convert percentage position to relative positioning
                    let x_pos = if x <= 100.0 { format!("(w-text_w)*{}/100", x) } else { x.to_string() };
                    let y_pos = if y <= 100.0 { format!("(h-text_h)*{}/100", y) } else { y.to_string() };
                    
                    // If text is empty after filtering, skip this operation
                    if text.trim().is_empty() {
                        continue;
                    }
                    
                    // On Windows, specifying a font file directly is more reliable than relying on fontconfig.
                    // NOTE: This assumes fonts are in C:/Windows/Fonts and have a .ttf extension.
                    // Using forward slashes is generally safer for ffmpeg paths.
                    let font_path = format!("C:/Windows/Fonts/{}.ttf", font_family);
                    
                    // Escape special characters for ffmpeg's filter syntax.
                    // The path needs to have colons and backslashes escaped for ffmpeg's parser.
                    let escaped_font_path = font_path.replace("\\", "\\\\").replace(":", "\\:");

                    // The text needs to have single quotes, colons and other special chars escaped.
                    let escaped_text = text
                        .replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace(":", "\\:")
                        .replace(",", "\\,");

                    // Convert HTML-style #RRGGBB to FFmpeg-friendly &HBBGGRR&
                    let escaped_color = if let Some(hex) = color.strip_prefix('#') {
                        format!("0x{}", hex)
                    } else {
                        color.to_string()
                    };
                    
                    let text_filter = format!(
                        "drawtext=fontfile={}:text={}:fontsize={}:fontcolor={}:x={}:y={}:enable='between(t,{},{})'",
                        escaped_font_path, escaped_text, font_size, escaped_color, x_pos, y_pos, start_time, start_time + duration
                    );
                    video_filters.push(text_filter);
                }
            }
            _ => {} // Unknown operation type
        }
    }
    
    // Combine all filters into a complex filter graph
    let mut all_filters = Vec::new();
    
    // Add trim filters first
    all_filters.extend(trim_filters);
    
    // Process other video filters on the trimmed output
    if !video_filters.is_empty() {
        let input_label = if trim_operations.is_empty() { "[0:v]" } else { "[trimmed_v]" };
        let combined_video_filter = format!("{}[final_v]", video_filters.join(","));
        all_filters.push(format!("{}{}", input_label, combined_video_filter));
    }
    
    // Process audio filters on the trimmed output
    if !audio_filters.is_empty() {
        let input_label = if trim_operations.is_empty() { "[0:a]" } else { "[trimmed_a]" };
        let combined_audio_filter = format!("{}[final_a]", audio_filters.join(","));
        all_filters.push(format!("{}{}", input_label, combined_audio_filter));
    }
    
    // Apply the complex filter if we have any filters
    if !all_filters.is_empty() {
        cmd.arg("-filter_complex").arg(all_filters.join(";"));
        
        // Map the outputs
        if !video_filters.is_empty() || !trim_operations.is_empty() {
            let video_output = if !video_filters.is_empty() { "[final_v]" } else { "[trimmed_v]" };
            cmd.arg("-map").arg(video_output);
        } else {
            cmd.arg("-map").arg("0:v");
        }
        
        // Always map audio stream (either filtered or original)
        if !audio_filters.is_empty() || !trim_operations.is_empty() {
            let audio_output = if !audio_filters.is_empty() { "[final_a]" } else { "[trimmed_a]" };
            cmd.arg("-map").arg(audio_output);
        } else {
            // Map original audio stream if no audio processing
            cmd.arg("-map").arg("0:a");
        }
    } else {
        // No filters at all, map streams directly
        cmd.arg("-map").arg("0:v").arg("-map").arg("0:a");
    }

    // Add codec and output settings to prevent crashes
    cmd.arg("-c:v").arg("libx264")  // Explicitly specify video codec
        .arg("-c:a").arg("aac")     // Explicitly specify audio codec
        .arg("-y").arg(&request.output_path);

    // Debug: Print the full command
    println!("FFmpeg command: {:?}", cmd);

    // Emit processing progress
    let _ = app.emit("processing-progress", serde_json::json!({
        "id": process_id,
        "progress": 50.0,
        "status": "processing"
    }));

    // Execute the command
    match cmd.output() {
        Ok(output) => {
            let stderr_output = String::from_utf8_lossy(&output.stderr).to_string();
            
            // Check if this is just a fontconfig warning (not a real error)
            let is_fontconfig_warning = stderr_output.contains("Fontconfig error") 
                && output.status.success();
            
            // Log the command output for debugging
            println!("FFmpeg stderr: {}", stderr_output);
            println!("FFmpeg exit status: {}", output.status);
            
            let _ = app.emit("processing-progress", serde_json::json!({
                "id": process_id,
                "progress": 100.0,
                "status": if output.status.success() { "completed" } else { "error" },
                "error": if output.status.success() { 
                    // Don't report fontconfig warnings as errors
                    if is_fontconfig_warning {
                        None::<String>
                    } else {
                        None::<String>
                    }
                } else { 
                    Some(stderr_output) 
                }
            }));
        }
        Err(e) => {
            let _ = app.emit("processing-progress", serde_json::json!({
                "id": process_id,
                "progress": 0.0,
                "status": "error",
                "error": e.to_string()
            }));
        }
    }

    Ok(())
}

#[tauri::command]
async fn fetch_video_info(
    app: tauri::AppHandle,
    request: VideoInfoRequest,
) -> Result<VideoInfoResponse, String> {
    let ytdlp_cmd = get_yt_dlp_command();
    let mut cmd = if ytdlp_cmd == "managed" {
        let ytdlp_path = get_yt_dlp_path(&app);
        create_hidden_command_with_path(&ytdlp_path)
    } else {
        create_hidden_command("yt-dlp")
    };

    // Use yt-dlp to get video information without downloading
    cmd.arg("--dump-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg(&request.url);

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                
                // Parse yt-dlp JSON output
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
                    let title = json.get("title")
                        .and_then(|t| t.as_str())
                        .map(|s| s.to_string());
                    
                    let duration = json.get("duration")
                        .and_then(|d| d.as_f64())
                        .map(|d| {
                            let minutes = (d as u64) / 60;
                            let seconds = (d as u64) % 60;
                            format!("{:02}:{:02}", minutes, seconds)
                        });
                    
                    // Extract available formats and resolutions
                    let mut available_resolutions = Vec::new();
                    let mut max_height = 0u64;
                    let mut has_audio = false;
                    
                    if let Some(formats) = json.get("formats").and_then(|f| f.as_array()) {
                        for format in formats {
                            // Improved audio detection logic
                            // Check for audio codec that is not "none" or null
                            if let Some(acodec) = format.get("acodec") {
                                if let Some(acodec_str) = acodec.as_str() {
                                    if acodec_str != "none" && !acodec_str.is_empty() {
                                        has_audio = true;
                                    }
                                }
                            }
                            
                            // Also check for audio bitrate as an indicator of audio presence
                            if let Some(abr) = format.get("abr") {
                                if abr.as_f64().unwrap_or(0.0) > 0.0 {
                                    has_audio = true;
                                }
                            }
                            
                            // Check for audio sample rate
                            if let Some(asr) = format.get("asr") {
                                if asr.as_u64().unwrap_or(0) > 0 {
                                    has_audio = true;
                                }
                            }
                            
                            // Extract video resolutions - handle both horizontal and vertical videos
                            if let Some(height) = format.get("height").and_then(|h| h.as_u64()) {
                                let width = format.get("width").and_then(|w| w.as_u64()).unwrap_or(0);
                                
                                // For quality determination, use the smaller dimension for vertical videos
                                // and height for horizontal videos
                                let quality_dimension = if width > 0 && height > width {
                                    // Vertical video: use width as the quality indicator
                                    width
                                } else {
                                    // Horizontal video: use height as the quality indicator
                                    height
                                };
                                
                                if quality_dimension > max_height {
                                    max_height = quality_dimension;
                                }
                                
                                let resolution = match quality_dimension {
                                    2160 => "4K (2160p)".to_string(),
                                    1440 => "1440p (QHD)".to_string(),
                                    1080 => "1080p (Full HD)".to_string(),
                                    720 => "720p (HD)".to_string(),
                                    480 => "480p (SD)".to_string(),
                                    360 => "360p".to_string(),
                                    _ => format!("{}p", quality_dimension),
                                };
                                
                                // Add aspect ratio info for better clarity
                                let aspect_info = if width > 0 && height > 0 {
                                    if height > width {
                                        format!(" ({}x{} Vertical)", width, height)
                                    } else {
                                        format!(" ({}x{})", width, height)
                                    }
                                } else {
                                    String::new()
                                };
                                
                                let full_resolution = format!("{}{}", resolution, aspect_info);
                                
                                if !available_resolutions.contains(&full_resolution) {
                                    available_resolutions.push(full_resolution);
                                }
                            }
                        }
                    }
                    
                    // Debug output for resolution detection issues
                    if max_height == 0 {
                        eprintln!("Warning: No video height detected from formats");
                    } else {
                        println!("Detected max resolution: {}p", max_height);
                    }
                    
                    // Additional fallback audio detection methods
                    if !has_audio {
                        // Check if there are any audio-only formats
                        if let Some(formats) = json.get("formats").and_then(|f| f.as_array()) {
                            for format in formats {
                                // Check if this is an audio-only format (no video height but has audio codec)
                                let has_video = format.get("height").is_some();
                                let has_audio_codec = format.get("acodec")
                                    .and_then(|a| a.as_str())
                                    .map(|s| s != "none" && !s.is_empty())
                                    .unwrap_or(false);
                                
                                if !has_video && has_audio_codec {
                                    has_audio = true;
                                    break;
                                }
                            }
                        }
                        
                        // Check top-level audio information from yt-dlp
                        if let Some(duration) = json.get("duration") {
                            if duration.as_f64().unwrap_or(0.0) > 0.0 {
                                // If we have duration but no explicit audio detection, 
                                // assume audio is available for most video content
                                has_audio = true;
                            }
                        }
                    }
                    
                    // Sort resolutions by quality (highest first)
                    available_resolutions.sort_by(|a, b| {
                        let height_a = extract_height_from_resolution(a);
                        let height_b = extract_height_from_resolution(b);
                        height_b.cmp(&height_a)
                    });
                    
                    let max_resolution = if max_height > 0 {
                        Some(match max_height {
                            2160 => "4K (2160p)".to_string(),
                            1440 => "1440p (QHD)".to_string(),
                            1080 => "1080p (Full HD)".to_string(),
                            720 => "720p (HD)".to_string(),
                            480 => "480p (SD)".to_string(),
                            360 => "360p".to_string(),
                            _ => format!("{}p", max_height),
                        })
                    } else {
                        None
                    };
                    
                    let thumbnail = json.get("thumbnail")
                        .and_then(|t| t.as_str())
                        .map(|s| s.to_string());
                    
                    let response = VideoInfoResponse {
                        title,
                        duration,
                        available_resolutions,
                        max_resolution,
                        has_audio,
                        thumbnail,
                    };
                    
                    Ok(response)
                } else {
                    Err("Failed to parse video information".to_string())
                }
            } else {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                Err(format!("Failed to fetch video info: {}", error_msg))
            }
        }
        Err(e) => Err(format!("Failed to execute yt-dlp: {}", e)),
    }
}

fn extract_height_from_resolution(resolution: &str) -> u64 {
    if resolution.contains("2160") || resolution.contains("4K") {
        2160
    } else if resolution.contains("1440") {
        1440
    } else if resolution.contains("1080") {
        1080
    } else if resolution.contains("720") {
        720
    } else if resolution.contains("480") {
        480
    } else if resolution.contains("360") {
        360
    } else {
        0
    }
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data directory");
    app_dir.join("settings.json")
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let settings_path = get_settings_path(&app);
    
    if settings_path.exists() {
        match fs::read_to_string(&settings_path) {
            Ok(content) => {
                match serde_json::from_str::<AppSettings>(&content) {
                    Ok(settings) => Ok(settings),
                    Err(_) => {
                        // If parsing fails, return default settings
                        Ok(AppSettings::default())
                    }
                }
            }
            Err(_) => Ok(AppSettings::default())
        }
    } else {
        // Create default settings file
        let default_settings = AppSettings::default();
        let _ = save_settings_to_file(&settings_path, &default_settings).await;
        Ok(default_settings)
    }
}

#[tauri::command]
async fn set_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path(&app);
    save_settings_to_file(&settings_path, &settings).await
}

async fn save_settings_to_file(path: &PathBuf, settings: &AppSettings) -> Result<(), String> {
    // Ensure the parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create settings directory: {}", e))?;
        }
    }
    
    let json_content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(path, json_content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn list_files(directory: String) -> Result<Vec<serde_json::Value>, String> {
    let path = PathBuf::from(&directory);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut items = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                let item_info = if metadata.is_dir() {
                    serde_json::json!({
                        "name": entry.file_name().to_string_lossy(),
                        "path": entry.path().to_string_lossy(),
                        "size": 0,
                        "modified": metadata.modified()
                            .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default().as_secs())
                            .unwrap_or(0),
                        "is_directory": true
                    })
                } else {
                    serde_json::json!({
                        "name": entry.file_name().to_string_lossy(),
                        "path": entry.path().to_string_lossy(),
                        "size": metadata.len(),
                        "modified": metadata.modified()
                            .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default().as_secs())
                            .unwrap_or(0),
                        "is_directory": false
                    })
                };
                items.push(item_info);
            }
        }
    }

    Ok(items)
}

#[tauri::command]
async fn delete_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
async fn open_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let result = Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err("Failed to open file".to_string())
                }
            }
            Err(e) => Err(format!("Failed to open file: {}", e))
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let result = Command::new("open")
            .arg(&file_path)
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err("Failed to open file".to_string())
                }
            }
            Err(e) => Err(format!("Failed to open file: {}", e))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let result = Command::new("xdg-open")
            .arg(&file_path)
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err("Failed to open file".to_string())
                }
            }
            Err(e) => Err(format!("Failed to open file: {}", e))
        }
    }
}

#[tauri::command]
async fn create_directory(directory_path: String) -> Result<(), String> {
    let path = PathBuf::from(&directory_path);
    
    if path.exists() {
        return Err("Directory already exists".to_string());
    }
    
    match std::fs::create_dir_all(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create directory: {}", e))
    }
}

#[tauri::command]
async fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);
    
    if !old.exists() {
        return Err("Item does not exist".to_string());
    }
    
    if new.exists() {
        return Err("Target path already exists".to_string());
    }
    
    match std::fs::rename(&old, &new) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to rename item: {}", e))
    }
}

#[tauri::command]
async fn move_item(source_path: String, destination_path: String) -> Result<(), String> {
    let source = PathBuf::from(&source_path);
    let dest = PathBuf::from(&destination_path);
    
    if !source.exists() {
        return Err("Source item does not exist".to_string());
    }
    
    // Create destination directory if it doesn't exist
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination directory: {}", e))?;
        }
    }
    
    match std::fs::rename(&source, &dest) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to move item: {}", e))
    }
}

#[tauri::command]
async fn delete_directory(directory_path: String) -> Result<(), String> {
    let path = PathBuf::from(&directory_path);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    match std::fs::remove_dir_all(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete directory: {}", e))
    }
}

static VIDEO_SERVER_PORT: LazyLock<Arc<Mutex<Option<u16>>>> = LazyLock::new(|| Arc::new(Mutex::new(None)));
static CURRENT_VIDEO_PATH: LazyLock<Arc<Mutex<Option<String>>>> = LazyLock::new(|| Arc::new(Mutex::new(None)));

#[tauri::command]
async fn start_video_server() -> Result<u16, String> {
    let mut port_guard = VIDEO_SERVER_PORT.lock().await;
    
    // If server is already running, return the port
    if let Some(port) = *port_guard {
        return Ok(port);
    }
    
    // Find an available port
    let port = find_available_port().await?;
    
    // Start the server
    let server = warp::path!("video" / String)
        .and(warp::header::optional::<String>("range"))
        .and(warp::get())
        .and_then(serve_video_file);
    
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["range", "content-type"])
        .allow_methods(&[warp::http::Method::GET, warp::http::Method::HEAD, warp::http::Method::OPTIONS]);
        
    let server = warp::serve(server.with(cors));
    
    tokio::spawn(async move {
        server.run(([127, 0, 0, 1], port)).await;
    });
    
    *port_guard = Some(port);
    println!("Video server started on port {}", port);
    Ok(port)
}

#[tauri::command]
async fn get_video_url(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    // Store the current video path
    let mut current_path = CURRENT_VIDEO_PATH.lock().await;
    *current_path = Some(file_path.clone());
    
    // Get or start the server
    let port = {
        let port_guard = VIDEO_SERVER_PORT.lock().await;
        if let Some(port) = *port_guard {
            port
        } else {
            drop(port_guard);
            start_video_server().await?
        }
    };
    
    // Return the URL to access the video
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("video.mp4");
    
    Ok(format!("http://127.0.0.1:{}/video/{}", port, urlencoding::encode(filename)))
}

async fn find_available_port() -> Result<u16, String> {
    use std::net::{TcpListener, SocketAddr};
    
    for port in 8080..9000 {
        let addr: SocketAddr = format!("127.0.0.1:{}", port).parse()
            .map_err(|e| format!("Invalid address: {}", e))?;
        
        if TcpListener::bind(addr).is_ok() {
            return Ok(port);
        }
    }
    
    Err("No available ports found".to_string())
}

async fn serve_video_file(_filename: String, range_header: Option<String>) -> Result<Box<dyn warp::Reply>, warp::Rejection> {
    let current_path_guard = CURRENT_VIDEO_PATH.lock().await;
    
    if let Some(video_path) = current_path_guard.as_ref() {
        let path = PathBuf::from(video_path);
        
        if path.exists() {
            let file_size = tokio::fs::metadata(&path).await.map(|m| m.len()).unwrap_or(0);
            let mut file = tokio::fs::File::open(&path).await.map_err(|_| warp::reject::not_found())?;
            
            let mime_type = mime_guess::from_path(&path).first_or_octet_stream().to_string();

            if let Some(range_str) = range_header {
                if let Ok(ranges) = HttpRange::parse(&range_str, file_size) {
                    if let Some(range) = ranges.first() {
                        use tokio::io::{AsyncReadExt, AsyncSeekExt};
                        let start = range.start;
                        let len = range.length;
                        let end = start + len - 1;

                        file.seek(std::io::SeekFrom::Start(start)).await.map_err(|_| warp::reject::custom(ServerError))?;
                        
                        let mut buffer = vec![0; len as usize];
                        file.read_exact(&mut buffer).await.map_err(|_| warp::reject::custom(ServerError))?;

                        let response = warp::http::Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, file_size))
                            .header(header::CONTENT_LENGTH, len)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(header::CONTENT_TYPE, mime_type.clone())
                            .body(buffer)
                            .map_err(|_| warp::reject::custom(ServerError))?;
                        return Ok(Box::new(response));
                    }
                }
            }

            // No range header or invalid range, serve the whole file
            let stream = tokio_util::io::ReaderStream::new(file);
            let body = warp::hyper::Body::wrap_stream(stream);
            
            let response = warp::http::Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_LENGTH, file_size)
                .header(header::CONTENT_TYPE, mime_type.clone())
                .header(header::ACCEPT_RANGES, "bytes")
                .body(body)
                .map_err(|_| warp::reject::custom(ServerError))?;
            
            return Ok(Box::new(response));
        }
    }
    
    Err(warp::reject::not_found())
}

#[derive(Debug)]
struct ServerError;
impl warp::reject::Reject for ServerError {}

#[tauri::command]
async fn check_dependencies(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let ytdlp_path = get_yt_dlp_path(&app);
    let ffmpeg_path = get_ffmpeg_path(&app);

    // Check if dependencies are available system-wide first
    let mut ytdlp_version = "Not found".to_string();
    let mut ffmpeg_version = "Not found".to_string();
    let mut ytdlp_installed = false;
    let mut ffmpeg_installed = false;

    // Check yt-dlp (system-wide first, then managed)
    if let Ok(output) = create_hidden_command("yt-dlp").arg("--version").output() {
        if output.status.success() {
            ytdlp_version = format!("System: {}", String::from_utf8_lossy(&output.stdout).trim());
            ytdlp_installed = true;
        }
    } else if ytdlp_path.exists() {
        if let Ok(output) = create_hidden_command_with_path(&ytdlp_path).arg("--version").output() {
            if output.status.success() {
                ytdlp_version = format!("Managed: {}", String::from_utf8_lossy(&output.stdout).trim());
                ytdlp_installed = true;
            }
        }
    }

    // Check ffmpeg (system-wide first, then managed)
    if let Ok(output) = create_hidden_command("ffmpeg").arg("-version").output() {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = output_str.lines().next() {
                let version = line.replace("ffmpeg version ", "").split_whitespace().next().unwrap_or("Unknown").to_string();
                ffmpeg_version = format!("System: {}", version);
                ffmpeg_installed = true;
            }
        }
    } else if ffmpeg_path.exists() {
        if let Ok(output) = create_hidden_command_with_path(&ffmpeg_path).arg("-version").output() {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = output_str.lines().next() {
                    let version = line.replace("ffmpeg version ", "").split_whitespace().next().unwrap_or("Unknown").to_string();
                    ffmpeg_version = format!("Managed: {}", version);
                    ffmpeg_installed = true;
                }
            }
        }
    }

    Ok(serde_json::json!({
        "ytdlp": ytdlp_version,
        "ffmpeg": ffmpeg_version,
        "ytdlp_installed": ytdlp_installed,
        "ffmpeg_installed": ffmpeg_installed
    }))
}

#[tauri::command]
async fn install_dependencies(app: tauri::AppHandle) -> Result<(), String> {
    let app_dir = get_app_dir(&app);
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app directory: {}", e))?;
    }

    // Check if yt-dlp is available system-wide first
    let ytdlp_available = create_hidden_command("yt-dlp").arg("--version").output().is_ok();
    if !ytdlp_available {
        let ytdlp_path = get_yt_dlp_path(&app);
        if !ytdlp_path.exists() {
            app.emit("dependency-install-progress", "Downloading yt-dlp...").map_err(|e| e.to_string())?;
            
            match get_latest_release_assets("yt-dlp/yt-dlp").await {
                Ok(release) => {
                    if let Some(asset) = release.assets.iter().find(|a| a.name == "yt-dlp.exe") {
                        match download_file(&asset.browser_download_url, &ytdlp_path).await {
                            Ok(_) => {
                                app.emit("dependency-install-progress", "yt-dlp downloaded successfully").map_err(|e| e.to_string())?;
                            }
                            Err(e) => {
                                return Err(format!("Failed to download yt-dlp: {}", e));
                            }
                        }
                    } else {
                        return Err("Could not find yt-dlp.exe in the latest release".to_string());
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to get yt-dlp release info: {}", e));
                }
            }
        } else {
            app.emit("dependency-install-progress", "yt-dlp already installed (managed)").map_err(|e| e.to_string())?;
        }
    } else {
        app.emit("dependency-install-progress", "yt-dlp already installed (system)").map_err(|e| e.to_string())?;
    }

    // Check if ffmpeg is available system-wide first
    let ffmpeg_available = create_hidden_command("ffmpeg").arg("-version").output().is_ok();
    if !ffmpeg_available {
        let ffmpeg_path = get_ffmpeg_path(&app);
        if !ffmpeg_path.exists() {
            app.emit("dependency-install-progress", "Downloading ffmpeg...").map_err(|e| e.to_string())?;
            
            // Try to download from multiple sources
            let mut ffmpeg_installed = false;
            
            // First try: GyanD/codexffmpeg
            match get_latest_release_assets("GyanD/codexffmpeg").await {
                Ok(release) => {
                    if let Some(asset) = release.assets.iter().find(|a| a.name.contains("essentials_build.zip")) {
                        let zip_path = app_dir.join(&asset.name);
                        match download_file(&asset.browser_download_url, &zip_path).await {
                            Ok(_) => {
                                app.emit("dependency-install-progress", "Extracting ffmpeg...").map_err(|e| e.to_string())?;
                                match extract_zip(&zip_path, &app_dir) {
                                    Ok(_) => {
                                        let _ = fs::remove_file(zip_path);
                                        ffmpeg_installed = true;
                                        app.emit("dependency-install-progress", "ffmpeg extracted successfully").map_err(|e| e.to_string())?;
                                    }
                                    Err(e) => {
                                        app.emit("dependency-install-progress", &format!("Failed to extract ffmpeg: {}", e)).map_err(|e| e.to_string())?;
                                    }
                                }
                            }
                            Err(e) => {
                                app.emit("dependency-install-progress", &format!("Failed to download ffmpeg: {}", e)).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
                Err(e) => {
                    app.emit("dependency-install-progress", &format!("Failed to get ffmpeg release info: {}", e)).map_err(|e| e.to_string())?;
                }
            }
            
            // Second try: Direct download from a static URL if the above fails
            if !ffmpeg_installed {
                app.emit("dependency-install-progress", "Downloading ffmpeg from alternative source...").map_err(|e| e.to_string())?;
                let ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
                let zip_path = app_dir.join("ffmpeg-essentials.zip");
                
                match download_file(ffmpeg_url, &zip_path).await {
                    Ok(_) => {
                        app.emit("dependency-install-progress", "Extracting ffmpeg...").map_err(|e| e.to_string())?;
                        match extract_zip(&zip_path, &app_dir) {
                            Ok(_) => {
                                let _ = fs::remove_file(zip_path);
                                ffmpeg_installed = true;
                                app.emit("dependency-install-progress", "ffmpeg extracted successfully").map_err(|e| e.to_string())?;
                            }
                            Err(e) => {
                                app.emit("dependency-install-progress", &format!("Failed to extract ffmpeg: {}", e)).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                    Err(e) => {
                        app.emit("dependency-install-progress", &format!("Failed to download ffmpeg from alternative source: {}", e)).map_err(|e| e.to_string())?;
                    }
                }
            }
            
            if !ffmpeg_installed {
                return Err("Failed to install ffmpeg from all available sources".to_string());
            }
        } else {
            app.emit("dependency-install-progress", "ffmpeg already installed (managed)").map_err(|e| e.to_string())?;
        }
    } else {
        app.emit("dependency-install-progress", "ffmpeg already installed (system)").map_err(|e| e.to_string())?;
    }
    
    app.emit("dependency-install-progress", "All dependencies are available.").map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn generate_thumbnail_data(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let input_path = std::path::PathBuf::from(&file_path);
    
    if !input_path.exists() {
        return Err("Input file does not exist".to_string());
    }

    // Get file extension to determine how to handle it
    let extension = input_path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    // For images, read and encode as base64
    if ["jpg", "jpeg", "png", "gif", "webp", "bmp"].contains(&extension.as_str()) {
        match std::fs::read(&input_path) {
            Ok(image_data) => {
                let mime_type = match extension.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    "bmp" => "image/bmp",
                    _ => "image/jpeg",
                };
                let base64_data = general_purpose::STANDARD.encode(&image_data);
                return Ok(format!("data:{};base64,{}", mime_type, base64_data));
            }
            Err(e) => return Err(format!("Failed to read image file: {}", e)),
        }
    }

    // For videos, use FFmpeg to extract thumbnail to stdout and encode as base64
    if ["mp4", "avi", "mov", "mkv", "webm", "flv", "wmv", "m4v", "3gp"].contains(&extension.as_str()) {
        let ffmpeg_cmd = get_ffmpeg_command();
        let mut cmd = if ffmpeg_cmd == "managed" {
            let ffmpeg_path = get_ffmpeg_path(&app);
            create_hidden_command_with_path(&ffmpeg_path)
        } else {
            create_hidden_command("ffmpeg")
        };
        
        cmd.arg("-i")
            .arg(&file_path)
            .arg("-ss")
            .arg("00:00:01") // Seek to 1 second (safer than 10 for short videos)
            .arg("-vframes")
            .arg("1") // Extract only 1 frame
            .arg("-q:v")
            .arg("2") // High quality
            .arg("-vf")
            .arg("scale=320:240:force_original_aspect_ratio=decrease") // Scale to max 320x240
            .arg("-f")
            .arg("image2pipe") // Output to pipe
            .arg("-vcodec")
            .arg("mjpeg") // JPEG format
            .arg("-");

        let output = cmd.output()
            .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg thumbnail extraction failed: {}", stderr));
        }

        if !output.stdout.is_empty() {
            let base64_data = general_purpose::STANDARD.encode(&output.stdout);
            return Ok(format!("data:image/jpeg;base64,{}", base64_data));
        } else {
            return Err("No thumbnail data generated".to_string());
        }
    }

    Err(format!("Unsupported file type: {}", extension))
}

#[tauri::command]
async fn show_in_explorer(file_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(file_path.replace('/', "\\"))
            .spawn()
            .map_err(|e| format!("Failed to show file in explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to show file in finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try different file managers
        let file_managers = ["nautilus", "dolphin", "thunar", "pcmanfm", "caja"];
        let parent = path.parent().ok_or("Could not get parent directory")?;
        
        for manager in &file_managers {
            if std::process::Command::new("which")
                .arg(manager)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                std::process::Command::new(manager)
                    .arg(parent)
                    .spawn()
                    .map_err(|e| format!("Failed to open file manager: {}", e))?;
                return Ok(());
            }
        }
        
        return Err("No supported file manager found".to_string());
    }

    Ok(())
}

#[tauri::command]
async fn copy_file_to_clipboard(file_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to copy file to clipboard on Windows
        let powershell_script = format!(
            "Set-Clipboard -Path '{}'", 
            path.to_string_lossy().replace("'", "''")
        );
        
        let result = Command::new("powershell")
            .args(["-Command", &powershell_script])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to copy file to clipboard: {}", error))
                }
            }
            Err(e) => Err(format!("Failed to execute PowerShell command: {}", e))
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // Use osascript to copy file to clipboard on macOS
        let applescript = format!(
            "tell application \"Finder\" to set the clipboard to (POSIX file \"{}\")",
            path.to_string_lossy()
        );
        
        let result = Command::new("osascript")
            .args(["-e", &applescript])
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to copy file to clipboard: {}", error))
                }
            }
            Err(e) => Err(format!("Failed to execute AppleScript: {}", e))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use xclip to copy file path to clipboard on Linux
        // First try to copy as file URI
        let file_uri = format!("file://{}", path.to_string_lossy());
        
        let result = Command::new("xclip")
            .args(["-selection", "clipboard", "-t", "text/uri-list"])
            .arg("-i")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                if let Some(stdin) = child.stdin.as_mut() {
                    stdin.write_all(file_uri.as_bytes())?;
                }
                child.wait()
            });
            
        match result {
            Ok(status) => {
                if status.success() {
                    Ok(())
                } else {
                    Err("Failed to copy file to clipboard".to_string())
                }
            }
            Err(_) => {
                // Fallback: try copying just the file path as text
                let result = Command::new("xclip")
                    .args(["-selection", "clipboard"])
                    .arg("-i")
                    .stdin(std::process::Stdio::piped())
                    .spawn()
                    .and_then(|mut child| {
                        use std::io::Write;
                        if let Some(stdin) = child.stdin.as_mut() {
                            stdin.write_all(path.to_string_lossy().as_bytes())?;
                        }
                        child.wait()
                    });
                
                match result {
                    Ok(status) => {
                        if status.success() {
                            Ok(())
                        } else {
                            Err("Failed to copy file path to clipboard".to_string())
                        }
                    }
                    Err(e) => Err(format!("xclip not available: {}", e))
                }
            }
        }
    }
}

fn get_yt_dlp_command() -> String {
    // Try system-wide yt-dlp first
    if create_hidden_command("yt-dlp").arg("--version").output().is_ok() {
        "yt-dlp".to_string()
    } else {
        // Fallback to managed version (will be handled by get_yt_dlp_path)
        "managed".to_string()
    }
}

fn get_ffmpeg_command() -> String {
    // Try system-wide ffmpeg first
    if create_hidden_command("ffmpeg").arg("-version").output().is_ok() {
        "ffmpeg".to_string()
    } else {
        // Fallback to managed version (will be handled by get_ffmpeg_path)
        "managed".to_string()
    }
}

fn get_ffprobe_command() -> String {
    // Try system-wide ffprobe first
    if create_hidden_command("ffprobe").arg("-version").output().is_ok() {
        "ffprobe".to_string()
    } else {
        // Fallback to managed version (will be handled by get_ffprobe_path)
        "managed".to_string()
    }
}

fn get_app_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
}

fn get_yt_dlp_path(app: &tauri::AppHandle) -> PathBuf {
    get_app_dir(app).join("yt-dlp.exe")
}

fn get_ffmpeg_path(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = get_app_dir(app);
    
    // Try to find ffmpeg in any extracted directory
    if let Ok(entries) = fs::read_dir(&app_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.contains("ffmpeg") && name.contains("essentials") {
                    let ffmpeg_path = entry.path().join("bin").join("ffmpeg.exe");
                    if ffmpeg_path.exists() {
                        return ffmpeg_path;
                    }
                }
            }
        }
    }
    
    // Fallback to default path
    app_dir.join("ffmpeg").join("bin").join("ffmpeg.exe")
}

fn get_ffprobe_path(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = get_app_dir(app);
    
    // Try to find ffprobe in any extracted directory
    if let Ok(entries) = fs::read_dir(&app_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.contains("ffmpeg") && name.contains("essentials") {
                    let ffprobe_path = entry.path().join("bin").join("ffprobe.exe");
                    if ffprobe_path.exists() {
                        return ffprobe_path;
                    }
                }
            }
        }
    }
    
    // Fallback to default path
    app_dir.join("ffmpeg").join("bin").join("ffprobe.exe")
}

async fn get_latest_release_assets(repo: &str) -> Result<GithubRelease, String> {
    let client = Client::new();
    let url = format!("{}{}/releases/latest", GITHUB_API_URL, repo);
    
    client
        .get(&url)
        .header("User-Agent", "tauri-app")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<GithubRelease>()
        .await
        .map_err(|e| e.to_string())
}

async fn download_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let mut dest_file = File::create(dest).map_err(|e| e.to_string())?;
    let content = response.bytes().await.map_err(|e| e.to_string())?;
    copy(&mut content.as_ref(), &mut dest_file).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_zip(zip_path: &PathBuf, dest_dir: &PathBuf) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = dest_dir.join(file.name());

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_download,
            get_video_info,
            fetch_video_info,
            process_video,
            list_files,
            check_dependencies,
            install_dependencies,
            delete_file,
            open_file,
            create_directory,
            rename_item,
            move_item,
            delete_directory,
            start_video_server,
            get_video_url,
            generate_thumbnail_data,
            show_in_explorer,
            copy_file_to_clipboard,
            get_installation_logs,
            get_settings,
            set_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_installation_logs(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = get_app_dir(&app);
    let mut logs = Vec::new();
    
    logs.push(format!("App directory: {}", app_dir.display()));
    
    // Check yt-dlp
    let ytdlp_path = get_yt_dlp_path(&app);
    logs.push(format!("yt-dlp path: {}", ytdlp_path.display()));
    logs.push(format!("yt-dlp exists: {}", ytdlp_path.exists()));
    
    // Check ffmpeg
    let ffmpeg_path = get_ffmpeg_path(&app);
    logs.push(format!("ffmpeg path: {}", ffmpeg_path.display()));
    logs.push(format!("ffmpeg exists: {}", ffmpeg_path.exists()));
    
    // Check ffprobe
    let ffprobe_path = get_ffprobe_path(&app);
    logs.push(format!("ffprobe path: {}", ffprobe_path.display()));
    logs.push(format!("ffprobe exists: {}", ffprobe_path.exists()));
    
    // List app directory contents
    logs.push("App directory contents:".to_string());
    if let Ok(entries) = fs::read_dir(&app_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
            logs.push(format!("  {} {}", if is_dir { "[DIR]" } else { "[FILE]" }, name));
            
            // If it's a directory that looks like ffmpeg, list its contents
            if is_dir && name.contains("ffmpeg") {
                if let Ok(sub_entries) = fs::read_dir(entry.path()) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                        let sub_is_dir = sub_entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                        logs.push(format!("    {} {}", if sub_is_dir { "[DIR]" } else { "[FILE]" }, sub_name));
                        
                        // Check bin directory
                        if sub_is_dir && sub_name == "bin" {
                            if let Ok(bin_entries) = fs::read_dir(sub_entry.path()) {
                                for bin_entry in bin_entries.flatten() {
                                    let bin_name = bin_entry.file_name().to_string_lossy().to_string();
                                    logs.push(format!("      [FILE] {}", bin_name));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(logs.join("\n"))
}
