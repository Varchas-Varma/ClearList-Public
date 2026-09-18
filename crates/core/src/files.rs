use crate::{Error, Result};
use image::{ImageFormat, ImageReader, Limits};
use std::{fs::OpenOptions, io::Write, path::Path};
pub const MAX_IMAGE_BYTES: usize = 15 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: u64 = 40_000_000;
pub fn validate_image(bytes: &[u8]) -> Result<(&'static str, &'static str)> {
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err(Error::Invalid(
            "Images must be between 1 byte and 15 MiB.".into(),
        ));
    }
    let format = image::guess_format(bytes)
        .map_err(|_| Error::Invalid("Use a valid PNG, JPEG, or WebP image.".into()))?;
    let (mime, ext) = match format {
        ImageFormat::Png => ("image/png", "png"),
        ImageFormat::Jpeg => ("image/jpeg", "jpg"),
        ImageFormat::WebP => ("image/webp", "webp"),
        _ => return Err(Error::Invalid("Use PNG, JPEG, or WebP images.".into())),
    };
    let (w, h) = ImageReader::with_format(std::io::Cursor::new(bytes), format)
        .into_dimensions()
        .map_err(|_| Error::Invalid("This image is damaged or unsupported.".into()))?;
    if u64::from(w) * u64::from(h) > MAX_IMAGE_PIXELS {
        return Err(Error::Invalid(
            "Images must be at most 40 megapixels.".into(),
        ));
    }
    let mut reader = ImageReader::with_format(std::io::Cursor::new(bytes), format);
    let mut limits = Limits::default();
    limits.max_alloc = Some(192 * 1024 * 1024);
    reader.limits(limits);
    reader
        .decode()
        .map_err(|_| Error::Invalid("This image is damaged or too large to decode.".into()))?;
    Ok((mime, ext))
}
pub fn owned_name(name: &str) -> bool {
    let Some((stem, ext)) = name.rsplit_once('.') else {
        return false;
    };
    matches!(ext, "png" | "jpg" | "webp")
        && stem.len() == 36
        && uuid::Uuid::parse_str(stem).is_ok()
        && !name.contains(['/', '\\'])
}
pub fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    let result = (|| -> std::io::Result<()> {
        file.write_all(bytes)?;
        file.sync_all()
    })();
    drop(file);
    if result.is_err() {
        let _ = std::fs::remove_file(path);
    }
    result?;
    Ok(())
}
