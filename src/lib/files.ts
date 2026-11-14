export function fileSymbol(ext: string, isDir = false): string {
  if (isDir) return "folder";
  switch (ext.toLowerCase()) {
    case "pptx":
    case "ppt":
    case "key":
      return "slideshow";
    case "pdf":
      return "picture_as_pdf";
    case "doc":
    case "docx":
    case "rtf":
    case "txt":
    case "md":
      return "description";
    case "xls":
    case "xlsx":
    case "csv":
      return "table_chart";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "bmp":
    case "svg":
      return "image";
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
      return "movie";
    case "mp3":
    case "wav":
    case "flac":
    case "m4a":
      return "audio_file";
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return "archive";
    case "exe":
    case "msi":
      return "terminal";
    case "lnk":
      return "launch";
    default:
      return "insert_drive_file";
  }
}

export function fileTypeLabel(ext: string, isDir = false): string {
  if (isDir) return "文件夹";
  const labels: Record<string, string> = {
    pptx: "演示文稿",
    ppt: "演示文稿",
    pdf: "PDF 文档",
    doc: "Word 文档",
    docx: "Word 文档",
    txt: "文本文件",
    md: "Markdown",
    xls: "表格",
    xlsx: "表格",
    csv: "表格",
    png: "图片",
    jpg: "图片",
    jpeg: "图片",
    gif: "图片",
    webp: "图片",
    svg: "图片",
    mp4: "视频",
    mov: "视频",
    mkv: "视频",
    mp3: "音频",
    wav: "音频",
    zip: "压缩包",
    rar: "压缩包",
    "7z": "压缩包",
    exe: "应用程序",
    lnk: "快捷方式",
  };
  return labels[ext.toLowerCase()] ?? (ext ? `${ext.toUpperCase()} 文件` : "文件");
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
