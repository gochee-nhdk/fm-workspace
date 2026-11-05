/**
 * Chuyển đổi các trang PDF thành hình ảnh JPEG độ nét cao (2x DPI)
 * Bằng cách này, Gemini Multimodal Vision có thể đọc 100% chính xác từng dòng bảng,
 * số lượng, đơn giá, mã nội bộ, mã vạch và thông tin nhà cung cấp mà không bị lỗi font hay định dạng PDF.
 */
export async function convertPdfToImages(file: File, maxPages = 2): Promise<string[]> {
  if (typeof window === 'undefined' || !file) return [];
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return [];

  try {
    const pdfjsLib: any = await import('pdfjs-dist/build/pdf.min.mjs');

    if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch (_) {}
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages || 1, maxPages);
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Scale 2.0 (144 DPI) cho độ phân giải cực nét, OCR chính xác chữ số bảng biểu
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Nền trắng chuẩn hóa cho OCR
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      await page.render(renderContext).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      images.push(dataUrl);
    }

    return images;
  } catch (err) {
    console.warn('PDF-to-Image rendering failed, will fallback to raw PDF stream:', err);
    return [];
  }
}
